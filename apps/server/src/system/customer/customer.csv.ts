import type { CustomerStatus } from '@/generated/prisma/enums.js';

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

export const CUSTOMER_CSV_HEADER =
  'id,name,phone,status,dealAmount,internalCost,createdAt,confidential,ownerId,departmentId\r\n';

export function escapeCsvCell(value: unknown): string {
  let text =
    value == null
      ? ''
      : typeof value === 'string'
        ? value
        : typeof value === 'number' ||
            typeof value === 'boolean' ||
            typeof value === 'bigint'
          ? `${value}`
          : value instanceof Date
            ? value.toISOString()
            : (JSON.stringify(value) ?? '');
  const firstSignificant = [...text].find((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const controlCharacter =
      codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f);
    return !/\s/u.test(character) && !controlCharacter;
  });
  if (
    text.startsWith('\t') ||
    (firstSignificant !== undefined && '=+-@'.includes(firstSignificant))
  ) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCustomerCsvRow(row: CustomerCsvRow): string {
  return [
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
  ]
    .map(escapeCsvCell)
    .join(',')
    .concat('\r\n');
}
