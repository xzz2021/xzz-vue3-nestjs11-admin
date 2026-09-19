# Permission / Menu 模块

权限在数据上独立为 `Permission` 表，HTTP 由 Menu 管理页维护；后端模块拆为 `menu` 与 `permission`。

## Menu API（`system/menu`）

| 方法   | 路径                | 权限          |
| ------ | ------------------- | ------------- |
| POST   | `/menu/add`         | `menu:add`    |
| POST   | `/menu/update`      | `menu:update` |
| GET    | `/menu/getMenuList` | `menu:view`   |
| DELETE | `/menu/:id`         | `menu:delete` |
| POST   | `/menu/sort`        | `menu:update` |

菜单字段同时承载前端路由：`path`、`component`、`redirect`、keepAlive、icon、hidden 等。

## Permission API（`system/permission`）

| 方法   | 路径                 | 权限          |
| ------ | -------------------- | ------------- |
| POST   | `/permission/add`    | `menu:add`    |
| POST   | `/permission/update` | `menu:update` |
| DELETE | `/permission/:id`    | `menu:delete` |

权限 CRUD 复用 **menu:*** 权限码，无独立 `permission:*` 控制器注解。

## 运行时校验

见 [permission.md](../architecture/permission.md)：`@RequiredPermission` + `PermissionGuard` + Redis 缓存。

## 前端

- 菜单页：`apps/web/src/views/Authorization/Menu/`（含 `AddButtonPermission.vue`、排序、编辑）
- 无独立 Permission 路由页
- 指令：`directives/permission/hasPermi.ts`（`meta.permissions`）
- 组件：`components/Permission/`（`meta.permission`）

## Seed

- 初始菜单/权限：`apps/server/prisma/seed/data.ts` + `seed.ts`
- 权限 code 形如 `user:view`（resource 取菜单 path）
- `PermissionType.FIELD` 已在 schema / 迁移中存在
