import { Injectable } from "@nestjs/common";
import { EventEmitter } from "node:events";

export const SESSION_EVENTS = {
  USER_REVOKED: "session.user-revoked",
  SESSION_ENDED: "session.ended",
  FORCE_LOGOUT_REQUESTED: "session.force-logout",
} as const;

export type SessionRevokeReason = "revoked" | "forced";

export interface SessionUserRevokedPayload {
  userId: string;
  reason: SessionRevokeReason;
}

export interface SessionEndedPayload {
  jti: string;
}

export interface ForceLogoutRequestedPayload {
  operatorId: string;
  targetUserId: string;
}

@Injectable()
export class SessionEventBus {
  private readonly emitter = new EventEmitter();

  on<T>(event: string, handler: (payload: T) => unknown): void {
    this.emitter.on(event, handler);
  }

  async emit<T>(event: string, payload: T): Promise<unknown[]> {
    const listeners = this.emitter.listeners(event) as Array<
      (payload: T) => unknown
    >;
    if (!listeners.length) return [];
    return Promise.all(
      listeners.map((listener) => Promise.resolve(listener(payload))),
    );
  }
}
