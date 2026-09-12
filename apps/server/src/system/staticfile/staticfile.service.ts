import { FileCleanupService } from '@/system/file-cleanup/file-cleanup.service.js';
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { UploadFileDto } from './file.dto.js';
import { FileRepository } from './file.repository.js';

@Injectable()
export class StaticfileService implements OnModuleInit {
  private readonly logger = new Logger(StaticfileService.name);

  constructor(
    private readonly files: FileRepository,
    private readonly fileCleanupService: FileCleanupService,
  ) {}

  async onModuleInit() {
    try {
      await this.reconcilePendingCleanup();
    } catch (error) {
      this.logger.warn(
        `待清理文件对账失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getFileList() {
    const [fileList, total] = await this.files.findActive();
    return {
      message: '文件列表获取成功',
      list: fileList.map((file) => this.toFileDto(file)),
      total,
    };
  }

  async uploadFile(file: UploadFileDto) {
    try {
      const fileData = await this.files.create({
        ...file,
        size: BigInt(file.size),
      });
      return { message: '文件上传成功', fileData: this.toFileDto(fileData) };
    } catch (error) {
      await this.fileCleanupService.enqueue([
        { kind: 'orphan-path', path: file.path },
      ]);
      throw error;
    }
  }

  async deleteFile(ids: number[]) {
    const fileList = await this.files.findActiveByIds(ids);
    if (fileList.length !== ids.length) {
      throw new BadRequestException('部分文件不存在');
    }
    await this.files.softDeleteByIds(ids);
    await this.fileCleanupService.enqueue(
      fileList.map((file) => ({
        kind: 'managed-file' as const,
        fileId: file.id,
        path: file.path,
      })),
    );
    return { message: '文件删除成功' };
  }

  async purgeAfterUnlink(fileId: number) {
    await this.files.purgeSoftDeleted(fileId);
  }

  async reconcilePendingCleanup() {
    const pending = await this.files.findPendingCleanup();
    await this.fileCleanupService.enqueue(
      pending.map((file) => ({
        kind: 'managed-file' as const,
        fileId: file.id,
        path: file.path,
      })),
    );
  }

  private toFileDto<T extends { size: bigint | number }>(file: T) {
    return { ...file, size: Number(file.size) };
  }
}
