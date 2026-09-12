import { AuditAction } from '@/core/logger/audit-action.js';
import { AuditLogService } from '@/core/logger/audit-log.service.js';
import { Prisma } from '@/generated/prisma/client.js';
import { RbacPermissionCacheService } from '@/processor/rbac/index.js';
import {
  formatDateToYMDHMS,
  hashPayPassword,
  verifyPayPassword,
} from '@/processor/utils/index.js';
import { SessionRevocationService } from '@/system/auth/session-revocation.service.js';
import { FileCleanupService } from '@/system/file-cleanup/file-cleanup.service.js';
import {
  getStaticFileRoot,
  sanitizePathSegment,
  tryResolvePathInsideRoot,
} from '@/system/staticfile/multer.config.js';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminUpdatePwdDto,
  CreateUserDto,
  QueryUserParams,
  UpdatePersonalInfo,
  UpdatePwdDto,
  UpdateUserDto,
} from './dto/user.dto.js';
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
