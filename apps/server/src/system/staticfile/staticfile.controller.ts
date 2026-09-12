import { RequiredPermission } from "#/processor/decorator/index.js";
import { Serialize } from "#/processor/decorator/serialize.js";
import type { JwtReqDto } from "#/system/auth/dto/auth.dto.js";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { createReadStream } from "fs";
import { join } from "path";
import { InitiateUploadDto } from "./file-upload.dto.js";
import { FileUploadService } from "./file-upload.service.js";
import { DeleteFileDto, FileListResDto } from "./file.dto.js";
import {
  generateChunkMulterConfig,
  generateMulterConfig,
} from "./multer.config.js";
import { StaticfileService } from "./staticfile.service.js";

const chunkMulter = generateChunkMulterConfig(
  parseInt(process.env.FILE_UPLOAD_CHUNK_BYTES || "5242880", 10),
);

@ApiTags("静态文件")
@Controller("staticfile")
export class StaticfileController {
  private readonly staticFileServeRoot;

  constructor(
    private readonly staticfileService: StaticfileService,
    private readonly fileUploadService: FileUploadService,
    private readonly configService: ConfigService,
  ) {
    this.staticFileServeRoot = this.configService.get<string>(
      "staticFileServeRoot",
    );
  }
  //  流文件
  @Get("steamfile")
  @RequiredPermission("fileList:view")
  //  形式为 直接下载
  getFile2(): StreamableFile {
    const file = createReadStream(join(process.cwd(), "package.json"));
    // 设置文件名
    return new StreamableFile(file, {
      disposition: 'attachment; filename="package.json"',
      type: "application/json",
    });
  }

  @Get("steamfile2")
  @RequiredPermission("fileList:view")
  @Header("Content-Type", "application/json")
  @Header("Content-Disposition", 'attachment; filename="package.json"')
  getFile3(): StreamableFile {
    const file = createReadStream(join(process.cwd(), "package.json"));
    // 设置文件名
    return new StreamableFile(file);
  }

  //  内置静态文件管理
  @Get("list")
  @RequiredPermission("fileList:view")
  @Serialize(FileListResDto)
  getFileList() {
    return this.staticfileService.getFileList();
  }

  @Post("uploads/initiate")
  @RequiredPermission("fileList:add")
  @ApiOperation({ summary: "初始化大文件上传 / 秒传 / 续传" })
  initiateUpload(@Body() body: InitiateUploadDto, @Req() req: JwtReqDto) {
    return this.fileUploadService.initiate(req.user.id, body);
  }

  @Put("uploads/:id/chunks/:index")
  @RequiredPermission("fileList:add")
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  @ApiOperation({ summary: "上传文件分片" })
  @UseInterceptors(FileInterceptor("chunk", chunkMulter))
  uploadChunk(
    @Param("id") id: string,
    @Param("index", ParseIntPipe) index: number,
    @UploadedFile() chunk: Express.Multer.File,
    @Req() req: JwtReqDto,
  ) {
    if (!chunk?.buffer) {
      throw new BadRequestException("分片不存在");
    }
    return this.fileUploadService.uploadChunk(
      req.user.id,
      id,
      index,
      chunk.buffer,
    );
  }

  @Get("uploads/:id")
  @RequiredPermission("fileList:view")
  @ApiOperation({ summary: "查询上传会话" })
  getUploadSession(@Param("id") id: string, @Req() req: JwtReqDto) {
    return this.fileUploadService.getSession(req.user.id, id);
  }

  @Post("uploads/:id/complete")
  @RequiredPermission("fileList:add")
  @ApiOperation({ summary: "完成分片上传" })
  completeUpload(@Param("id") id: string, @Req() req: JwtReqDto) {
    return this.fileUploadService.complete(req.user.id, id);
  }

  @Post("uploads/:id/abort")
  @RequiredPermission("fileList:add")
  @ApiOperation({ summary: "取消上传" })
  abortUpload(@Param("id") id: string, @Req() req: JwtReqDto) {
    return this.fileUploadService.abort(req.user.id, id);
  }

  //  上传文件
  @Post("upload")
  @RequiredPermission("fileList:add")
  @ApiOperation({ summary: "上传文件" })
  @UseInterceptors(FileInterceptor("file", generateMulterConfig("file/manage")))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("文件不存在");
    }

    const fileExt = file.filename.split(".").pop() || ""; // 文件扩展名
    const { filename, path } = file;
    const url = `${this.staticFileServeRoot}/file/manage/${filename}`;
    const size = file.size; // 文件大小
    return this.staticfileService.uploadFile({
      name: filename,
      mimeType: file.mimetype,
      path,
      size,
      url,
      extension: fileExt,
    });
  }

  //  删除文件
  @Delete("delete")
  @RequiredPermission("fileList:delete")
  deleteFile(@Body() body: DeleteFileDto) {
    return this.staticfileService.deleteFile(body.ids);
  }
}
