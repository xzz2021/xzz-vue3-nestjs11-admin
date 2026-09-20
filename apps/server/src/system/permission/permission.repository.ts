import { Prisma } from '#/generated/prisma/client.js';
import { PgService } from '#/infrastructure/database/prisma/pg.service.js';
import { Injectable } from '@nestjs/common';
import type { CreatePermissionDto } from './dto/permission.dto.js';

type Db = PgService | Prisma.TransactionClient;

@Injectable()
export class PermissionRepository {
  constructor(private readonly db: PgService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(fn);
  }

  create(data: CreatePermissionDto) {
    return this.db.permission.create({
      data,
      select: { id: true },
    });
  }

  findScopeState(id: string, tx: Db = this.db) {
    return tx.permission.findUnique({
      where: { id },
      select: { id: true, scopeEnabled: true },
    });
  }

  updateById(
    id: string,
    data: Prisma.PermissionUncheckedUpdateInput,
    tx: Db = this.db,
  ) {
    return tx.permission.update({
      where: { id },
      data,
      select: { id: true },
    });
  }

  deleteById(id: string, tx: Db = this.db) {
    return tx.permission.delete({
      where: { id },
      select: { id: true },
    });
  }

  clearCustomDepartments(permissionId: string, tx: Db) {
    return tx.rolePermissionDepartment.deleteMany({
      where: { rolePermission: { permissionId } },
    });
  }

  clearDataScopes(permissionId: string, tx: Db) {
    return tx.rolePermission.updateMany({
      where: { permissionId },
      data: { dataScope: null },
    });
  }
}
