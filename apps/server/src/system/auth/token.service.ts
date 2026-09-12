import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import {
  ACCESS_SESSION_KEYS,
  TokenSessionService,
  type TokenAppConfig,
} from './token.session.js';

@Injectable()
export class TokenService extends TokenSessionService {
  private readonly tokenConfig: TokenAppConfig;

  constructor(
    jwt: JwtService,
    redisService: RedisService,
    configService: ConfigService,
  ) {
    const tokenConfig = configService.get<TokenAppConfig>('token') ?? {
      secret: '',
      refreshSecret: '',
      expiresTime: 60 * 60 * 24 * 7,
      refreshExpiresTime: 120,
    };
    super(jwt, redisService.getOrThrow(), {
      ...ACCESS_SESSION_KEYS,
      ttlSeconds: tokenConfig.expiresTime,
      maxSessions: configService.get<number>('ssoCount') ?? 2,
    });
    this.tokenConfig = tokenConfig;
  }

  async issue(userId: string, extraPayload: Record<string, unknown> = {}) {
    const jti = randomUUID();
    const exp = Math.floor(Date.now() / 1000) + this.tokenConfig.expiresTime;
    const token = await this.signJwt(
      { sub: userId, ...extraPayload },
      this.tokenConfig.secret,
      this.tokenConfig.expiresTime,
      jti,
    );
    await this.sessions.register(userId, jti, exp);
    return { jti, exp, token };
  }

  async signToken(userId: string, extraPayload: Record<string, unknown> = {}) {
    return (await this.issue(userId, extraPayload)).token;
  }
}
