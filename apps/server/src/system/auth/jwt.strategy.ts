import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";

@Injectable()
//  Strategy默认值为'jwt',  如果需要多个strategyextends 则需要使用不同的name   否则会覆写
//  export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("token.secret") as string,
    });
  }

  validate(payload: any) {
    // console.log('xzz2021: JwtStrategy -> validate -> payload:', payload);
    // 此处用于返回需要挂载到 所有走jwtguard的接口中 使用 @Request  req.user  的数据
    return payload;
  }
}
