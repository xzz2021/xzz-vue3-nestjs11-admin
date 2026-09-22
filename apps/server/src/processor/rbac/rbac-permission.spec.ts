import { ALL_PERMISSIONS, resolvePermissionCodes } from "./rbac-permission.js";

describe("resolvePermissionCodes", () => {
  it("returns enabled role permission codes without duplicates", () => {
    expect(
      resolvePermissionCodes({
        roles: [
          {
            role: {
              code: "disabled",
              enabled: false,
              permissions: [
                { permission: { code: "user:delete", enabled: true } },
              ],
            },
          },
          {
            role: {
              code: "admin",
              enabled: true,
              permissions: [
                { permission: { code: "user:update", enabled: true } },
                { permission: { code: "user:update", enabled: true } },
                { permission: { code: "user:delete", enabled: false } },
              ],
            },
          },
        ],
      }),
    ).toEqual(["user:update"]);
  });

  it("grants all permissions to an enabled super admin role", () => {
    expect(
      resolvePermissionCodes({
        roles: [
          {
            role: {
              code: "super_admin",
              enabled: true,
              permissions: [],
            },
          },
        ],
      }),
    ).toEqual([ALL_PERMISSIONS]);
  });

  it("returns an empty list for a missing or disabled user", () => {
    expect(resolvePermissionCodes(null)).toEqual([]);
  });
});
