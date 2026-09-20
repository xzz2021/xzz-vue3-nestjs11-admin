import '#/core/load-env.js';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module.js';
import { createSwagger } from '#/core/swagger.js';
import { httpCorsOptions } from '#/processor/utils/cors.util.js';
import { GlobalZodValidationPipe } from '#/processor/pipe/global.zod.validation.pipe.js';
// import { AllExceptionsFilter } from './processor/filter/exceptions';
// import { VersioningType } from '@nestjs/common';
// =============csfr防攻击 跨站请求伪造=========
// import * as cookieParser from 'cookie-parser';
// import { doubleCsrf } from 'csrf-csrf';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useWebSocketAdapter(new WsAdapter(app));

  // Express 只把私网跳当作代理；admin Nginx 会覆盖 X-Forwarded-* 后再转到这里。
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER)); // 使用winston替换掉nest内置日志

  // app.setGlobalPrefix('api');
  const configService = app.get(ConfigService);
  const swaggerEnabled = configService.get<boolean>('swagger.enabled');
  if (swaggerEnabled) {
    createSwagger(app, {
      username: configService.getOrThrow<string>('swagger.username'),
      password: configService.getOrThrow<string>('swagger.password'),
    });
  }

  if (configService.get<boolean>('helmet')) {
    app.use(
      helmet({
        crossOriginEmbedderPolicy: false,
        // Swagger UI 需要内联脚本；生产关 Swagger 后使用空 CSP（本服务只返回 JSON）
        contentSecurityPolicy: swaggerEnabled
          ? false
          : {
              useDefaults: false,
              directives: {
                defaultSrc: ["'none'"],
                frameAncestors: ["'none'"],
                baseUri: ["'none'"],
              },
            },
        crossOriginResourcePolicy: { policy: 'cross-origin' }, // 加这一行才能加载图片资源
      }),
    );
  }

  /* const frontendUrl = configService.get<string>('frontendUrl');
   const serverUrl = configService.get<string>('serverUrl');
   const n8nUrl = configService.get<string>('n8nHost');
   console.log('frontendUrl--serverUrl--n8nUrl', frontendUrl, serverUrl, n8nUrl);
    重要  origin内的域名结尾一定不能带/  否则请求头会忽略掉origin
   cookies 携带 跨域
  */
  app.use(cookieParser());
  const corsOrigins = configService.get<string[]>('corsOrigins') ?? [];
  if (corsOrigins.length > 0) {
    app.enableCors(httpCorsOptions(corsOrigins));
  }

  app.useGlobalPipes(new GlobalZodValidationPipe());
  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port);
  console.log(`Server is running on: http://localhost:${port}`);
}
await bootstrap();
