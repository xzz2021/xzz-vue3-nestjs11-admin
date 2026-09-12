import { FileCleanupModule } from "#/system/file-cleanup/file-cleanup.module.js";
import { Module } from "@nestjs/common";
import { FileRepository } from "./file.repository.js";
import { FileUploadRepository } from "./file-upload.repository.js";
import { FileUploadService } from "./file-upload.service.js";
import { StaticfileDiskListener } from "./staticfile-disk.listener.js";
import { StaticfileController } from "./staticfile.controller.js";
import { StaticfileService } from "./staticfile.service.js";

@Module({
  imports: [FileCleanupModule],
  controllers: [StaticfileController],
  providers: [
    FileRepository,
    FileUploadRepository,
    FileUploadService,
    StaticfileService,
    StaticfileDiskListener,
  ],
  exports: [StaticfileService],
})
export class StaticfileModule {}
