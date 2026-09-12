import { RequiredPermission } from "@/processor/decorator/index.js";
import { clientIp } from "@/processor/utils/index.js";
import type { JwtReqDto } from "@/system/auth/dto/auth.dto.js";
import { multerConfigForAvatar } from "@/system/staticfile/multer.config.js";
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
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
// import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
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
import { UserService } from "./user.service.js";
@ApiTags("用户")
@Controller("user")
export class UserController {
  constructor(
    private readonly userService: UserService,
    // private readonly configService: ConfigService,
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
  @ApiOperation({ summary: "获取用户精简选项, 用于负责人下拉" })
  @ApiResponse({ type: UserLookupListRes })
  lookup(@Query() params: QueryUserParams) {
    return this.userService.lookupByDepartment(params);
  }

  @Get("detailInfo")
  @ApiOperation({ summary: "获取用户详情信息" })
  // @ApiResponse({ type: UpdateUserDto })
  detailInfo(@Req() req: JwtReqDto) {
    const userId = req.user.id;
    return this.userService.getUserInfo(userId);
  }

  @Post("updatePersonalInfo")
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

  @Post("upload/avatar")
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
