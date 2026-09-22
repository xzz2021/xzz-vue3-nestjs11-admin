import {
  USER_IMPORT_COLUMNS,
  parseUserImportRow,
  serializeUserExportRow,
  userImportTemplateCsv,
} from "./user.csv.js";

describe("user CSV mapping", () => {
  it("exposes an import template with the declared columns", () => {
    expect(userImportTemplateCsv()).toContain(USER_IMPORT_COLUMNS.join(","));
  });

  it("parses role codes separated by semicolon or comma", () => {
    expect(
      parseUserImportRow({
        username: "zhangsan",
        phone: "13800138000",
        password: "ChangeMe_Now!",
        departmentId: "dept-1",
        roleCodes: "admin;user",
      }),
    ).toMatchObject({
      username: "zhangsan",
      phone: "13800138000",
      departmentId: "dept-1",
      roleCodes: ["admin", "user"],
      enabled: true,
    });
  });

  it("treats blank optional fields as omitted", () => {
    const row = parseUserImportRow({
      username: "lisi",
      phone: "13900139000",
      password: "ChangeMe_Now!",
      nickname: "",
      email: "",
      departmentId: "dept-1",
      roleCodes: "",
      enabled: "false",
    });
    expect(row.nickname).toBeUndefined();
    expect(row.email).toBeUndefined();
    expect(row.roleCodes).toEqual([]);
    expect(row.enabled).toBe(false);
  });

  it("rejects invalid phones", () => {
    expect(() =>
      parseUserImportRow({
        username: "bad",
        phone: "123",
        password: "ChangeMe_Now!",
        departmentId: "dept-1",
      }),
    ).toThrow();
  });

  it("serializes export rows without password", () => {
    const line = serializeUserExportRow({
      username: "zhangsan",
      phone: "13800138000",
      nickname: null,
      email: null,
      departmentId: "dept-1",
      roleCodes: ["admin", "user"],
      enabled: true,
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
    });
    expect(line).toContain("admin;user");
    expect(line).toContain("2026-01-02T03:04:05.000Z");
    expect(line.toLowerCase()).not.toContain("password");
  });
});
