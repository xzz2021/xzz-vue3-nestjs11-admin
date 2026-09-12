import { AuditAction } from '@/core/logger/audit-action.js';
import { AuditLogService } from '@/core/logger/audit-log.service.js';
import { isTransientDbError } from '@/processor/filter/prisma.exception.js';
import { hashPayPassword, verifyPayPassword } from '@/processor/utils/index.js';
import { UserRepository } from '@/system/user/user.repository.js';
import { RedisService } from '@liaoliaots/nestjs-redis';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import { LoginInfoDto, RegisterDto } from './dto/auth.dto.js';
import { LockoutService } from './lockout.service.js';
import { RtTokenService } from './rt.token.service.js';
import { SessionRevocationService } from './session-revocation.service.js';
import { TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  private readonly redis: Redis;
  private wxAppSecret: string;
  private wxAppId: string;
  constructor(
    private readonly users: UserRepository,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly tokenService: TokenService,
    private readonly rtTokenService: RtTokenService,
    private readonly sessions: SessionRevocationService,
    private readonly lockout: LockoutService,
    private readonly audit: AuditLogService,
  ) {
    const wechat = this.configService.get<{ appId: string; appSecret: string }>(
      'wechat',
    );
    this.wxAppSecret = wechat?.appSecret || '';
    this.wxAppId = wechat?.appId || '';
    this.redis = this.redisService.getOrThrow();
  }

  async create(
    createUserDto: RegisterDto,
    checkCode: boolean = true,
    ip?: string,
  ): Promise<{ message: string; res?: { id: string } }> {
    const { phone, password, username } = createUserDto;
    const user = await this.isUserExist(phone);
    if (user) {
      throw new ConflictException(phone + '手机号已存在');
    }

    // 注册前需要请求验证码 请求时已经将验证码存入cache  此处比对验证码 是否正确
    // if (checkCode) {
    //   // if 是为了复用create方法
    //   const smsCheck = await this.smsService.checkSmsCode('register_' + phone, code);
    //   if (!smsCheck.status) return smsCheck;
    // }

    const hashedPassword = await hashPayPassword(password);
    const res = await this.users.createRegistered({
      phone,
      username,
      password: hashedPassword,
    });
    await this.redis.del('register_' + phone); // 删除缓存的 验证码
    await this.audit.record({
      actorId: res.id,
      action: AuditAction.AUTH_REGISTER,
      resource: 'User',
      resourceId: res.id,
      ip,
      metadata: { phone, username },
    });
    return { message: phone + '注册成功', res };
  }

  private async getUserForLogin(phone: string) {
    const user = await this.users.findEnabledByPhoneForLogin(phone);
    return user;
  }

  async rtLogin(loginInfo: LoginInfoDto, ip: string) {
    try {
      await this.lockout.ensureNotLocked(loginInfo.phone);
    } catch (error) {
      await this.audit.record({
        action: AuditAction.AUTH_LOCKOUT,
        resource: 'Auth',
        success: false,
        ip,
        metadata: { phone: loginInfo.phone, reason: 'already_locked' },
      });
      throw error;
    }

    const user = await this.getUserForLogin(loginInfo.phone);
    if (!user) {
      await this.recordLoginFailure(loginInfo.phone, ip, null, 'unknown_user');
      throw new BadRequestException('账号或密码错误');
    }

    const ok = await verifyPayPassword(user.password, loginInfo.password);
    if (!ok) {
      await this.recordLoginFailure(
        loginInfo.phone,
        ip,
        user.id,
        'bad_password',
      );
      throw new BadRequestException('账号或密码错误');
    }

    await this.lockout.onSuccess(loginInfo.phone);
    await this.users.recordLoginSuccess(user.id, ip);
    await this.audit.record({
      actorId: user.id,
      action: AuditAction.AUTH_LOGIN,
      resource: 'User',
      resourceId: user.id,
      ip,
      metadata: { phone: user.phone },
    });

    const { password, ...result } = user;
    const { username, phone, id, roles } = result;
    const { accessToken, cookie } = await this.rtTokenService.signToken(id, {
      username,
      phone,
      id,
      roles: roles.map((item) => item.role),
    });
    /*
      注意使用res设置cookie后   直接返回数据是无效的
      1. 使用return res.status(200).json({ accessToken });
      2. 使用@Res({ passthrough: true }), 让 Nest 继续负责序列化（JSON）, 因为NestJS接管了响应

      */
    return {
      cookie,
      body: {
        message: `${username}登录成功`,
        userinfo: result,
        access_token: accessToken,
      },
    };
  }

  async isUserExist(phone: string) {
    const user = await this.users.findIdByPhone(phone);
    return !!user;
  }

  // async updateTokenVersion(phone: string) {
  //   const tokenVersionKey = 'tokenVersion_' + phone;
  //   const tokenVersion = (await this.redis.get(tokenVersionKey)) as number;
  //   const newTokenVersion = tokenVersion ? tokenVersion + 1 : 1;
  //   await this.redis.set(
  //     tokenVersionKey,
  //     newTokenVersion,
  //     //  过期时间与token的过期时间一致
  //     this.configService.get<number>('TOKEN_VERSION_EXPIRES_IN', 1000 * 60 * 60 * 24 * 3),
  //   );
  //   return newTokenVersion;
  // }

  async getSmsCode(phone: string, cachekey: string) {
    if (cachekey === 'register') {
      const user = await this.isUserExist(phone);
      if (user) {
        throw new BadRequestException('用户已存在, 请直接登录!');
      }
    }
    return { message: '演示模式, 模拟验证码已发送,请60秒后再试!' };
    // return this.smsService.generateSmsCode(phone, cachekey);
  }

  async forceLogout(id: string, operatorId: string, ip?: string) {
    if (!operatorId) {
      throw new BadRequestException('缺少操作者信息');
    }
    await this.sessions.requestForceLogout(operatorId, id);
    await this.audit.record({
      actorId: operatorId,
      action: AuditAction.AUTH_FORCE_LOGOUT,
      resource: 'User',
      resourceId: id,
      ip,
    });
    return { message: '强制用户下线成功', id };
  }

  async logout(id: string, jti: string, ip?: string) {
    await Promise.all([
      this.tokenService.logout(id, jti),
      this.rtTokenService.logout(id, jti),
    ]);
    await this.sessions.endSession(jti);
    await this.audit.record({
      actorId: id,
      action: AuditAction.AUTH_LOGOUT,
      resource: 'User',
      resourceId: id,
      ip,
    });
    return {
      cookie: this.rtTokenService.describeClearCookie(),
      body: { message: '退出登录成功', id },
    };
  }

  private async recordLoginFailure(
    phone: string,
    ip: string,
    actorId: string | null,
    reason: string,
  ) {
    try {
      await this.lockout.onFail(phone);
    } catch (error) {
      await this.audit.record({
        actorId,
        action: AuditAction.AUTH_LOCKOUT,
        resource: 'Auth',
        resourceId: actorId,
        success: false,
        ip,
        metadata: { phone, reason: 'threshold' },
      });
      throw error;
    }
    await this.audit.record({
      actorId,
      action: AuditAction.AUTH_LOGIN_FAILED,
      resource: 'Auth',
      resourceId: actorId,
      success: false,
      ip,
      metadata: { phone, reason },
    });
  }

  async rtRefresh(userId: string, oldJti: string) {
    // 会话有效性已由 JwtRefreshAuthGuard（Redis）校验；
    // DB 仅用于刷新用户资料。库瞬时不可用时仍换发短 token，避免全站被误判为 401。
    let extraPayload: Record<string, unknown> = { id: userId };
    try {
      const user = await this.users.findByIdForRefresh(userId);
      if (!user || !user.enabled) {
        throw new UnauthorizedException('用户不存在或已禁用');
      }
      const { username, phone, id, roles } = user;
      extraPayload = {
        username,
        phone,
        id,
        roles: roles.map((item) => item.role),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if (!isTransientDbError(error)) throw error;
    }

    const { accessToken, cookie } = await this.rtTokenService.signToken(
      userId,
      extraPayload,
      oldJti,
    );
    // refresh 会轮换 jti：清理旧 presence，避免同一用户短暂双记录
    await this.sessions.endSession(oldJti);
    return {
      cookie,
      body: { access_token: accessToken, message: '获取新的token成功' },
    };
  }
}
