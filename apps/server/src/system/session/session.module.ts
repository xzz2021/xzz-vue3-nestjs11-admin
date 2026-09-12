import { SessionRevocationService } from "#/system/auth/session-revocation.service.js";
import { RtTokenService } from "#/system/auth/rt.token.service.js";
import { TokenService } from "#/system/auth/token.service.js";
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { SessionEventBus } from "./session.events.js";

@Module({
  imports: [JwtModule.register({})],
  providers: [
    SessionEventBus,
    TokenService,
    RtTokenService,
    SessionRevocationService,
  ],
  exports: [
    JwtModule,
    SessionEventBus,
    TokenService,
    RtTokenService,
    SessionRevocationService,
  ],
})
export class SessionModule {}
