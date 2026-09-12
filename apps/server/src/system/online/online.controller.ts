import { RequiredPermission, User } from "#/processor/decorator/index.js";
import type { JwtUser } from "#/system/auth/dto/auth.dto.js";
import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { createZodDto } from "nestjs-zod/dto";
import { z } from "zod";
import { OnlineGateway } from "./online.gateway.js";
import { OnlineService } from "./online.service.js";

const KickByJtiSchema = z.object({
  jti: z.string().min(1),
  userId: z.string().min(1),
});
class KickByJtiDto extends createZodDto(KickByJtiSchema) {}

const KickByUserSchema = z.object({
  userId: z.string().min(1),
});
class KickByUserDto extends createZodDto(KickByUserSchema) {}

@ApiTags("在线用户")
@Controller("online")
export class OnlineController {
  constructor(
    private readonly onlineService: OnlineService,
    private readonly onlineGateway: OnlineGateway,
  ) {}

  @Get("list")
  @RequiredPermission("onlineUser:view")
  @ApiOperation({ summary: "在线用户列表" })
  async list(
    @Query("keyword") keyword: string | undefined,
    @User() user: JwtUser,
  ) {
    const data = await this.onlineService.list(keyword, user.id);
    return { ...data, message: "获取在线用户成功" };
  }

  @Post("kick")
  @RequiredPermission("onlineUser:kick")
  @ApiOperation({ summary: "强制下线指定会话（排除自身与超管）" })
  async kick(@Body() body: KickByJtiDto, @User() user: JwtUser) {
    const jtis = await this.onlineService.terminateSessionByOperator(
      { id: user.id, jti: user.jti },
      body,
    );
    this.onlineGateway.notifyForceLogout(jtis, "kicked");
    return { message: "已强制该会话下线", jti: body.jti };
  }

  @Post("kickUser")
  @RequiredPermission("onlineUser:kick")
  @ApiOperation({ summary: "强制下线用户全部会话（排除自身与超管）" })
  async kickUser(@Body() body: KickByUserDto, @User() user: JwtUser) {
    const jtis = await this.onlineService.terminateUserByOperator(
      user.id,
      body.userId,
    );
    this.onlineGateway.notifyForceLogout(jtis, "kicked");
    this.onlineGateway.notifyForceLogoutByUser(body.userId, "kicked");
    return {
      message: "已强制用户全部下线",
      userId: body.userId,
      count: jtis.length,
    };
  }
}
