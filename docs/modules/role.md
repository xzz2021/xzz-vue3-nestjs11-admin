# Role 模块

路径：`apps/server/src/system/role/`

## HTTP API

| 方法   | 路径                          | 权限                                    |
| ------ | ----------------------------- | --------------------------------------- |
| GET    | `/role/getRoleList`           | `role:view`                             |
| POST   | `/role/add`                   | `role:add`                              |
| POST   | `/role/update`                | `role:update`                           |
| DELETE | `/role/:id`                   | `role:delete`                           |
| GET    | `/role/getRoleDetail/:id`     | `role:view`                             |
| GET    | `/role/getRoleMenuAndPer/:id` | `role:view`                             |
| GET    | `/role/getRoleMenu`           | `@Authenticated()`（当前用户菜单+权限） |
| POST   | `/role/generateRoleSeed`      | `role:seed`                             |

## 行为要点

- 角色绑定菜单（RoleMenu）与权限（RolePermission），自定义数据范围写 `RolePermissionDepartment`
- 创建角色时写入 `createdById`（当前登录用户）；删除用户时创建人外键 SetNull
- `getRoleDetail` 通过 `createdBy` 关系读取用户名，对外字段仍为 `creatorName`，不返回 User 对象
- `getRoleMenu` 供前端登录后生成动态路由
- 系统角色（`isSystem`）不可删除；超管约定 code：`super_admin`
- `role:seed` 等导出类权限码不一定在初始 seed 权限数据里，空库超管靠 `*` 通配

## 前端

- 列表：`apps/web/src/views/Authorization/Role/Role.vue`
- 分配：`AssignMenuPermission.vue`（隐藏路由 `/role/assign/:id?`）
- 详情：`RoleDetail.vue`
- API：`apps/web/src/api/role/`
