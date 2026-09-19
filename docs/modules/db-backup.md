# 数据库备份模块

路径：`apps/server/src/system/db-backup/`  
前端：`apps/web/src/views/System/DatabaseBackup/`

通过 BullMQ 调用容器内 `pg_dump`。生产镜像已安装 `postgresql18-client`。本地调试需要本机 `pg_dump`。

## HTTP API

| 方法   | 路径                     | 权限                    |
| ------ | ------------------------ | ----------------------- |
| GET    | `/db-backup/config`      | `databaseBackup:view`   |
| POST   | `/db-backup/config`      | `databaseBackup:update` |
| POST   | `/db-backup/run`         | `databaseBackup:run`    |
| GET    | `/db-backup/jobs`        | `databaseBackup:view`   |
| GET    | `/db-backup/download/:id`| `databaseBackup:download` |
| DELETE | `/db-backup/jobs/:id`    | `databaseBackup:delete` |
| POST   | `/db-backup/cleanup`     | `databaseBackup:delete` |

## 行为要点

- 配置存在 `DbBackupConfig`（固定 id `default`），任务在 `DbBackupJob`
- 环境变量 `DB_BACKUP_*` 提供默认 cron / 时区 / 保留数 / gzip；运行时以库内配置为准
- 目录默认 `backups`；Compose 把 `./data/server/backups` 挂到 `/app/apps/server/backups`
- 队列名 `db-backup`，手动任务与定时任务分开；Redis 锁避免并发 dump
- 失败会发内部告警消息（有去重）

备份文件属主必须是容器用户 `node`（uid 1000），否则写入 EACCES。
