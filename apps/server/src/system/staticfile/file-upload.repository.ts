import { FileUploadStatus, Prisma } from '@/generated/prisma/client.js';
import { PgService } from '@/infrastructure/database/prisma/pg.service.js';
import { Injectable } from '@nestjs/common';

const OPEN_STATUSES: FileUploadStatus[] = [
  'INITIATED',
  'UPLOADING',
  'COMPLETING',
];
const RESUMABLE_STATUSES: FileUploadStatus[] = ['INITIATED', 'UPLOADING'];

@Injectable()
export class FileUploadRepository {
  constructor(private readonly db: PgService) {}

  countOpenSessions(userId: string) {
    return this.db.fileUploadSession.count({
      where: { createdById: userId, status: { in: OPEN_STATUSES } },
    });
  }

  findResumable(userId: string, sha256: string, size: bigint) {
    return this.db.fileUploadSession.findFirst({
      where: {
        createdById: userId,
        sha256,
        size,
        status: { in: RESUMABLE_STATUSES },
        expiresAt: { gt: new Date() },
      },
      orderBy: { updatedAt: 'desc' },
      include: { chunks: { select: { chunkIndex: true } } },
    });
  }

  createSession(data: Prisma.FileUploadSessionCreateInput) {
    return this.db.fileUploadSession.create({ data });
  }

  updateTempDir(id: string, tempDir: string) {
    return this.db.fileUploadSession.update({
      where: { id },
      data: { tempDir },
    });
  }

  findById(id: string) {
    return this.db.fileUploadSession.findUnique({
      where: { id },
      include: { chunks: true },
    });
  }

  listChunkIndexes(sessionId: string) {
    return this.db.fileUploadChunk.findMany({
      where: { sessionId },
      select: { chunkIndex: true },
      orderBy: { chunkIndex: 'asc' },
    });
  }

  upsertChunk(sessionId: string, chunkIndex: number, size: number) {
    return this.db.fileUploadChunk.upsert({
      where: { sessionId_chunkIndex: { sessionId, chunkIndex } },
      create: { sessionId, chunkIndex, size },
      update: { size },
    });
  }

  markUploading(id: string) {
    return this.db.fileUploadSession.updateMany({
      where: { id, status: 'INITIATED' },
      data: { status: 'UPLOADING' },
    });
  }

  tryBeginComplete(id: string) {
    return this.db.fileUploadSession.updateMany({
      where: { id, status: { in: ['INITIATED', 'UPLOADING'] } },
      data: { status: 'COMPLETING' },
    });
  }

  tryAbort(id: string) {
    return this.db.fileUploadSession.updateMany({
      where: { id, status: { in: ['INITIATED', 'UPLOADING'] } },
      data: { status: 'ABORTED' },
    });
  }

  setStatus(id: string, status: FileUploadStatus) {
    return this.db.fileUploadSession.update({
      where: { id },
      data: { status },
    });
  }

  findExpiredOpen() {
    return this.db.fileUploadSession.findMany({
      where: {
        status: { in: ['INITIATED', 'UPLOADING'] },
        expiresAt: { lt: new Date() },
      },
      select: { id: true, tempDir: true },
    });
  }

  findStuckCompleting(olderThan: Date) {
    return this.db.fileUploadSession.findMany({
      where: {
        status: 'COMPLETING',
        updatedAt: { lt: olderThan },
      },
      select: { id: true, tempDir: true },
    });
  }

  markExpired(ids: string[]) {
    if (ids.length === 0) return;
    return this.db.fileUploadSession.updateMany({
      where: { id: { in: ids } },
      data: { status: 'EXPIRED' },
    });
  }

  markFailed(ids: string[]) {
    if (ids.length === 0) return;
    return this.db.fileUploadSession.updateMany({
      where: { id: { in: ids } },
      data: { status: 'FAILED' },
    });
  }
}
