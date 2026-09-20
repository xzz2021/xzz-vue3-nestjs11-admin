import { Prisma } from '#/infrastructure/database/prisma/pg.lib.js';

type SqlPrimitive = string | number | boolean | null;

function escapeRegex(value: string) {
  return value.replace(/[\\.^$*+?()[\]{}|]/g, '\\$&');
}

function escapeLike(value: string) {
  return value.replace(/#/g, '##').replace(/%/g, '#%').replace(/_/g, '#_');
}

function sqlValueRow(values: SqlPrimitive[]) {
  return Prisma.sql`(${Prisma.join(values)})`;
}

/** 一条 SQL 把子孙节点的物化路径前缀从 oldPath 替换为 nextPath（不含自身） */
export function sqlReplaceDescendantPaths(oldPath: string, nextPath: string) {
  return Prisma.sql`
    UPDATE "Department"
    SET
      path = regexp_replace(path, ${`^${escapeRegex(oldPath)}`}, ${nextPath}),
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE path LIKE ${`${escapeLike(oldPath)}/%`} ESCAPE '#'
  `;
}

/** 一条 SQL 按主键批量更新整型列 */
export function sqlBatchUpdateIntById(
  table: '"Menu"' | '"DictionaryItem"',
  column: 'sort',
  rows: Array<{ id: string; value: number }>,
) {
  const values = Prisma.join(
    rows.map((row) => sqlValueRow([row.id, row.value])),
  );
  return Prisma.sql`
    UPDATE ${Prisma.raw(table)} AS t
    SET ${Prisma.raw(column)} = v.value::int,
        "updatedAt" = CURRENT_TIMESTAMP
    FROM (VALUES ${values}) AS v(id, value)
    WHERE t.id = v.id
  `;
}

// export function sqlBatchUpdateRoles(
//   rows: Array<{
//     code: string;
//     name: string;
//     description: string | null;
//     enabled: boolean | null;
//   }>,
// ) {
//   const values = Prisma.join(
//     rows.map((row) =>
//       sqlValueRow([row.code, row.name, row.description, row.enabled]),
//     ),
//   );
//   return Prisma.sql`
//     UPDATE "Role" AS r
//     SET
//       name = v.name,
//       description = COALESCE(v.description, r.description),
//       enabled = COALESCE(v.enabled::boolean, r.enabled),
//       "updatedAt" = CURRENT_TIMESTAMP
//     FROM (VALUES ${values}) AS v(code, name, description, enabled)
//     WHERE r.code = v.code
//   `;
// }

export function sqlBatchUpdateDictionaryTypes(
  rows: Array<{ code: string; name: string; enabled: boolean | null }>,
) {
  const values = Prisma.join(
    rows.map((row) => sqlValueRow([row.code, row.name, row.enabled])),
  );
  return Prisma.sql`
    UPDATE "DictionaryType" AS d
    SET
      name = v.name,
      enabled = COALESCE(v.enabled::boolean, d.enabled),
      "updatedAt" = CURRENT_TIMESTAMP
    FROM (VALUES ${values}) AS v(code, name, enabled)
    WHERE d.code = v.code
  `;
}

export function sqlBatchUpdateDictionaryItems(
  rows: Array<{
    typeId: string;
    value: string;
    label: string;
    sort: number;
    enabled: boolean | null;
  }>,
) {
  const values = Prisma.join(
    rows.map((row) =>
      sqlValueRow([row.typeId, row.value, row.label, row.sort, row.enabled]),
    ),
  );
  return Prisma.sql`
    UPDATE "DictionaryItem" AS i
    SET
      label = v.label,
      sort = v.sort::int,
      enabled = COALESCE(v.enabled::boolean, i.enabled),
      "updatedAt" = CURRENT_TIMESTAMP
    FROM (VALUES ${values}) AS v("typeId", value, label, sort, enabled)
    WHERE i."typeId" = v."typeId" AND i.value = v.value
  `;
}
