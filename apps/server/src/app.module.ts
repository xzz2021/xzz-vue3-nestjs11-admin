import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CORE_MODULE } from './core/app.core.js';
import { CORE_SYSTEM_MODULE } from './system/app.system.js';
@Module({
  imports: [...CORE_MODULE, ...CORE_SYSTEM_MODULE],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
