# RBAC 权限设计

## 模型

```
User ──< UserRole >── Role ──< RoleMenu >── Menu
                       │
                       └──< RolePermission >── Permission ──> Menu
                                      │
                                      └──< RolePermissionDepartment >── Department
```

- **菜单**：驱动前端路由与侧栏（字段含 path、component、meta 类属性）
- **权限**：挂在菜单下，`code` 全局唯一（如 `user:view`），类型含 BUTTON / DATA / API / FIELD / OTHER
- **角色**：绑定菜单集合 + 权限集合；`isSystem` 系统角色不可删
- **超管**：角色 `code === 'super_admin'` 在后端 Guard 中视为拥有 `*`
- **数据范围**：`RolePermission.dataScope` 为 ALL / SELF / DEPT / DEPT_TREE / CUSTOM_DEFINE；自定义部门写在 `RolePermissionDepartment`

Seed 中权限编码规则：`code = \`${resource}:${action}\``，`resource` 对应该菜单 `path`。

## 后端校验

关键代码：

- 装饰器：`apps/server/src/processor/decorator/permission.ts` → `@RequiredPermission(code)`；仅登录用 `@Authenticated()`
- Guard：`apps/server/src/processor/guard/permission.ts`（全局 APP_GUARD）
- 缓存：`RbacPermissionCacheService`（TTL 约 5 分钟 + 抖动；未命中 singleflight；失效靠 per-user 版本号）
- 未命中：`UserRepository.findEnabledRolePermissionTree`，再解析权限码
- 数据范围：`AuthorizationService` 构建授权快照（`authorization:snapshot:{userId}`）

流程：

1. `@Public()` → 放行（JWT 已跳过）
2. `@RequiredPermission` → 取 `request.user.id`，校验权限码
3. `@Authenticated()` → 仅要求已登录
4. 以上都没有 → `403 接口未配置访问权限`（fail-closed）
5. `PermissionGuard` 先读 Redis 权限缓存；未命中再走 User 仓储；空权限列表会负缓存
6. 含 `*` 或精确匹配所需 code → 通过
7. 角色/权限/部门变更后递增 generation 并删 Redis；CAS Lua 防止旧快照回写

CASL（`@casl/ability`）只用于 Customer 的字段/属性规则，不是全局策略引擎。详见 [customer.md](../modules/customer.md)。

## 前端校验

| 层       | 机制                                                         |
| -------- | ------------------------------------------------------------ |
| 路由     | 仅加载角色菜单对应的动态路由                                 |
| 按钮     | `v-hasPermi` / `<Permission>` / 页面校验均对照 `meta.permissions` |
| 菜单维护 | `views/Authorization/Menu` + `permission/*` API              |

服务端接口 `GET /role/getRoleMenu` 返回当前用户菜单与权限，供登录后初始化。

## 权限码与接口对照（摘录）

| 权限码示例                                                                          | 使用位置                                    |
| ----------------------------------------------------------------------------------- | ------------------------------------------- |
| `user:view` / `user:add` / `user:update` / `user:delete`                            | UserController                              |
| `customer:view` / `detail` / `add` / `update` / `delete` / `export`                 | CustomerController；范围由 DataScope 约束   |
| `role:view` / `role:add` / `role:update` / `role:delete` / `role:seed`              | RoleController                              |
| `menu:view` / `menu:add` / `menu:update` / `menu:delete`                            | MenuController；Permission CRUD 复用 menu:* |
| `department:*` / `dictionary:*`                                                     | 对应模块                                    |
| `fileList:view` / `add` / `delete`                                                  | StaticfileController                        |
| `oss:view` / `oss:add` / `oss:delete`                                               | OssController                               |
| `onlineUser:view` / `kick`                                                          | OnlineController                            |
| `server:view`                                                                       | MonitorController                           |
| `notification:send`                                                                 | 发送站内信 / 系统通知                       |
| `databaseBackup:view` / `update` / `run` / `download` / `delete`                    | DbBackupController                          |
| `userLog:view` / `delete`                                                           | LoggerController（访问日志）                |
| `auditLog:view`                                                                     | LoggerController（操作日志 / 登录日志，无删除；`category=login` 筛登录类动作） |

消息收件箱（list / 已读 / 删除）以及 `GET /message/receivers` 当前只需登录，没有 `notification:send`。

## 与会话的关系

- Access Token：Bearer，全局 JWT Guard 校验；前端只放内存，刷新页用 `rt` 重签
- Refresh Token：httpOnly cookie `rt`（双 token 登录路径）
- 强制下线 / kick：撤销会话 + WS 通知
- SSO：`SSO_COUNT` 限制同用户最大会话数

详见 [authentication.md](../api/authentication.md)。
