import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import type { Request } from "express";
import { ExtractJwt, Strategy } from "passport-jwt";

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.rt || null,
      ]), // 从请求体中取refreshToken
      // 密匙如果对不上 会直接报错 user返回false
      secretOrKey: configService.get<string>("token.refreshSecret") as string,
      // passReqToCallback: true,
    });
  }

  validate(payload: any) {
    // console.log('xzz2021: JwtRefreshStrategy -> validate -> payload:', payload);
    return payload;
    // const refreshToken = req.cookies?.rt;
    // if (!refreshToken) {
    //   throw new UnauthorizedException('Refresh token missing');
    // }
    // 这里可校验refreshToken是否在数据库中有效，略
    // return { userId: payload.sub, username: payload.username, refreshToken };
  }
}
