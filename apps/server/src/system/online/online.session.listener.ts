import {
  SESSION_EVENTS,
  SessionEventBus,
  type ForceLogoutRequestedPayload,
  type SessionEndedPayload,
  type SessionUserRevokedPayload,
} from "#/system/session/session.events.js";
import { Injectable, OnModuleInit } from "@nestjs/common";
import { OnlineGateway } from "./online.gateway.js";
import { OnlineService } from "./online.service.js";

@Injectable()
export class OnlineSessionListener implements OnModuleInit {
  constructor(
    private readonly events: SessionEventBus,
    private readonly onlineService: OnlineService,
    private readonly onlineGateway: OnlineGateway,
  ) {}

  onModuleInit(): void {
    this.events.on(
      SESSION_EVENTS.USER_REVOKED,
      (payload: SessionUserRevokedPayload) => this.onUserRevoked(payload),
    );
    this.events.on(
      SESSION_EVENTS.SESSION_ENDED,
      (payload: SessionEndedPayload) => this.onSessionEnded(payload),
    );
    this.events.on(
      SESSION_EVENTS.FORCE_LOGOUT_REQUESTED,
      (payload: ForceLogoutRequestedPayload) =>
        this.onForceLogoutRequested(payload),
    );
  }

  private async onUserRevoked(
    payload: SessionUserRevokedPayload,
  ): Promise<string[]> {
    const jtis = await this.onlineService.removeByUserId(payload.userId);
    this.onlineGateway.notifyForceLogout(jtis, payload.reason);
    this.onlineGateway.notifyForceLogoutByUser(payload.userId, payload.reason);
    return jtis;
  }

  private async onSessionEnded(payload: SessionEndedPayload): Promise<void> {
    await this.onlineService.remove(payload.jti);
  }

  private async onForceLogoutRequested(
    payload: ForceLogoutRequestedPayload,
  ): Promise<string[]> {
    const jtis = await this.onlineService.terminateUserByOperator(
      payload.operatorId,
      payload.targetUserId,
    );
    this.onlineGateway.notifyForceLogout(jtis, "forced");
    this.onlineGateway.notifyForceLogoutByUser(payload.targetUserId, "forced");
    return jtis;
  }
}
