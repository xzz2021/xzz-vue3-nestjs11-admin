import {
  getStaticFileRoot,
  tryResolvePathInsideRoot,
} from '@/system/staticfile/multer.config.js';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { PgService } from '@/infrastructure/database/prisma/pg.service.js';
import { DiskCleanupEventBus } from './disk-cleanup.events.js';
import {
  FILE_CLEANUP_QUEUE,
  FILE_CLEANUP_UNLINK,
} from './file-cleanup.constants.js';
import type { FileCleanupJob } from './file-cleanup.types.js';

@Injectable()
export class FileCleanupService {
  private readonly logger = new Logger(FileCleanupService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(FILE_CLEANUP_QUEUE) private readonly queue: Queue,
    private readonly events: DiskCleanupEventBus,
    private readonly db: PgService,
  ) {}

  async enqueue(jobs: FileCleanupJob[]) {
    if (jobs.length === 0) return;
    await Promise.all(
      jobs.map((data) =>
        this.queue.add(FILE_CLEANUP_UNLINK, data, {
          attempts: 5,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: true,
        }),
      ),
    );
  }

  async process(job: FileCleanupJob) {
    if (job.kind === 'managed-file') {
      const file = await this.db.file.findUnique({
        where: { id: job.fileId },
        select: { deletedAt: true },
      });
      if (!file || file.deletedAt == null) {
        this.logger.log(`跳过已恢复或不存在的托管文件 fileId=${job.fileId}`);
        return;
      }
    }

    const safePath = this.resolveSafePath(job.path);
    if (safePath) {
      if (job.kind === 'upload-session') {
        await fs.rm(safePath, { recursive: true, force: true });
      } else {
        await unlinkIgnoringMissing(safePath);
      }
    } else {
      this.logger.warn(`跳过无法解析或不在允许目录内的路径 path=${job.path}`);
    }
    await this.events.emitUnlinked(job);
  }

  private resolveSafePath(target: string): string | null {
    const roots: string[] = [];
    try {
      roots.push(getStaticFileRoot());
    } catch {
      // 静态目录未配置时仍允许清理备份目录
    }
    const backupDir =
      this.configService.get<string>('dbBackup.dir') ||
      this.configService.get<string>('DB_BACKUP_DIR');
    if (backupDir) {
      roots.push(backupDir);
      roots.push(resolve(backupDir));
    }
    for (const root of roots) {
      const safePath = tryResolvePathInsideRoot(root, target);
      if (safePath) return safePath;
    }
    return null;
  }
}

async function unlinkIgnoringMissing(path: string) {
  try {
    await fs.unlink(path);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return;
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
