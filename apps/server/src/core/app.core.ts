import { PrismaModule } from '#/infrastructure/database/prisma/prisma.module.js';
import {
  GlobalThrottlerGuard,
  PermissionGuard,
  RtJwtAuthGuard,
} from '#/processor/guard/index.js';
import { StaticfileModule } from '#/system/staticfile/staticfile.module.js';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { CONFIG_MODULE } from './config.js';
import { SERVER_STATIC_MODULE } from './server.static.js';
// import { ClsModule } from 'nestjs-cls';
import { WinstonLoggerModule } from '#/core/logger/winston.module.js';
import { AllExceptionsFilter } from '#/processor/filter/all-exceptions.filter.js';
import {
  OperationLogInterceptor,
  TransformInterceptor,
} from '#/processor/interceptor/index.js';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ThrottlerModule } from '@nestjs/throttler';

import { AppRedisModule } from '#/infrastructure/database/redis/redis.module.js';
import { QueueInfrastructureModule } from '#/infrastructure/queue/queue.module.js';
import { AuthorizationModule } from '#/processor/authorization/authorization.module.js';
import { RbacModule } from '#/processor/rbac/rbac.module.js';
import { UserPersistenceModule } from '#/system/user/user-persistence.module.js';
import type { DynamicModule, Type } from '@nestjs/common';

export const CORE_MODULE: Array<
  Type | DynamicModule | Promise<DynamicModule>
> = [
  CONFIG_MODULE,
  SERVER_STATIC_MODULE,
  StaticfileModule,
  AppRedisModule,
  QueueInfrastructureModule,
  RbacModule,
  AuthorizationModule,
  UserPersistenceModule,
  /*  @SkipThrottle()  跳过速率限制
    @Throttle({ default: { limit: 3, ttl: 60000 } }) 装饰器，可用于覆盖全局模块中设置的 limit 和 ttl
    @Throttle('medium') // 使用 medium 策略
    该拦截是ip级别的，如果走nginx代理  可能要调整guard获取真实ip
  */
  ThrottlerModule.forRootAsync({
    imports: [AppRedisModule],
    inject: [RedisService],
    useFactory: (redisService: RedisService) => ({
      // 新版  storage  需要写在顶层
      storage: new ThrottlerStorageRedisService(
        redisService.getOrThrow('default'),
      ),
      throttlers: [
        {
          ttl: 60 * 1000,
          limit: 100,
        },

        // {
        //   name: 'captcha',
        //   ttl: 50 * 1000,
        //   limit: 1,
        // },
      ],
    }),
  }),

  // ScheduleTaskModule,

  PrismaModule,

  // ClsModule.forRoot({
  //   middleware: {
  //     mount: true,
  //     setup: (cls, req) => {
  //       cls.set('userId', req.headers['x-user-id']);
  //     },
  //   },
  // }),
  /*
  ClsModule.forRoot({
    global: true,
    // https://github.com/Papooch/nestjs-cls/issues/92
    interceptor: {
      mount: true,
      setup: (cls, context) => {
        const req = context.switchToHttp().getRequest<FastifyRequest<{ Params: { id?: string } }>>()
        if (req.params?.id && req.body) {
          // 供自定义参数验证器(UniqueConstraint)使用
          cls.set('operateId', Number.parseInt(req.params.id))
        }
      },
    },
  }),
  */
  /*
  用法
  private readonly cls: ClsService,
  this.cls.get('userId');

    */
  WinstonLoggerModule,
];

export const GLOBAL_GUARD = [
  // {
  //    全局速率限制   默认全局限流只使用第一个配置项
  //    特别注意  如果开启了全局限流 则会先走全局的  再走自定义的Throttler  所以如果有冲突  应该在局部使用@SkipThrottle() // 跳过全局 APP_GUARD 的 Throttler
  //   provide: APP_GUARD,
  //   useClass: GlobalThrottlerGuard,
  // },
  {
    // 重写自定义全局 ThrottlerGuard  的 key名  从而实现根据不同用户进行限流
    provide: APP_GUARD,
    useClass: GlobalThrottlerGuard,
  },
  // {
  //   // 全局动态限流   相当于上面 原生 ThrottlerGuard 的  加强版
  //   provide: APP_GUARD,
  //   useClass: DynamicThrottlerGuard,
  // },
  // { provide: APP_INTERCEPTOR, useClass: CaptchaInterceptor },   // 验证码拦截器
  { provide: APP_INTERCEPTOR, useClass: OperationLogInterceptor }, // 全局启用日志拦截器
  { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },

  // { provide: APP_INTERCEPTOR, useFactory: () => new TimeoutInterceptor() }, // 全局超时拦截器  默认10000ms

  // { provide: APP_INTERCEPTOR, useClass: IdempotenceInterceptor },

  {
    // 全局JWT + refresh token校验    先走header cookies换新单独守卫  换新端点跳过header guard
    provide: APP_GUARD,
    useClass: RtJwtAuthGuard,
  },
  // {
  //   provide: APP_GUARD,
  //   useClass: JwtRefreshAuthGuard,
  // },

  //  全局casl权限校验
  // {
  //   provide: APP_GUARD,
  //   useClass: PoliciesGuard,
  // },

  {
    // 必须在 JWT Guard 之后执行，依赖 request.user 中的用户身份
    provide: APP_GUARD,
    useClass: PermissionGuard,
  },
  {
    provide: APP_FILTER,
    useClass: AllExceptionsFilter,
  },

  /**
   * prisma 异常筛选器
   * 捕获未处理的 PrismaClientKnownRequestError，并返回不同的
   *  HttpStatus 代码，而不是 500 内部服务器错误

  {
    provide: APP_FILTER,
    useFactory: ({ httpAdapter }: HttpAdapterHost) => {
      return new PrismaClientExceptionFilter(httpAdapter);
    },
    inject: [HttpAdapterHost],
  },

  */

  // {  // 有全局拦截器后 可以合并处理http异常  HttpExceptionFilter是冗余的
  //   provide: APP_FILTER,
  //   useClass: HttpExceptionFilter,
  // },
];
