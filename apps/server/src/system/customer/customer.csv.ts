import { escapeCsvCell, serializeCsvRow } from '#/processor/utils/csv.js';
import type { CustomerStatus } from '#/generated/prisma/enums.js';

export { escapeCsvCell };

export const CUSTOMER_EXPORT_BATCH_SIZE = 500;
export const CUSTOMER_EXPORT_MAX_ROWS = 10_000;

export interface CustomerCsvRow {
  id: string;
  name: string;
  phone: string | null;
  status: CustomerStatus;
  dealAmount: { toString(): string } | string | number;
  internalCost?: { toString(): string } | string | number;
  confidential: boolean;
  ownerId: string;
  departmentId: string;
  createdAt: Date;
}

export const CUSTOMER_CSV_HEADER = serializeCsvRow([
  'id',
  'name',
  'phone',
  'status',
  'dealAmount',
  'internalCost',
  'createdAt',
  'confidential',
  'ownerId',
  'departmentId',
]);

export function serializeCustomerCsvRow(row: CustomerCsvRow): string {
  return serializeCsvRow([
    row.id,
    row.name,
    row.phone,
    row.status,
    row.dealAmount.toString(),
    row.internalCost?.toString() ?? '',
    row.createdAt.toISOString(),
    row.confidential,
    row.ownerId,
    row.departmentId,
  ]);
}
