import { Authenticated, Public, RequiredPermission, Serialize } from "#/processor/decorator/index.js";
import { CaptchaGuard, JwtRefreshAuthGuard } from "#/processor/guard/index.js";
import { clientIp } from "#/processor/utils/index.js";
import { Body, Controller, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import type { JwtReqDto } from "./dto/auth.dto.js";
import {
  ForceLogoutDto,
  ForgotPasswordDto,
  GetSmsCodeDto,
  LoginInfoDto,
  RegisterDto,
  RegisterResDto,
} from "./dto/auth.dto.js";
import { applyCookieCommand } from "./http-cookie.js";

@ApiTags("帐号权限")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Public()
  @Serialize(RegisterResDto)
  @ApiOperation({ summary: "用户注册" })
  create(@Body() createUserinfo: RegisterDto, @Req() req: Request) {
    return this.authService.create(createUserinfo, true, clientIp(req.ip));
  }

  @Post("getSmsCode")
  @Public()
  @ApiOperation({ summary: "发送短信验证码（演示模式）" })
  getSmsCode(@Body() body: GetSmsCodeDto) {
    return this.authService.getSmsCode(body.phone, body.type);
  }

  @Post("forgot-password")
  @Public()
  @ApiOperation({ summary: "忘记密码：短信验证码重置" })
  forgotPassword(@Body() body: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(body, clientIp(req.ip));
  }

  @Post("rt/login")
  @Public()
  @ApiOperation({ summary: "用户登录(refreshToken版本)" })
  @UseGuards(CaptchaGuard)
  async rtLogin(
    @Body() loginInfo: LoginInfoDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { body, cookie } = await this.authService.rtLogin(
      loginInfo,
      clientIp(req.ip) ?? "",
    );
    applyCookieCommand(res, cookie);
    return body;
  }

  @Post("refresh")
  @Public()
  @UseGuards(JwtRefreshAuthGuard)
  async refresh(
    @Req() req: JwtReqDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { id: userId, jti: oldJti } = req.user;
    const { body, cookie } = await this.authService.rtRefresh(userId, oldJti);
    applyCookieCommand(res, cookie);
    return body;
  }

  @Post("logout")
  @Authenticated()
  @ApiOperation({ summary: "用户主动退出登录" })
  async logout(
    @Body() body: ForceLogoutDto,
    @Req() req: JwtReqDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { body: result, cookie } = await this.authService.logout(
      body.id,
      req.user.jti,
      clientIp(req.ip),
    );
    applyCookieCommand(res, cookie);
    return result;
  }

  @Post("forceLogout")
  @RequiredPermission("user:update")
  @ApiOperation({ summary: "强制用户下线" })
  forceLogout(@Body() body: ForceLogoutDto, @Req() req: JwtReqDto) {
    return this.authService.forceLogout(body.id, req.user.id, clientIp(req.ip));
  }
}
