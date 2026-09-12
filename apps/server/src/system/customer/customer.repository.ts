import { Prisma } from '@/generated/prisma/client.js';
import { PgService } from '@/infrastructure/database/prisma/pg.service.js';
import { Injectable } from '@nestjs/common';

type Db = PgService | Prisma.TransactionClient;

export const CUSTOMER_SELECT = {
  id: true,
  name: true,
  phone: true,
  remark: true,
  status: true,
  dealAmount: true,
  internalCost: true,
  confidential: true,
  ownerId: true,
  departmentId: true,
  createdById: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CustomerSelect;

export type CustomerRow = Prisma.CustomerGetPayload<{
  select: typeof CUSTOMER_SELECT;
}>;

@Injectable()
export class CustomerRepository {
  constructor(private readonly db: PgService) {}

  transaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.db.$transaction(callback);
  }

  async findPage(
    where: Prisma.CustomerWhereInput,
    skip: number,
    take: number,
  ): Promise<[CustomerRow[], number]> {
    return this.db.$transaction([
      this.db.customer.findMany({
        where,
        select: CUSTOMER_SELECT,
        skip,
        take,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
      this.db.customer.count({ where }),
    ]);
  }

  findFirst(
    where: Prisma.CustomerWhereInput,
    tx: Db = this.db,
  ): Promise<CustomerRow | null> {
    return tx.customer.findFirst({ where, select: CUSTOMER_SELECT });
  }

  async lockCustomerForUpdate(
    id: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "Customer"
      WHERE "id" = ${id}
      FOR UPDATE
    `);
    return rows.length === 1;
  }

  /**
   * PostgreSQL FOR SHARE conflicts with UPDATE/DELETE row locks, so the existing
   * User and Department writes cannot disable, move, or delete these rows until
   * this transaction commits. Callers always lock users before departments.
   */
  async lockUsersForShare(
    ids: readonly string[],
    tx: Prisma.TransactionClient,
  ) {
    const sortedIds = [...new Set(ids)].sort();
    if (sortedIds.length === 0) return [];
    const rows = await tx.$queryRaw<
      Array<{ id: string; enabled: boolean; departmentId: string | null }>
    >(Prisma.sql`
      SELECT "id", "enabled", "departmentId"
      FROM "User"
      WHERE "id" IN (${Prisma.join(sortedIds)})
      ORDER BY "id"
      FOR SHARE
    `);
    return rows;
  }

  async lockDepartmentsForShare(
    ids: readonly string[],
    tx: Prisma.TransactionClient,
  ) {
    const sortedIds = [...new Set(ids)].sort();
    if (sortedIds.length === 0) return [];
    const rows = await tx.$queryRaw<
      Array<{ id: string; enabled: boolean }>
    >(Prisma.sql`
      SELECT "id", "enabled"
      FROM "Department"
      WHERE "id" IN (${Prisma.join(sortedIds)})
      ORDER BY "id"
      FOR SHARE
    `);
    return rows;
  }

  findMany(
    where: Prisma.CustomerWhereInput,
    tx: Db = this.db,
  ): Promise<CustomerRow[]> {
    return tx.customer.findMany({
      where,
      select: CUSTOMER_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  create(
    data: Prisma.CustomerUncheckedCreateInput,
    tx: Db = this.db,
  ): Promise<CustomerRow> {
    return tx.customer.create({ data, select: CUSTOMER_SELECT });
  }

  updateMany(
    where: Prisma.CustomerWhereInput,
    data: Prisma.CustomerUncheckedUpdateManyInput,
    tx: Db = this.db,
  ) {
    return tx.customer.updateMany({ where, data });
  }

  deleteMany(where: Prisma.CustomerWhereInput, tx: Db = this.db) {
    return tx.customer.deleteMany({ where });
  }

  findExportBatch(
    where: Prisma.CustomerWhereInput,
    cursor: string | undefined,
    take: number,
  ): Promise<CustomerRow[]> {
    return this.db.customer.findMany({
      where,
      select: CUSTOMER_SELECT,
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }
}
