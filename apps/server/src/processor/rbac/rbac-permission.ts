export const SUPER_ADMIN_ROLE = "super_admin";
export const ALL_PERMISSIONS = "*";

export type RolePermissionTree = {
  roles: Array<{
    role: {
      code: string;
      enabled: boolean;
      permissions: Array<{
        permission: {
          code: string;
          enabled: boolean;
        };
      }>;
    };
  }>;
};

export function resolvePermissionCodes(
  user: RolePermissionTree | null,
): string[] {
  if (!user) return [];
  const enabledRoles = user.roles
    .map((item) => item.role)
    .filter((role) => role.enabled);
  if (enabledRoles.some((role) => role.code === SUPER_ADMIN_ROLE)) {
    return [ALL_PERMISSIONS];
  }
  return [
    ...new Set(
      enabledRoles.flatMap((role) =>
        role.permissions
          .filter((item) => item.permission.enabled)
          .map((item) => item.permission.code),
      ),
    ),
  ];
}
