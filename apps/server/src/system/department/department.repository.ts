import { Prisma } from '#/generated/prisma/client.js';
import { PgService } from '#/infrastructure/database/prisma/pg.service.js';
import { sqlReplaceDescendantPaths } from '#/processor/utils/sql-batch.js';
import { Injectable } from '@nestjs/common';

type Db = PgService | Prisma.TransactionClient;

@Injectable()
export class DepartmentRepository {
  constructor(private readonly db: PgService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(fn);
  }

  create(data: Prisma.DepartmentUncheckedCreateInput, tx: Db = this.db) {
    return tx.department.create({ data });
  }

  findById(id: string, tx: Db = this.db) {
    return tx.department.findUnique({ where: { id } });
  }

  findPathById(id: string, tx: Db = this.db) {
    return tx.department.findUnique({
      where: { id },
      select: { path: true },
    });
  }

  async lockById(id: string, tx: Db = this.db) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Department"
      WHERE "id" = ${id}
      FOR UPDATE
    `;
    return rows[0] ?? null;
  }

  findTreeLinks(tx: Db = this.db) {
    return tx.department.findMany({
      select: { id: true, parentId: true, path: true },
    });
  }

  findFirstChildId(parentId: string, tx: Db = this.db) {
    return tx.department.findFirst({
      where: { parentId },
      select: { id: true },
    });
  }

  async findDeleteReferences(departmentId: string, tx: Db = this.db) {
    const [customScope, customer] = await Promise.all([
      tx.rolePermissionDepartment.findFirst({
        where: { departmentId },
        select: { id: true },
      }),
      tx.customer.findFirst({
        where: { departmentId },
        select: { id: true },
      }),
    ]);
    return { customScope: Boolean(customScope), customer: Boolean(customer) };
  }

  findRootTrees() {
    return this.db.department.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: {
              include: {
                children: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });
  }

  async findSubtreeDepartmentIds(rootId: string): Promise<string[]> {
    const rows = await this.db.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE dept_tree AS (
        SELECT id, "parentId"
        FROM "Department"
        WHERE id = ${rootId} AND enabled = true
        UNION ALL
        SELECT d.id, d."parentId"
        FROM "Department" d
        INNER JOIN dept_tree dt ON d."parentId" = dt.id
        WHERE d.enabled = true
      )
      SELECT id FROM dept_tree;
    `;
    return rows.map((row) => row.id);
  }

  count() {
    return this.db.department.count();
  }

  updateById(
    id: string,
    data: Prisma.DepartmentUncheckedUpdateInput,
    tx: Db = this.db,
  ) {
    return tx.department.update({
      where: { id },
      data,
      select: { id: true },
    });
  }

  deleteById(id: string, tx: Db = this.db) {
    return tx.department.delete({ where: { id } });
  }

  replaceDescendantPaths(oldPath: string, nextPath: string, tx: Db = this.db) {
    return tx.$executeRaw(sqlReplaceDescendantPaths(oldPath, nextPath));
  }
}
