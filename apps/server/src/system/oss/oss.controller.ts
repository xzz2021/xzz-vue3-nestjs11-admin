import { RequiredPermission } from "#/processor/decorator/index.js";
import { Body, Controller, Delete, Get, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  AbortMultipartDto,
  ArchiveQueryDto,
  CompleteMultipartDto,
  CopyObjectsDto,
  CreateFolderDto,
  DeleteObjectsDto,
  InitiateMultipartDto,
  ListObjectsQueryDto,
  MultipartPartsQueryDto,
  PresignGetQueryDto,
  PresignPartQueryDto,
  PresignPutDto,
} from "./oss.dto.js";
import { OssService } from "./oss.service.js";

@ApiTags("OSS")
@Controller("oss")
export class OssController {
  constructor(private readonly ossService: OssService) {}

  @Get("config")
  @RequiredPermission("oss:view")
  @ApiOperation({ summary: "OSS 公开配置" })
  getConfig() {
    return this.ossService.getPublicConfig();
  }

  @Get("objects")
  @RequiredPermission("oss:view")
  @ApiOperation({ summary: "列出当前前缀一层对象" })
  listObjects(@Query() query: ListObjectsQueryDto) {
    return this.ossService.listObjects(query);
  }

  @Get("objects/presign")
  @RequiredPermission("oss:view")
  @ApiOperation({ summary: "预签名 GET" })
  presignGet(@Query() query: PresignGetQueryDto) {
    return this.ossService.presignGet(query);
  }

  @Post("folders")
  @RequiredPermission("oss:add")
  @ApiOperation({ summary: "创建文件夹" })
  createFolder(@Body() body: CreateFolderDto) {
    return this.ossService.createFolder(body);
  }

  @Post("uploads/presign")
  @RequiredPermission("oss:add")
  @ApiOperation({ summary: "小文件预签名 PUT" })
  presignPut(@Body() body: PresignPutDto) {
    return this.ossService.presignPut(body);
  }

  @Post("uploads/multipart")
  @RequiredPermission("oss:add")
  @ApiOperation({ summary: "初始化分片上传" })
  initiateMultipart(@Body() body: InitiateMultipartDto) {
    return this.ossService.initiateMultipart(body);
  }

  @Get("uploads/multipart/parts")
  @RequiredPermission("oss:add")
  @ApiOperation({ summary: "列出已上传分片" })
  listMultipartParts(@Query() query: MultipartPartsQueryDto) {
    return this.ossService.listMultipartParts(query);
  }

  @Get("uploads/multipart/presign-part")
  @RequiredPermission("oss:add")
  @ApiOperation({ summary: "分片预签名 PUT" })
  presignPart(@Query() query: PresignPartQueryDto) {
    return this.ossService.presignPart(query);
  }

  @Post("uploads/multipart/complete")
  @RequiredPermission("oss:add")
  @ApiOperation({ summary: "完成分片上传" })
  completeMultipart(@Body() body: CompleteMultipartDto) {
    return this.ossService.completeMultipart(body);
  }

  @Post("uploads/multipart/abort")
  @RequiredPermission("oss:add")
  @ApiOperation({ summary: "取消分片上传" })
  abortMultipart(@Body() body: AbortMultipartDto) {
    return this.ossService.abortMultipart(body);
  }

  @Post("objects/copy")
  @RequiredPermission("oss:add")
  @ApiOperation({ summary: "重命名或移动对象" })
  copyObjects(@Body() body: CopyObjectsDto) {
    return this.ossService.copyObjects(body);
  }

  @Delete("objects")
  @RequiredPermission("oss:delete")
  @ApiOperation({ summary: "删除对象或文件夹" })
  deleteObjects(@Body() body: DeleteObjectsDto) {
    return this.ossService.deleteObjects(body);
  }

  @Get("folders/archive")
  @RequiredPermission("oss:view")
  @ApiOperation({ summary: "打包下载文件夹" })
  archiveFolder(@Query() query: ArchiveQueryDto) {
    return this.ossService.archiveFolder(query);
  }
}
