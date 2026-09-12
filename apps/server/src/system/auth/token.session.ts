import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import {
  SessionRegistry,
  type SessionRegistryOptions,
} from './session-registry.js';

export interface TokenAppConfig {
  secret: string;
  refreshSecret: string;
  expiresTime: number;
  refreshExpiresTime: number;
}

export const ACCESS_SESSION_KEYS = {
  listPrefix: 'user:sessions:',
  expiryPrefix: 'session:exp:',
  blacklistPrefix: 'jwt:blacklist:',
  lockPrefix: 'user:sessions:lock:',
} as const;

export const REFRESH_SESSION_KEYS = {
  listPrefix: 'user:cookies:',
  expiryPrefix: 'cookies:exp:',
  blacklistPrefix: 'rt:jwt:blacklist:',
  lockPrefix: 'user:cookies:lock:',
} as const;

export abstract class TokenSessionService {
  protected readonly sessions: SessionRegistry;

  protected constructor(
    protected readonly jwt: JwtService,
    redis: Redis,
    options: SessionRegistryOptions,
  ) {
    this.sessions = new SessionRegistry(redis, options);
  }

  protected signJwt(
    payload: Record<string, unknown>,
    secret: string,
    expiresIn: number,
    jwtid: string,
  ) {
    return this.jwt.signAsync(payload, { expiresIn, jwtid, secret });
  }

  async revoke(userId: string, jti: string) {
    await this.sessions.revoke(userId, jti);
  }

  async revokeAll(userId: string, exceptJti?: string) {
    await this.sessions.revokeAll(userId, exceptJti);
  }

  async blacklistByJti(jti: string, exp: number) {
    await this.sessions.blacklist(jti, exp);
  }

  async isBlacklisted(jti: string): Promise<boolean> {
    return this.sessions.isBlacklisted(jti);
  }

  async listSessions(userId: string) {
    return this.sessions.listSessions(userId);
  }

  async logout(userId: string, jti: string) {
    await this.revoke(userId, jti);
    return { ok: true };
  }
}
