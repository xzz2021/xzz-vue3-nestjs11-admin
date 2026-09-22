import { UserModel } from '#/generated/zod/user.js';
import { csvHeaderLine, serializeCsvRow } from '#/processor/utils/csv.js';
import { z } from 'zod';

export const USER_IMPORT_COLUMNS = [
  'username',
  'phone',
  'password',
  'nickname',
  'email',
  'departmentId',
  'roleCodes',
  'enabled',
] as const;

export const USER_EXPORT_COLUMNS = [
  'username',
  'phone',
  'nickname',
  'email',
  'departmentId',
  'roleCodes',
  'enabled',
  'createdAt',
] as const;

export const USER_EXPORT_BATCH_SIZE = 500;
export const USER_EXPORT_MAX_ROWS = 10_000;
export const USER_IMPORT_MAX_ROWS = 500;

const blankToUndefined = (value: unknown) =>
  value === undefined || value === null || value === '' ? undefined : value;

const UserImportRowSchema = z.object({
  username: UserModel.shape.username,
  phone: UserModel.shape.phone,
  password: UserModel.shape.password,
  nickname: z.preprocess(
    blankToUndefined,
    UserModel.shape.nickname.optional(),
  ),
  email: z.preprocess(blankToUndefined, UserModel.shape.email.optional()),
  departmentId: z.string().min(1, '部门 ID 不能为空'),
  roleCodes: z.preprocess((value: unknown) => {
    if (value === undefined || value === null || value === '') return [];
    if (Array.isArray(value)) return value;
    return String(value)
      .split(/[;,，]/)
      .map((code) => code.trim())
      .filter(Boolean);
  }, z.array(z.string().min(1))),
  enabled: z.preprocess((value: unknown) => {
    if (value === undefined || value === null || value === '') return true;
    if (value === true || value === 'true' || value === '1') return true;
    if (value === false || value === 'false' || value === '0') return false;
    return value;
  }, z.boolean()),
});

export type UserImportRow = z.infer<typeof UserImportRowSchema>;

export interface UserExportRow {
  username: string;
  phone: string;
  nickname: string | null;
  email: string | null;
  departmentId: string | null;
  roleCodes: string[];
  enabled: boolean;
  createdAt: Date;
}

export function userImportTemplateCsv(): string {
  return `\uFEFF${csvHeaderLine([...USER_IMPORT_COLUMNS])}`;
}

export function parseUserImportRow(
  record: Record<string, string>,
): UserImportRow {
  return UserImportRowSchema.parse(record);
}

export function serializeUserExportRow(row: UserExportRow): string {
  return serializeCsvRow([
    row.username,
    row.phone,
    row.nickname,
    row.email,
    row.departmentId,
    row.roleCodes.join(';'),
    row.enabled,
    row.createdAt,
  ]);
}

export function userExportHeader(): string {
  return `\uFEFF${csvHeaderLine([...USER_EXPORT_COLUMNS])}`;
}
