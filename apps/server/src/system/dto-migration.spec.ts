import { DeleteLogDto, QueryLogParams } from "#/core/logger/logger.dto.js";
import { CreatePermissionDto } from "#/system/permission/dto/permission.dto.js";
import { DeleteFileDto } from "#/system/staticfile/file.dto.js";
import {
  DepartmentSeedArrayDto,
  UpdateDepartmentDto,
} from "./department/dto/department.dto.js";
import {
  DeleteDictionaryDto,
  DictionarySeedArrayDto,
  UpsertDictionaryDto,
} from "./dictionary/dto/dictionary.dto.js";
import { DeleteItemDto, UpsertItemDto } from "./dictionary/dto/entry.dto.js";
import { MenuSortArrayDto, UpdateMenuDto } from "./menu/dto/menu.dto.js";
import { QueryRoleParams, UpdateRoleDto } from "./role/dto/role.dto.js";

describe("Migrated DTO schemas", () => {
  it("validates role pagination and update identifiers", () => {
    expect(
      QueryRoleParams.schema.parse({ pageIndex: "2", pageSize: "20" }),
    ).toMatchObject({
      pageIndex: 2,
      pageSize: 20,
    });
    expect(() => QueryRoleParams.schema.parse({ pageSize: 101 })).toThrow();
    expect(() =>
      UpdateRoleDto.schema.parse({ name: "管理员", code: "admin", menus: [] }),
    ).toThrow();
  });

  it("rejects self-parent menus and empty sort batches", () => {
    expect(() =>
      UpdateMenuDto.schema.parse({
        id: "menu-1",
        parentId: "menu-1",
        name: "User",
        path: "user",
        title: "用户管理",
      }),
    ).toThrow();
    expect(() => MenuSortArrayDto.schema.parse({ data: [] })).toThrow();
  });

  it("validates dictionary and dictionary item commands", () => {
    expect(
      UpsertDictionaryDto.schema.parse({
        name: "状态",
        code: "status",
      }),
    ).toMatchObject({ name: "状态", code: "status" });
    expect(() => DeleteDictionaryDto.schema.parse({ ids: [] })).toThrow();
    expect(
      DeleteItemDto.schema.parse({ ids: ["item-1", "item-1"] }).ids,
    ).toEqual(["item-1"]);
    expect(() =>
      UpsertItemDto.schema.parse({ dictionaryId: "", name: "启用", code: "1" }),
    ).toThrow();
    expect(
      DictionarySeedArrayDto.schema.parse({
        data: [
          {
            name: "状态",
            code: "status",
            entries: [{ name: "启用", code: "1" }],
          },
        ],
      }).data,
    ).toHaveLength(1);
  });

  it("validates recursive department seeds and prevents direct self-parenting", () => {
    expect(
      DepartmentSeedArrayDto.schema.parse({
        data: [{ name: "总部", children: [{ name: "研发部" }] }],
      }).data,
    ).toHaveLength(1);
    expect(() =>
      UpdateDepartmentDto.schema.parse({
        id: "department-1",
        parentId: "department-1",
        name: "研发部",
      }),
    ).toThrow();
  });

  it("enforces log and file command bounds", () => {
    expect(QueryLogParams.schema.parse({})).toMatchObject({
      pageIndex: 1,
      pageSize: 10,
    });
    expect(() => DeleteLogDto.schema.parse({ ids: [] })).toThrow();
    expect(() => DeleteFileDto.schema.parse({ ids: [] })).toThrow();
  });

  it("validates permission menu identifiers", () => {
    expect(() =>
      CreatePermissionDto.schema.parse({
        name: "查看",
        code: "user:view",
        type: "BUTTON",
        menuId: "",
      }),
    ).toThrow();
  });
});
