import {
  Authenticated,
  RequiredPermission,
  SkipWrap,
} from "#/processor/decorator/index.js";
import { clientIp } from "#/processor/utils/index.js";
import { sendCsvStream } from "#/processor/utils/csv-download.js";
import type { JwtReqDto } from "#/system/auth/dto/auth.dto.js";
import {
  multerConfigForAvatar,
  multerConfigForCsvImport,
} from "#/system/staticfile/multer.config.js";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import type { Response } from "express";
import { Readable } from "node:stream";
import {
  AdminUpdatePwdDto,
  BatchDeleteUserDto,
  CreateUserDto,
  QueryUserParams,
  UpdatePersonalInfo,
  UpdatePwdDto,
  UpdateUserDto,
  UserListRes,
  UserLookupListRes,
} from "./dto/user.dto.js";
import { userImportTemplateCsv } from "./user.csv.js";
import { UserService } from "./user.service.js";

@ApiTags("用户")
@Controller("user")
export class UserController {
  constructor(
    private readonly userService: UserService,
  ) {}

  @Get("listByDepartmentId")
  @RequiredPermission("user:view")
  @ApiOperation({
    summary: "获取指定部门用户, 包含角色和部门id数组, 用于分配角色和部门",
  })
  @ApiResponse({ type: UserListRes })
  findBy(@Query() params: QueryUserParams) {
    return this.userService.findByDepartmentId(params);
  }

  @Get("lookup")
  @Authenticated()
  @ApiOperation({ summary: "获取用户精简选项, 用于负责人下拉" })
  @ApiResponse({ type: UserLookupListRes })
  lookup(@Query() params: QueryUserParams) {
    return this.userService.lookupByDepartment(params);
  }

  @Get("detailInfo")
  @Authenticated()
  @ApiOperation({ summary: "获取用户详情信息" })
  detailInfo(@Req() req: JwtReqDto) {
    const userId = req.user.id;
    return this.userService.getUserInfo(userId);
  }

  @Post("updatePersonalInfo")
  @Authenticated()
  @ApiOperation({ summary: "用户更新自己的个人信息" })
  updatePersonalInfo(
    @Body() updateUserinfo: UpdatePersonalInfo,
    @Req() req: JwtReqDto,
  ) {
    // 用户更新自己的信息  校验req.user
    if (req.user.id !== updateUserinfo.id) {
      throw new ForbiddenException("无权限更新他人信息");
    }
    return this.userService.updateInfo(updateUserinfo, clientIp(req.ip));
  }

  @Post("updatePassword")
  @Authenticated()
  @ApiOperation({ summary: "用户更新自己的密码" })
  updatePassword(
    @Body() updatePasswordDto: UpdatePwdDto,
    @Req() req: JwtReqDto,
  ) {
    // 用户更新自己的密码  校验req.user
    if (req.user.id !== updatePasswordDto.id) {
      throw new ForbiddenException("无权限更新他人密码");
    }
    return this.userService.updatePassword(updatePasswordDto, clientIp(req.ip));
  }

  // 管理员重置用户密码
  @Post("resetPassword")
  @RequiredPermission("user:update")
  @ApiOperation({ summary: "管理员重置用户密码" })
  resetPassword(
    @Body() updatePasswordDto: AdminUpdatePwdDto,
    @Req() req: JwtReqDto,
  ) {
    const operateId = req.user.id;
    if (!operateId) throw new BadRequestException("身份识别异常,没有权限");
    const { id, password } = updatePasswordDto;
    if (!id || !password) throw new BadRequestException("参数异常");
    return this.userService.resetPassword({
      id,
      password,
      operateId,
      ip: clientIp(req.ip),
    });
  }

  @Post("add")
  @RequiredPermission("user:add")
  @ApiOperation({ summary: "创建用户" })
  addUser(@Body() addUserinfoDto: CreateUserDto, @Req() req: JwtReqDto) {
    return this.userService.addUser(
      addUserinfoDto,
      req.user.id,
      clientIp(req.ip),
    );
  }

  @Post("update")
  @RequiredPermission("user:update")
  @ApiOperation({ summary: "更新用户" })
  update(@Body() updateData: UpdateUserDto, @Req() req: JwtReqDto) {
    return this.userService.update(updateData, req.user.id, clientIp(req.ip));
  }

  @Delete("delete")
  @RequiredPermission("user:delete")
  @ApiOperation({ summary: "批量删除用户" })
  delete(@Body() deleteUserData: BatchDeleteUserDto, @Req() req: JwtReqDto) {
    return this.userService.batchDeleteUser(
      deleteUserData.ids,
      req.user.id,
      clientIp(req.ip),
    );
  }

  @Get("list")
  @RequiredPermission("user:view")
  @ApiOperation({ summary: "按条件获取所有用户" })
  allList(@Query() params: QueryUserParams) {
    return this.userService.findAll(params);
  }

  @Get("export")
  @RequiredPermission("user:export")
  @SkipWrap()
  @ApiProduces("text/csv")
  @ApiOperation({ summary: "流式导出用户 CSV" })
  @ApiResponse({
    status: 200,
    description: "UTF-8 CSV 文件流",
    content: {
      "text/csv": {
        schema: { type: "string", format: "binary" },
      },
    },
  })
  async exportUsers(
    @Query() params: QueryUserParams,
    @Req() req: JwtReqDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const stream = await this.userService.exportUsers(
      params,
      req.user.id,
      clientIp(req.ip),
    );
    return sendCsvStream(req, response, stream, "users.csv");
  }

  @Get("import/template")
  @RequiredPermission("user:import")
  @SkipWrap()
  @ApiProduces("text/csv")
  @ApiOperation({ summary: "下载用户导入 CSV 模板" })
  importTemplate(
    @Req() req: JwtReqDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const stream = Readable.from([userImportTemplateCsv()]);
    return sendCsvStream(req, response, stream, "user-import-template.csv");
  }

  @Post("import")
  @RequiredPermission("user:import")
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "导入用户 CSV（逐行报告）" })
  @UseInterceptors(FileInterceptor("file", multerConfigForCsvImport))
  importUsers(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: JwtReqDto,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException("请上传 CSV 文件");
    }
    return this.userService.importUsers(
      file.buffer,
      req.user.id,
      clientIp(req.ip),
    );
  }

  @Post("upload/avatar")
  @Authenticated()
  @ApiOperation({ summary: "用户上传更新自己的头像" })
  @UseInterceptors(FileInterceptor("file", multerConfigForAvatar))
  uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: JwtReqDto,
  ) {
    if (!file) {
      throw new BadRequestException("文件不存在");
    }
    const userId = req.user.id;
    if (!userId) {
      throw new BadRequestException("身份识别异常");
    }
    return this.userService.uploadAvatar(file, userId, req.user.phone);
  }
}
