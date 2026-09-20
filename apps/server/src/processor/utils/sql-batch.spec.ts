import { Prisma } from "#/prisma/generated/prisma/client";
import {
  sqlBatchUpdateDictionaryItems,
  sqlBatchUpdateDictionaryTypes,
  sqlBatchUpdateIntById,
  sqlReplaceDescendantPaths,
} from "./sql-batch";

function inspectSql(sql: Prisma.Sql) {
  return {
    text: "sql" in sql ? String(sql.sql) : String(sql),
    values: "values" in sql ? sql.values : [],
  };
}

describe("sqlReplaceDescendantPaths", () => {
  it("rewrites descendant materialized paths in one statement", () => {
    const { text, values } = inspectSql(
      sqlReplaceDescendantPaths("/root-a/node", "/root-b/node"),
    );

    expect(text).toMatch(/UPDATE\s+"Department"/i);
    expect(text).toMatch(/regexp_replace/i);
    expect(values).toEqual(
      expect.arrayContaining([
        "^/root-a/node",
        "/root-b/node",
        "/root-a/node/%",
      ]),
    );
  });
});

describe("sqlBatchUpdateIntById", () => {
  it("updates many integer columns with a single VALUES join", () => {
    const { text, values } = inspectSql(
      sqlBatchUpdateIntById('"Menu"', "sort", [
        { id: "a", value: 1 },
        { id: "b", value: 2 },
      ]),
    );

    expect(text).toMatch(/UPDATE\s+"Menu"/i);
    expect(text).toMatch(/VALUES/i);
    expect(values).toEqual(expect.arrayContaining(["a", 1, "b", 2]));
  });
});

describe("sqlBatchUpdateDictionaryTypes", () => {
  it("updates existing dictionary types by unique code in one statement", () => {
    const { text } = inspectSql(
      sqlBatchUpdateDictionaryTypes([
        { code: "status", name: "状态", enabled: true },
      ]),
    );

    expect(text).toMatch(/UPDATE\s+"DictionaryType"/i);
  });
});

describe("sqlBatchUpdateDictionaryItems", () => {
  it("updates existing dictionary items by typeId and value in one statement", () => {
    const { text, values } = inspectSql(
      sqlBatchUpdateDictionaryItems([
        { typeId: "t1", value: "on", label: "启用", sort: 1, enabled: true },
      ]),
    );

    expect(text).toMatch(/UPDATE\s+"DictionaryItem"/i);
    expect(values).toEqual(expect.arrayContaining(["t1", "on", "启用", 1]));
  });
});
