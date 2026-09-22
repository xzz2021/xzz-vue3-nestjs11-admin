import { AuditAction } from '#/core/logger/audit-action.js';
import { AuditLogService } from '#/core/logger/audit-log.service.js';
import { Prisma } from '#/generated/prisma/client.js';
import { formatZodErrorMessage } from '#/processor/pipe/zod-error.util.js';
import { RbacPermissionCacheService } from '#/processor/rbac/index.js';
import { recordsFromCsv } from '#/processor/utils/csv.js';
import {
  formatDateToYMDHMS,
  hashPayPassword,
  verifyPayPassword,
} from '#/processor/utils/index.js';
import { SessionRevocationService } from '#/system/auth/session-revocation.service.js';
import { FileCleanupService } from '#/system/file-cleanup/file-cleanup.service.js';
import {
  getStaticFileRoot,
  sanitizePathSegment,
  tryResolvePathInsideRoot,
} from '#/system/staticfile/multer.config.js';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import { ZodError } from 'zod';
import {
  AdminUpdatePwdDto,
  CreateUserDto,
  QueryUserParams,
  UpdatePersonalInfo,
  UpdatePwdDto,
  UpdateUserDto,
} from './dto/user.dto.js';
import {
  USER_EXPORT_BATCH_SIZE,
  USER_EXPORT_MAX_ROWS,
  USER_IMPORT_MAX_ROWS,
  parseUserImportRow,
  serializeUserExportRow,
  userExportHeader,
} from './user.csv.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly rbacPermissionCache: RbacPermissionCacheService,
    private readonly sessions: SessionRevocationService,
    private readonly configService: ConfigService,
    private readonly fileCleanupService: FileCleanupService,
    private readonly audit: AuditLogService,
  ) {}

  findOne(phone: string) {
    return this.users.findByPhone(phone);
  }

  async findByDepartmentId(searchParam: QueryUserParams) {
    const { skip, take, where } = await this.departmentUserQuery(searchParam);
    const [rawlist, total] = await this.users.findDepartmentPage(
      where,
      skip,
      take,
    );
    const list = rawlist.map((u) => ({
      ...u,
      createdAt: formatDateToYMDHMS(u.createdAt),
      roles: u.roles.map((r) => r.role),
    }));

    return { list, total, message: '部门用户列表查询成功' };
  }

  async lookupByDepartment(searchParam: QueryUserParams) {
    const { skip, take, where } = await this.departmentUserQuery({
      id: searchParam.id,
      pageIndex: searchParam.pageIndex,
      pageSize: searchParam.pageSize,
      enabled: searchParam.enabled,
    });
    const [list, total] = await this.users.findLookupPage(where, skip, take);
    return { list, total, message: '用户选项查询成功' };
  }

  async addUser(
    addUserinfoDto: CreateUserDto,
    operatorId?: string,
    ip?: string,
  ) {
    const {
      department,
      roles,
      phone,
      username,
      password: rawPassword,
    } = addUserinfoDto;
    const isExit = await this.users.findByPhone(phone);
    if (isExit?.id && phone) {
      throw new BadRequestException('手机号已存在,无法添加!');
    }
    const password = await hashPayPassword(rawPassword);
    const userSave = await this.users.createWithRelations({
      username,
      password,
      phone,
      departmentId: department,
      roleIds: roles,
      assignedById: operatorId ?? null,
    });
    await this.audit.record({
      actorId: operatorId,
      action: AuditAction.USER_CREATE,
      resource: 'User',
      resourceId: userSave.id,
      ip,
      metadata: { username, phone, departmentId: department, roles },
    });
    return { message: '新增用户成功', id: userSave.id };
  }

  async update(
    updateUserinfoDto: UpdateUserDto,
    operatorId?: string,
    ip?: string,
  ) {
    const { id, department, roles, ...rest } = updateUserinfoDto;
    const res = await this.users.updateWithDepartmentAndRoles(id, {
      ...rest,
      departmentId: department,
      roleIds: roles,
      assignedById: operatorId ?? null,
    });
    await this.rbacPermissionCache.invalidateUsers([id]);
    if (rest.enabled === false) {
      await this.sessions.revokeAll(id);
    }
    await this.audit.record({
      actorId: operatorId,
      action: AuditAction.USER_UPDATE,
      resource: 'User',
      resourceId: id,
      ip,
      metadata: {
        username: rest.username,
        phone: rest.phone,
        enabled: rest.enabled,
        departmentId: department,
        roles,
      },
    });
    return { message: '更新用户信息成功', id: res.id };
  }

  async batchDeleteUser(ids: string[], operatorId?: string, ip?: string) {
    await this.users.deleteManyWithRelations(ids);
    await this.rbacPermissionCache.invalidateUsers(ids);
    await Promise.all(ids.map((id) => this.sessions.revokeAll(id)));
    await this.audit.record({
      actorId: operatorId,
      action: AuditAction.USER_DELETE,
      resource: 'User',
      ip,
      metadata: { ids },
    });
    return { message: '删除用户成功', count: ids.length };
  }

  async getUserInfo(userId: string) {
    const userinfo = await this.users.findProfile(userId);
    return { userinfo, message: '获取个人信息成功' };
  }

  async updateInfo(updateUserinfoDto: UpdatePersonalInfo, ip?: string) {
    const { id, ...updateData } = updateUserinfoDto;
    const res = await this.users.updateProfile(id, updateData);
    await this.audit.record({
      actorId: id,
      action: AuditAction.USER_UPDATE_PROFILE,
      resource: 'User',
      resourceId: id,
      ip,
      metadata: {
        username: updateData.username,
        phone: updateData.phone,
        nickname: updateData.nickname,
        email: updateData.email,
        avatar: updateData.avatar,
        enabled: updateData.enabled,
      },
    });
    return { message: '更新个人信息成功', id: res.id };
  }

  async updatePassword(updatePasswordDto: UpdatePwdDto, ip?: string) {
    const { id, password, newPassword } = updatePasswordDto;
    const user = await this.users.findByIdWithPassword(id);
    if (!user) {
      throw new BadRequestException('用户不存在');
    }
    const isMatch = await verifyPayPassword(user.password, password);
    if (!isMatch) {
      throw new BadRequestException('修改失败, 旧密码不正确');
    }
    const hashPassword = await hashPayPassword(newPassword);
    const res = await this.users.updateById(id, {
      password: hashPassword,
      passwordChangedAt: new Date(),
    });
    await this.sessions.revokeAll(id);
    await this.audit.record({
      actorId: id,
      action: AuditAction.USER_UPDATE_PASSWORD,
      resource: 'User',
      resourceId: id,
      ip,
    });
    return { message: '更新个人密码成功', id: res.id };
  }

  async resetPassword({
    id,
    password,
    operateId,
    ip,
  }: AdminUpdatePwdDto & { operateId: string; ip?: string }) {
    const hashPassword = await hashPayPassword(password);
    const res = await this.users.updateById(id, {
      password: hashPassword,
      passwordChangedAt: new Date(),
    });
    await this.sessions.revokeAll(id);
    await this.audit.record({
      actorId: operateId,
      action: AuditAction.USER_RESET_PASSWORD,
      resource: 'User',
      resourceId: id,
      ip,
    });
    return { message: '重置用户密码成功', id: res.id };
  }

  async findAll(searchParam: QueryUserParams) {
    const { pageIndex, pageSize, username, phone, enabled, id } = searchParam;
    const skip = (pageIndex - 1) * pageSize;
    const take = pageSize;
    const where: Prisma.UserWhereInput = {};

    if (username) where.username = { contains: username };
    if (phone) where.phone = { contains: phone };
    if (enabled !== undefined) where.enabled = enabled;
    if (id) where.departmentId = id;

    const [list, total] = await this.users.findPage(where, skip, take);
    return { list, total, message: '获取用户列表成功' };
  }

  async exportUsers(
    searchParam: Partial<QueryUserParams>,
    operatorId?: string,
    ip?: string,
  ): Promise<Readable> {
    const where = await this.exportWhere(searchParam);
    const users = this.users;
    const audit = this.audit;
    let count = 0;
    let auditPromise: Promise<void> | undefined;
    const recordOutcome = (
      outcome: 'success' | 'failed' | 'aborted',
      errorCode?: 'USER_EXPORT_READ_FAILED',
    ): Promise<void> => {
      auditPromise ??= Promise.resolve()
        .then(() =>
          audit.record({
            actorId: operatorId,
            action: AuditAction.USER_EXPORT,
            resource: 'User',
            success: outcome === 'success',
            ip,
            metadata: { outcome, count, ...(errorCode ? { errorCode } : {}) },
          }),
        )
        .catch(() => undefined);
      return auditPromise;
    };

    const stream = Readable.from(
      (async function* () {
        let cursor: string | undefined;
        let outcome: 'success' | 'failed' | 'aborted' = 'aborted';
        let errorCode: 'USER_EXPORT_READ_FAILED' | undefined;
        try {
          yield userExportHeader();
          while (count < USER_EXPORT_MAX_ROWS) {
            const take = Math.min(
              USER_EXPORT_BATCH_SIZE,
              USER_EXPORT_MAX_ROWS - count,
            );
            const batch = await users.findExportBatch(where, cursor, take);
            if (batch.length === 0) break;
            for (const row of batch) {
              yield serializeUserExportRow({
                username: row.username,
                phone: row.phone,
                nickname: row.nickname,
                email: row.email,
                departmentId: row.departmentId,
                roleCodes: row.roles.map((item) => item.role.code),
                enabled: row.enabled,
                createdAt: row.createdAt,
              });
              count++;
            }
            cursor = batch.at(-1)!.id;
            if (batch.length < take) break;
          }
          outcome = 'success';
        } catch (error) {
          outcome = 'failed';
          errorCode = 'USER_EXPORT_READ_FAILED';
          throw error;
        } finally {
          await recordOutcome(outcome, errorCode);
        }
      })(),
    );
    stream.once('close', () => {
      void recordOutcome('aborted');
    });
    return stream;
  }

  async importUsers(buffer: Buffer, operatorId?: string, ip?: string) {
    let records: Record<string, string>[];
    try {
      records = recordsFromCsv(buffer.toString('utf8'));
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'CSV 解析失败',
      );
    }
    if (records.length > USER_IMPORT_MAX_ROWS) {
      throw new BadRequestException(`最多导入 ${USER_IMPORT_MAX_ROWS} 行`);
    }

    const errors: { row: number; message: string }[] = [];
    let success = 0;

    for (let index = 0; index < records.length; index++) {
      const rowNumber = index + 2;
      try {
        const parsed = parseUserImportRow(records[index]!);
        const existingPhone = await this.users.findByPhone(parsed.phone);
        if (existingPhone) {
          throw new Error('手机号已存在');
        }
        if (parsed.email) {
          const existingEmail = await this.users.findIdByEmail(parsed.email);
          if (existingEmail) {
            throw new Error('邮箱已存在');
          }
        }
        const department = await this.users.findEnabledDepartment(
          parsed.departmentId,
        );
        if (!department) {
          throw new Error('部门不存在或已禁用');
        }
        let roleIds: string[] = [];
        if (parsed.roleCodes.length > 0) {
          const roles = await this.users.findEnabledRolesByCodes(
            parsed.roleCodes,
          );
          const found = new Map(roles.map((role) => [role.code, role.id]));
          const missing = parsed.roleCodes.filter((code) => !found.has(code));
          if (missing.length > 0) {
            throw new Error(`角色不存在或已禁用: ${missing.join(',')}`);
          }
          roleIds = [
            ...new Set(
              parsed.roleCodes.map((code) => found.get(code)!),
            ),
          ];
        }
        const password = await hashPayPassword(parsed.password);
        await this.users.createWithRelations({
          username: parsed.username,
          password,
          phone: parsed.phone,
          departmentId: parsed.departmentId,
          roleIds,
          assignedById: operatorId ?? null,
          nickname: parsed.nickname ?? null,
          email: parsed.email ?? null,
          enabled: parsed.enabled,
        });
        success++;
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: this.importRowErrorMessage(error),
        });
      }
    }

    const failed = errors.length;
    await this.audit.record({
      actorId: operatorId,
      action: AuditAction.USER_IMPORT,
      resource: 'User',
      ip,
      metadata: { success, failed },
    });
    return { success, failed, errors, message: '导入完成' };
  }

  async uploadAvatar(
    file: Express.Multer.File,
    userId: string,
    phone?: string | null,
  ) {
    if (!file) {
      throw new BadRequestException('文件不存在');
    }
    if (!userId) {
      throw new BadRequestException('身份识别异常');
    }
    const serveRoot =
      this.configService.get<string>('staticFileServeRoot') || '';
    const phoneSegment = sanitizePathSegment(phone ?? 'anonymous');
    const filePath = `${serveRoot}/avatar/${phoneSegment}/${file.filename}`;
    const current = await this.users.findAvatar(userId);
    try {
      await this.users.updateById(userId, { avatar: filePath });
    } catch (error) {
      await this.fileCleanupService.enqueue([
        { kind: 'orphan-path', path: file.path },
      ]);
      throw error;
    }
    const previousDiskPath = this.toAvatarDiskPath(current?.avatar);
    if (previousDiskPath) {
      await this.fileCleanupService.enqueue([
        { kind: 'orphan-path', path: previousDiskPath },
      ]);
    }
    return { filePath, message: '更新头像成功' };
  }

  private async departmentUserQuery(searchParam: QueryUserParams) {
    const { id, pageIndex, pageSize, enabled, ...rest } = searchParam;
    const skip = (pageIndex - 1) * pageSize;
    const take = pageSize;
    const where = Object.entries(rest).reduce(
      (acc, [key, value]) => {
        if (value) {
          acc[key] = { contains: value };
        }
        return acc;
      },
      {} as Record<string, { contains: unknown }>,
    ) as Prisma.UserWhereInput;
    where.enabled = enabled;
    if (id) {
      where.departmentId = {
        in: await this.users.findSubtreeDepartmentIds(id),
      };
    }
    return { skip: Number(skip), take: Number(take), where };
  }

  private async exportWhere(
    searchParam: Partial<QueryUserParams>,
  ): Promise<Prisma.UserWhereInput> {
    const where: Prisma.UserWhereInput = {};
    if (searchParam.username) {
      where.username = { contains: searchParam.username };
    }
    if (searchParam.phone) {
      where.phone = { contains: searchParam.phone };
    }
    if (searchParam.enabled !== undefined) {
      where.enabled = searchParam.enabled;
    }
    if (searchParam.id) {
      where.departmentId = {
        in: await this.users.findSubtreeDepartmentIds(searchParam.id),
      };
    }
    return where;
  }

  private importRowErrorMessage(error: unknown): string {
    if (error instanceof ZodError) {
      return formatZodErrorMessage(error);
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return '导入失败';
  }

  private toAvatarDiskPath(avatar: string | null | undefined): string | null {
    if (!avatar) return null;
    const serveRoot = (
      this.configService.get<string>('staticFileServeRoot') || ''
    ).replace(/\/$/, '');
    const relative =
      serveRoot && (avatar === serveRoot || avatar.startsWith(`${serveRoot}/`))
        ? avatar.slice(serveRoot.length).replace(/^\//, '')
        : avatar;
    try {
      return tryResolvePathInsideRoot(getStaticFileRoot(), relative);
    } catch {
      return null;
    }
  }
}
