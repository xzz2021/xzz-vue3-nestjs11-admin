import {
  BatchDeleteUserDto,
  CreateUserDto,
  QueryUserParams,
  UpdatePwdDto,
  UpdateUserDto,
} from "./user.dto.js";

describe("User DTO schemas", () => {
  it("coerces query values and applies safe pagination defaults", () => {
    expect(QueryUserParams.schema.parse({ enabled: "false" })).toMatchObject({
      pageIndex: 1,
      pageSize: 10,
      enabled: false,
    });
    expect(
      QueryUserParams.schema.parse({ pageIndex: "2", pageSize: "20" }),
    ).toMatchObject({
      pageIndex: 2,
      pageSize: 20,
    });
  });

  it.each([{ pageIndex: 0 }, { pageSize: 0 }, { pageSize: 101 }])(
    "rejects unsafe pagination: %o",
    (input) => {
      expect(() => QueryUserParams.schema.parse(input)).toThrow();
    },
  );

  it("requires initial password when creating a user", () => {
    expect(() =>
      CreateUserDto.schema.parse({
        username: "admin",
        phone: "13800138000",
        department: "department-1",
      }),
    ).toThrow();

    expect(
      CreateUserDto.schema.parse({
        username: "admin",
        phone: "13800138000",
        department: "department-1",
        password: "ChangeMe_Now!",
      }),
    ).toMatchObject({ password: "ChangeMe_Now!" });
  });

  it("deduplicates role identifiers during user updates", () => {
    const result = UpdateUserDto.schema.parse({
      id: "user-1",
      username: "admin",
      phone: "13800138000",
      department: "department-1",
      roles: ["role-1", "role-1", "role-2"],
    });

    expect(result.roles).toEqual(["role-1", "role-2"]);
  });

  it("enforces password length for password changes", () => {
    expect(() =>
      UpdatePwdDto.schema.parse({
        id: "user-1",
        password: "12345",
        newPassword: "123456",
      }),
    ).toThrow();
  });

  it("rejects empty deletes and deduplicates user identifiers", () => {
    expect(() => BatchDeleteUserDto.schema.parse({ ids: [] })).toThrow();
    expect(
      BatchDeleteUserDto.schema.parse({ ids: ["user-1", "user-1"] }).ids,
    ).toEqual(["user-1"]);
  });
});
