import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import {
  RT_COOKIE_NAME,
  type CookieCommand,
  type CookieFlags,
} from './http-cookie.js';
import {
  REFRESH_SESSION_KEYS,
  TokenSessionService,
  type TokenAppConfig,
} from './token.session.js';

@Injectable()
export class RtTokenService extends TokenSessionService {
  private readonly tokenConfig: TokenAppConfig;

  constructor(
    jwt: JwtService,
    redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    const tokenConfig = configService.get<TokenAppConfig>('token') ?? {
      secret: '',
      refreshSecret: '',
      expiresTime: 60,
      refreshExpiresTime: 120,
    };
    super(jwt, redisService.getOrThrow(), {
      ...REFRESH_SESSION_KEYS,
      ttlSeconds: tokenConfig.refreshExpiresTime,
      maxSessions: configService.get<number>('ssoCount') ?? 2,
    });
    this.tokenConfig = tokenConfig;
  }

  async issue(
    userId: string,
    extraPayload: Record<string, unknown> = {},
    oldJti?: string,
  ) {
    const jti = randomUUID();
    const refreshExp =
      Math.floor(Date.now() / 1000) + this.tokenConfig.refreshExpiresTime;
    const [accessToken, refreshToken] = await Promise.all([
      this.signJwt(
        { sub: userId, id: userId, ...extraPayload },
        this.tokenConfig.secret,
        this.tokenConfig.expiresTime,
        jti,
      ),
      this.signJwt(
        { id: userId },
        this.tokenConfig.refreshSecret,
        this.tokenConfig.refreshExpiresTime,
        jti,
      ),
    ]);

    await this.sessions.register(userId, jti, refreshExp, oldJti);
    return {
      jti,
      exp: refreshExp,
      accessToken,
      refreshToken,
      cookie: this.describeSetCookie(refreshToken),
    };
  }

  describeSetCookie(refreshToken: string): CookieCommand {
    return {
      action: 'set',
      name: RT_COOKIE_NAME,
      value: refreshToken,
      options: {
        ...this.rtCookieBase(),
        maxAge: this.tokenConfig.refreshExpiresTime * 1000,
      },
    };
  }

  describeClearCookie(): CookieCommand {
    return {
      action: 'clear',
      name: RT_COOKIE_NAME,
      options: this.rtCookieBase(),
    };
  }

  async signToken(
    userId: string,
    extraPayload: Record<string, unknown> = {},
    oldJti?: string,
  ) {
    const { accessToken, cookie } = await this.issue(
      userId,
      extraPayload,
      oldJti,
    );
    return { accessToken, cookie };
  }

  private rtCookieBase(): CookieFlags {
    return {
      httpOnly: true,
      secure: this.configService.get<boolean>('isProduction') ?? false,
      sameSite: 'lax',
      path: '/',
    };
  }
}
