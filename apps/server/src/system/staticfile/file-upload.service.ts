import { Prisma } from '#/generated/prisma/client.js';
import { FileCleanupService } from '#/system/file-cleanup/file-cleanup.service.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import { promises as fs } from 'fs';
import { extname, join } from 'path';
import { pipeline } from 'stream/promises';
import {
  assertNotDangerousFilename,
  assertPathInsideRoot,
  ensureUploadTempDir,
  getStaticFileRoot,
  originalUploadBasename,
  sanitizeUploadFilenameByBlacklist,
  tryResolvePathInsideRoot,
} from './multer.config.js';
import { FileRepository } from './file.repository.js';
import { FileUploadRepository } from './file-upload.repository.js';
import type { InitiateUploadDto } from './file-upload.dto.js';

const SHA256_RE = /^[0-9a-f]{64}$/;

export type FileDto = {
  id: number;
  name: string;
  mimeType: string;
  path: string;
  extension: string | null;
  size: number;
  url: string;
  sha256: string | null;
  createdAt: Date;
  deletedAt: Date | null;
};

export type InitiateResult =
  | { outcome: 'instant' | 'restored'; file: FileDto }
  | {
      outcome: 'resumed' | 'created';
      sessionId: string;
      chunkSize: number;
      totalChunks: number;
      expiresAt: string;
      uploadedChunks: number[];
    };

@Injectable()
export class FileUploadService implements OnModuleInit {
  private readonly logger = new Logger(FileUploadService.name);

  constructor(
    private readonly files: FileRepository,
    private readonly sessions: FileUploadRepository,
    private readonly cleanup: FileCleanupService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    try {
      await this.reconcileUploadSessions();
    } catch (error) {
      this.logger.warn(
        `上传会话对账失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async initiate(
    userId: string,
    dto: InitiateUploadDto,
  ): Promise<{ message: string; data: InitiateResult }> {
    const sha256 = dto.sha256.toLowerCase();
    if (!SHA256_RE.test(sha256)) {
      throw new BadRequestException('SHA-256 格式不正确');
    }
    if (dto.size <= 0) {
      throw new BadRequestException('文件大小无效');
    }
    assertNotDangerousFilename(dto.originalName);

    const maxBytes = this.uploadConfig.maxBytes;
    if (dto.size > maxBytes) {
      throw new BadRequestException('文件超过大小限制');
    }

    const active = await this.files.findActiveBySha256(sha256);
    if (active) {
      return {
        message: '文件已存在，已秒传',
        data: { outcome: 'instant', file: this.toFileDto(active) },
      };
    }

    const deleted = await this.files.findDeletedBySha256(sha256);
    if (deleted && this.diskExists(deleted.path)) {
      const restored = await this.files.restoreById(deleted.id);
      return {
        message: '文件已恢复',
        data: { outcome: 'restored', file: this.toFileDto(restored) },
      };
    }

    const existing = await this.sessions.findResumable(
      userId,
      sha256,
      BigInt(dto.size),
    );
    if (existing) {
      return {
        message: '继续未完成的上传',
        data: {
          outcome: 'resumed',
          sessionId: existing.id,
          chunkSize: existing.chunkSize,
          totalChunks: existing.totalChunks,
          expiresAt: existing.expiresAt.toISOString(),
          uploadedChunks: existing.chunks.map((chunk) => chunk.chunkIndex),
        },
      };
    }

    const openCount = await this.sessions.countOpenSessions(userId);
    if (openCount >= this.uploadConfig.maxOpenSessions) {
      throw new BadRequestException('未完成的上传过多，请先取消或等待过期');
    }

    const chunkSize = this.uploadConfig.chunkBytes;
    const totalChunks = Math.ceil(dto.size / chunkSize);
    const ttlHours = this.uploadConfig.sessionTtlHours;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    const session = await this.sessions.createSession({
      sha256,
      size: BigInt(dto.size),
      originalName: dto.originalName,
      mimeType: dto.mimeType || 'application/octet-stream',
      chunkSize,
      totalChunks,
      createdBy: { connect: { id: userId } },
      tempDir: 'file/tmp/pending',
      expiresAt,
    });
    const tempDir = `file/tmp/${session.id}`;
    await this.sessions.updateTempDir(session.id, tempDir);
    ensureUploadTempDir(session.id);

    return {
      message: '上传会话已创建',
      data: {
        outcome: 'created',
        sessionId: session.id,
        chunkSize,
        totalChunks,
        expiresAt: expiresAt.toISOString(),
        uploadedChunks: [],
      },
    };
  }

  async getSession(userId: string, sessionId: string) {
    const session = await this.requireOwnedSession(userId, sessionId);
    this.assertNotExpired(session.expiresAt);
    const chunks = await this.sessions.listChunkIndexes(session.id);
    return {
      message: '查询成功',
      data: {
        sessionId: session.id,
        status: session.status,
        chunkSize: session.chunkSize,
        totalChunks: session.totalChunks,
        size: Number(session.size),
        originalName: session.originalName,
        sha256: session.sha256,
        expiresAt: session.expiresAt.toISOString(),
        uploadedChunks: chunks.map((chunk) => chunk.chunkIndex),
      },
    };
  }

  async uploadChunk(
    userId: string,
    sessionId: string,
    index: number,
    buffer: Buffer,
  ) {
    const session = await this.requireOwnedSession(userId, sessionId);
    this.assertNotExpired(session.expiresAt);
    if (session.status !== 'INITIATED' && session.status !== 'UPLOADING') {
      throw new BadRequestException('当前会话不可上传分片');
    }
    if (!Number.isInteger(index) || index < 0 || index >= session.totalChunks) {
      throw new BadRequestException('分片序号无效');
    }
    const expected = expectedChunkSize(
      Number(session.size),
      session.chunkSize,
      session.totalChunks,
      index,
    );
    if (buffer.length !== expected) {
      throw new BadRequestException('分片大小不正确');
    }

    const dir = ensureUploadTempDir(session.id);
    const chunkPath = assertPathInsideRoot(dir, join(dir, String(index)));
    await fs.writeFile(chunkPath, buffer);
    await this.sessions.upsertChunk(session.id, index, buffer.length);
    if (session.status === 'INITIATED') {
      await this.sessions.markUploading(session.id);
    }
    return { message: '分片上传成功' };
  }

  async complete(userId: string, sessionId: string) {
    const session = await this.requireOwnedSession(userId, sessionId);
    this.assertNotExpired(session.expiresAt);

    const locked = await this.sessions.tryBeginComplete(session.id);
    if (locked.count !== 1) {
      const current = await this.sessions.findById(session.id);
      if (current?.status === 'COMPLETED') {
        const existing = await this.files.findActiveBySha256(current.sha256);
        if (existing) {
          return {
            message: '文件已存在',
            data: { file: this.toFileDto(existing) },
          };
        }
      }
      throw new ConflictException('上传正在完成或不可完成');
    }

    const fresh = await this.sessions.findById(session.id);
    if (!fresh) {
      throw new NotFoundException('上传会话不存在');
    }

    const root = getStaticFileRoot();
    const tempDir = assertPathInsideRoot(
      root,
      join(root, fresh.tempDir || `file/tmp/${fresh.id}`),
    );
    const missing = await this.missingChunks(fresh, tempDir);
    if (missing.length > 0) {
      await this.sessions.setStatus(fresh.id, 'UPLOADING');
      throw new BadRequestException('分片不完整，请继续上传');
    }

    const mergedPath = join(tempDir, '__merged');
    try {
      await this.mergeChunks(tempDir, fresh.totalChunks, mergedPath);
      const actualHash = await hashFile(mergedPath);
      if (actualHash !== fresh.sha256) {
        await this.sessions.setStatus(fresh.id, 'FAILED');
        await this.enqueueSessionCleanup(fresh.id, fresh.tempDir);
        throw new BadRequestException('文件校验失败');
      }

      const raced = await this.files.findActiveBySha256(fresh.sha256);
      if (raced) {
        await this.sessions.setStatus(fresh.id, 'COMPLETED');
        await this.enqueueSessionCleanup(fresh.id, fresh.tempDir);
        return {
          message: '文件已存在，已秒传',
          data: { file: this.toFileDto(raced) },
        };
      }

      const displayName = originalUploadBasename(fresh.originalName);
      const storedName = sanitizeUploadFilenameByBlacklist(fresh.originalName);
      const manageDir = assertPathInsideRoot(
        root,
        join(root, 'file', 'manage'),
      );
      await fs.mkdir(manageDir, { recursive: true });
      const finalPath = assertPathInsideRoot(
        manageDir,
        join(manageDir, storedName),
      );
      await fs.rename(mergedPath, finalPath);

      try {
        const serveRoot = (
          this.configService.get<string>('staticFileServeRoot') || ''
        ).replace(/\/$/, '');
        const extension = extname(displayName).replace(/^\./, '');
        const created = await this.files.create({
          name: displayName,
          mimeType: fresh.mimeType,
          path: finalPath,
          size: fresh.size,
          url: `${serveRoot}/file/manage/${storedName}`,
          extension: extension || storedName,
          sha256: fresh.sha256,
        });
        await this.sessions.setStatus(fresh.id, 'COMPLETED');
        await this.enqueueSessionCleanup(fresh.id, fresh.tempDir);
        return {
          message: '文件上传成功',
          data: { file: this.toFileDto(created) },
        };
      } catch (error) {
        await this.cleanup.enqueue([{ kind: 'orphan-path', path: finalPath }]);
        await this.enqueueSessionCleanup(fresh.id, fresh.tempDir);
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const existing = await this.files.findActiveBySha256(fresh.sha256);
          if (existing) {
            await this.sessions.setStatus(fresh.id, 'COMPLETED');
            return {
              message: '文件已存在，已秒传',
              data: { file: this.toFileDto(existing) },
            };
          }
        }
        await this.sessions.setStatus(fresh.id, 'FAILED');
        throw error;
      }
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException
      ) {
        throw error;
      }
      await this.sessions.setStatus(fresh.id, 'FAILED').catch(() => undefined);
      await this.enqueueSessionCleanup(fresh.id, fresh.tempDir);
      throw error;
    }
  }

  async abort(userId: string, sessionId: string) {
    await this.requireOwnedSession(userId, sessionId);
    const result = await this.sessions.tryAbort(sessionId);
    if (result.count !== 1) {
      throw new ConflictException('当前会话不可取消');
    }
    const session = await this.sessions.findById(sessionId);
    if (session) {
      await this.enqueueSessionCleanup(session.id, session.tempDir);
    }
    return { message: '已取消上传' };
  }

  async reconcileUploadSessions() {
    const expired = await this.sessions.findExpiredOpen();
    await this.sessions.markExpired(expired.map((item) => item.id));
    await this.cleanup.enqueue(
      expired.map((item) => ({
        kind: 'upload-session' as const,
        sessionId: item.id,
        path: item.tempDir,
      })),
    );

    const stuckSince = new Date(Date.now() - 60 * 60 * 1000);
    const stuck = await this.sessions.findStuckCompleting(stuckSince);
    await this.sessions.markFailed(stuck.map((item) => item.id));
    await this.cleanup.enqueue(
      stuck.map((item) => ({
        kind: 'upload-session' as const,
        sessionId: item.id,
        path: item.tempDir,
      })),
    );
  }

  private get uploadConfig() {
    return (
      this.configService.get<{
        maxBytes: number;
        chunkBytes: number;
        sessionTtlHours: number;
        maxOpenSessions: number;
      }>('fileUpload') ?? {
        maxBytes: 524288000,
        chunkBytes: 5242880,
        sessionTtlHours: 24,
        maxOpenSessions: 5,
      }
    );
  }

  private async requireOwnedSession(userId: string, sessionId: string) {
    const session = await this.sessions.findById(sessionId);
    if (!session || session.createdById !== userId) {
      throw new NotFoundException('上传会话不存在');
    }
    return session;
  }

  private assertNotExpired(expiresAt: Date) {
    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('上传会话已过期');
    }
  }

  private diskExists(storedPath: string): boolean {
    const abs = tryResolvePathInsideRoot(getStaticFileRoot(), storedPath);
    return Boolean(abs && existsSync(abs));
  }

  private async missingChunks(
    session: {
      totalChunks: number;
      chunkSize: number;
      size: bigint;
      chunks: { chunkIndex: number; size: number }[];
    },
    tempDir: string,
  ) {
    const missing: number[] = [];
    const byIndex = new Map(
      session.chunks.map((chunk) => [chunk.chunkIndex, chunk]),
    );
    for (let index = 0; index < session.totalChunks; index++) {
      const expected = expectedChunkSize(
        Number(session.size),
        session.chunkSize,
        session.totalChunks,
        index,
      );
      const row = byIndex.get(index);
      const chunkPath = join(tempDir, String(index));
      if (!row || row.size !== expected) {
        missing.push(index);
        continue;
      }
      try {
        const stat = await fs.stat(chunkPath);
        if (stat.size !== expected) missing.push(index);
      } catch {
        missing.push(index);
      }
    }
    return missing;
  }

  private async mergeChunks(
    tempDir: string,
    totalChunks: number,
    mergedPath: string,
  ) {
    const out = createWriteStream(mergedPath);
    try {
      for (let index = 0; index < totalChunks; index++) {
        const chunkPath = assertPathInsideRoot(
          tempDir,
          join(tempDir, String(index)),
        );
        await pipeline(createReadStream(chunkPath), out, { end: false });
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        out.end((error: Error | null | undefined) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  }

  private enqueueSessionCleanup(sessionId: string, tempDir: string) {
    return this.cleanup.enqueue([
      {
        kind: 'upload-session',
        sessionId,
        path: tempDir || `file/tmp/${sessionId}`,
      },
    ]);
  }

  private toFileDto(file: {
    id: number;
    name: string;
    mimeType: string;
    path: string;
    extension: string | null;
    size: bigint | number;
    url: string;
    sha256?: string | null;
    createdAt: Date;
    deletedAt: Date | null;
  }): FileDto {
    return {
      ...file,
      sha256: file.sha256 ?? null,
      size: Number(file.size),
    };
  }
}

export function expectedChunkSize(
  fileSize: number,
  chunkSize: number,
  totalChunks: number,
  index: number,
): number {
  if (index === totalChunks - 1) {
    return fileSize - chunkSize * (totalChunks - 1);
  }
  return chunkSize;
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(createReadStream(path), hash);
  return hash.digest('hex');
}
