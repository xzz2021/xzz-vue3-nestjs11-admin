# User 模块

路径：`apps/server/src/system/user/`

## HTTP API

| 方法   | 路径                       | 权限                 |
| ------ | -------------------------- | -------------------- |
| GET    | `/user/list`               | `user:view`          |
| GET    | `/user/listByDepartmentId` | `user:view`          |
| GET    | `/user/lookup`             | `@Authenticated()`   |
| GET    | `/user/detailInfo`         | `@Authenticated()`   |
| POST   | `/user/add`                | `user:add`           |
| POST   | `/user/update`             | `user:update`        |
| DELETE | `/user/delete`             | `user:delete`        |
| POST   | `/user/updatePersonalInfo` | `@Authenticated()`（本人） |
| POST   | `/user/updatePassword`     | `@Authenticated()`（本人） |
| POST   | `/user/resetPassword`      | `user:update`        |
| POST   | `/user/upload/avatar`      | `@Authenticated()`   |

另有 `POST /auth/forceLogout`（权限 `user:update`）与在线踢人接口配合会话撤销。

## 数据

Prisma `User`：username、password（哈希，Client 默认 omit）、nickname、email、phone、avatar、enabled、department、roles、sessions、日志与消息关联。创建/更新用户角色时写入 `UserRole.assignedById`（当前操作人），删除用户时分配人外键 SetNull。用户列表按 `createdAt desc` 分页。

## 前端

- 页面：`apps/web/src/views/Authorization/User/`
- API：`apps/web/src/api/user/`
- 个人中心：`views/Personal/PersonalCenter/`（依赖服务端菜单，不是常量路由）
- Store：`store/modules/user.ts`
- 头像上传：`POST /user/upload/avatar`（登录即可，按当前用户 ID 更新）
