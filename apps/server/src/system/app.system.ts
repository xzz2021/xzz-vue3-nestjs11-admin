import { AuthModule } from '#/system/auth/auth.module.js';
import { CaptchaModule } from '#/system/captcha/captcha.module.js';
import { CustomerModule } from '#/system/customer/customer.module.js';
import { DepartmentModule } from '#/system/department/department.module.js';
import { DictionaryModule } from '#/system/dictionary/dictionary.module.js';
import { DbBackupModule } from '#/system/db-backup/db-backup.module.js';
import { MenuModule } from '#/system/menu/menu.module.js';
import { MessageModule } from '#/system/message/message.module.js';
import { MonitorModule } from '#/system/monitor/monitor.module.js';
import { OnlineModule } from '#/system/online/online.module.js';
import { OssModule } from '#/system/oss/oss.module.js';
import { PermissionModule } from '#/system/permission/permission.module.js';
import { RoleModule } from '#/system/role/role.module.js';
import { SessionModule } from '#/system/session/session.module.js';
import { UserModule } from '#/system/user/user.module.js';
import { DynamicModule, Type } from '@nestjs/common';

export const CORE_SYSTEM_MODULE: Array<
  Type | DynamicModule | Promise<DynamicModule>
> = [
  SessionModule,
  CustomerModule,
  DepartmentModule,
  MenuModule,
  PermissionModule,
  UserModule,
  DictionaryModule,
  DbBackupModule,
  AuthModule,
  RoleModule,
  CaptchaModule,
  MonitorModule,
  OnlineModule,
  MessageModule,
  OssModule,
];
