# OSS 模块

路径：`apps/server/src/system/oss/`  
前端：`apps/web/src/views/System/Oss/`

S3 兼容对象存储（MinIO / AWS）。配置缺失时进程仍启动，`/oss/*` 返回 503。

## 环境变量

`OSS_S3_ENDPOINT`、`OSS_S3_ACCESS_KEY`、`OSS_S3_SECRET_KEY`、`OSS_S3_BUCKET` 为启用所需。可选：`OSS_S3_REGION`、`OSS_S3_FORCE_PATH_STYLE`。

详见 [environment.md](../deployment/environment.md)。

## HTTP API

| 方法   | 路径                                  | 权限        |
| ------ | ------------------------------------- | ----------- |
| GET    | `/oss/config`                         | `oss:view`  |
| GET    | `/oss/objects`                        | `oss:view`  |
| GET    | `/oss/objects/presign`                | `oss:view`  |
| POST   | `/oss/folders`                        | `oss:add`   |
| POST   | `/oss/uploads/presign`                | `oss:add`   |
| POST   | `/oss/uploads/multipart`              | `oss:add`   |
| GET    | `/oss/uploads/multipart/parts`        | `oss:add`   |
| GET    | `/oss/uploads/multipart/presign-part` | `oss:add`   |
| POST   | `/oss/uploads/multipart/complete`     | `oss:add`   |
| POST   | `/oss/uploads/multipart/abort`        | `oss:add`   |
| POST   | `/oss/objects/copy`                   | `oss:add`   |
| DELETE | `/oss/objects`                        | `oss:delete`|
| GET    | `/oss/folders/archive`                | `oss:view`  |

浏览器直传依赖 bucket CORS。本仓库不自动修改 CORS。
