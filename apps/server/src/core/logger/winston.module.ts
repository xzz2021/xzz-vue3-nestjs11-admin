import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { WinstonModule } from 'nest-winston';
import { AuditLogService } from './audit-log.service.js';
import { LoggerController } from './logger.controller.js';
import { LogService } from './logger.service.js';
import { createWinstonOptions } from './winston.config.js';

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<boolean>('isProduction') === true;
        const level =
          process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');
        return createWinstonOptions({
          isProduction,
          level,
          appName: 'backstage-server',
          fileEnabled: config.get<boolean>('logger.fileEnabled') === true,
        });
      },
    }),
  ],
  controllers: [LoggerController],
  providers: [LogService, AuditLogService],
  exports: [LogService, AuditLogService],
})
export class WinstonLoggerModule {}
