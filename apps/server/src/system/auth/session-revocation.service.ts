import {
  SessionEventBus,
  SESSION_EVENTS,
} from "@/system/session/session.events.js";
import { BadRequestException, Injectable } from "@nestjs/common";

import { RtTokenService } from "./rt.token.service.js";
import { TokenService } from "./token.service.js";

@Injectable()
export class SessionRevocationService {
  constructor(
    private readonly tokenService: TokenService,
    private readonly rtTokenService: RtTokenService,
    private readonly events: SessionEventBus,
  ) {}

  /** 改密 / 禁用 / 删除：吊销全部会话，由 Presence 监听器清理在线态并通知 WS */
  async revokeAll(
    userId: string,
    reason: "revoked" | "forced" = "revoked",
  ): Promise<void> {
    await Promise.all([
      this.tokenService.revokeAll(userId),
      this.rtTokenService.revokeAll(userId),
    ]);
    await this.events.emit(SESSION_EVENTS.USER_REVOKED, { userId, reason });
  }

  /** 主动登出 / refresh 轮换：只清指定会话的 presence */
  async endSession(jti: string): Promise<void> {
    await this.events.emit(SESSION_EVENTS.SESSION_ENDED, { jti });
  }

  /** 管理端强制下线：Presence 监听器负责校验、吊销与通知；无监听器时显式失败 */
  async requestForceLogout(
    operatorId: string,
    targetUserId: string,
  ): Promise<void> {
    const results = await this.events.emit(
      SESSION_EVENTS.FORCE_LOGOUT_REQUESTED,
      {
        operatorId,
        targetUserId,
      },
    );
    if (!results.length) {
      throw new BadRequestException("在线用户模块不可用");
    }
  }
}
