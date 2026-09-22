import { Prisma } from '#/generated/prisma/client.js';
import { PgService } from '#/infrastructure/database/prisma/pg.service.js';
import { lookupIpLocation } from '#/processor/utils/index.js';
import { Injectable } from '@nestjs/common';

const USER_LIST_SELECT = {
  id: true,
  username: true,
  phone: true,
  avatar: true,
  enabled: true,
  createdAt: true,
  department: {
    select: {
      id: true,
      name: true,
    },
  },
  roles: {
    select: {
      role: {
        select: {
          id: true,
          name: true,
          isSystem: true,
        },
      },
    },
  },
} satisfies Prisma.UserSelect;

const USER_LOOKUP_SELECT = {
  id: true,
  username: true,
  enabled: true,
  departmentId: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UserRepository {
  constructor(private readonly db: PgService) {}

  findByPhone(phone: string) {
    return this.db.user.findUnique({ where: { phone } });
  }

  findIdByEmail(email: string) {
    return this.db.user.findUnique({
      where: { email },
      select: { id: true },
    });
  }

  findEnabledDepartment(id: string) {
    return this.db.department.findFirst({
      where: { id, enabled: true },
      select: { id: true },
    });
  }

  findEnabledRolesByCodes(codes: string[]) {
    if (codes.length === 0) return Promise.resolve([]);
    return this.db.role.findMany({
      where: { code: { in: codes }, enabled: true },
      select: { id: true, code: true },
    });
  }

  findIdByPhone(phone: string) {
    return this.db.user.findUnique({
      where: { phone },
      select: { id: true },
    });
  }

  findEnabledByPhoneForLogin(phone: string) {
    return this.db.user.findUnique({
      where: { phone, enabled: true },
      select: {
        id: true,
        username: true,
        phone: true,
        password: true,
        roles: {
          select: {
            role: {
              select: {
                name: true,
                code: true,
              },
            },
          },
        },
        avatar: true,
        email: true,
      },
    });
  }

  findByIdForRefresh(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        phone: true,
        enabled: true,
        roles: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        avatar: true,
        email: true,
      },
    });
  }

  findByIdWithPassword(id: string) {
    return this.db.user.findUnique({
      where: { id },
      select: { id: true, password: true },
    });
  }

  findEnabledRolePermissionTree(userId: string) {
    return this.db.user.findUnique({
      where: {
        id: userId,
        enabled: true,
      },
      select: {
        roles: {
          select: {
            role: {
              select: {
                code: true,
                enabled: true,
                permissions: {
                  select: {
                    permission: {
                      select: {
                        code: true,
                        enabled: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  findAvatar(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });
  }

  findProfile(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        avatar: true,
        username: true,
        phone: true,
        email: true,
        createdAt: true,
        department: { select: { id: true, name: true } },
        roles: { select: { role: { select: { id: true, name: true } } } },
      },
    });
  }

  findPage(where: Prisma.UserWhereInput, skip: number, take: number) {
    return Promise.all([
      this.db.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        omit: { password: true },
      }),
      this.db.user.count({ where }),
    ]);
  }

  findDepartmentPage(where: Prisma.UserWhereInput, skip: number, take: number) {
    return Promise.all([
      this.db.user.findMany({
        where,
        select: USER_LIST_SELECT,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.user.count({ where }),
    ]);
  }

  findLookupPage(where: Prisma.UserWhereInput, skip: number, take: number) {
    return Promise.all([
      this.db.user.findMany({
        where,
        select: USER_LOOKUP_SELECT,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.user.count({ where }),
    ]);
  }

  findExportBatch(
    where: Prisma.UserWhereInput,
    cursor: string | undefined,
    take: number,
  ) {
    return this.db.user.findMany({
      where,
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        username: true,
        phone: true,
        nickname: true,
        email: true,
        departmentId: true,
        enabled: true,
        createdAt: true,
        roles: {
          select: {
            role: { select: { code: true } },
          },
        },
      },
    });
  }

  async findSubtreeDepartmentIds(rootId: string): Promise<string[]> {
    const rows = await this.db.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE dept_tree AS (
        SELECT id, "parentId" FROM "Department" WHERE id = ${rootId}
        UNION ALL
        SELECT d.id, d."parentId"
        FROM "Department" d
        INNER JOIN dept_tree dt ON d."parentId" = dt.id
      )
      SELECT id FROM dept_tree;
    `;
    return rows.map((row) => row.id);
  }

  createRegistered(data: {
    phone: string;
    username: string;
    password: string;
  }) {
    return this.db.user.create({
      data,
      select: { id: true },
    });
  }

  createWithRelations(data: {
    username: string;
    password: string;
    phone: string;
    departmentId: string;
    roleIds?: string[];
    assignedById?: string | null;
    nickname?: string | null;
    email?: string | null;
    enabled?: boolean;
  }) {
    return this.db.user.create({
      data: {
        username: data.username,
        password: data.password,
        phone: data.phone,
        nickname: data.nickname,
        email: data.email,
        enabled: data.enabled,
        department: { connect: { id: data.departmentId } },
        roles: {
          create: this.roleAssignments(data.roleIds, data.assignedById),
        },
      },
    });
  }

  async recordLoginSuccess(id: string, ip: string) {
    const location = await lookupIpLocation(ip);
    return this.db.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        lastLoginLocation: location,
      },
    });
  }

  updateProfile(id: string, data: Prisma.UserUpdateInput) {
    return this.db.user.update({
      where: { id },
      data,
      select: { id: true },
    });
  }

  updateById(id: string, data: Prisma.UserUpdateInput) {
    return this.db.user.update({ where: { id }, data });
  }

  updateWithDepartmentAndRoles(
    id: string,
    data: Prisma.UserUpdateInput & {
      departmentId: string;
      roleIds?: string[];
      assignedById?: string | null;
    },
  ) {
    const { departmentId, roleIds, assignedById, ...rest } = data;
    return this.db.user.update({
      where: { id },
      data: {
        ...rest,
        department: { connect: { id: departmentId } },
        roles: {
          deleteMany: {},
          create: this.roleAssignments(roleIds, assignedById),
        },
      },
    });
  }

  private roleAssignments(roleIds?: string[], assignedById?: string | null) {
    return roleIds?.map((roleId) => ({
      role: { connect: { id: roleId } },
      assignedBy: assignedById ? { connect: { id: assignedById } } : undefined,
      assignedAt: assignedById ? new Date() : null,
    }));
  }

  deleteManyWithRelations(ids: string[]) {
    return this.db.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId: { in: ids } } });
      await tx.userSession.deleteMany({ where: { userId: { in: ids } } });
      await tx.user.deleteMany({ where: { id: { in: ids } } });
    });
  }
}
