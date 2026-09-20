import { loadAppEnv } from "#/core/load-env.js";
import { parseCorsOrigins } from "#/processor/utils/cors.util.js";
import { ConfigModule } from "@nestjs/config";
import { z } from "zod";

loadAppEnv();

interface AppConfig {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  pgDatabaseUrl: string;
  token: {
    secret: string;
    refreshSecret: string;
    expiresTime: number;
    refreshExpiresTime: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    url: string;
  };
  ssoCount: number;
  swagger: {
    enabled: boolean;
    username: string;
    password: string;
  };
  // serverUrl: string;
  // frontendUrl: string;
  // n8nHost: string;
  // 静态文件目录
  staticFileRootPath: string;
  // 静态文件访问前缀
  staticFileServeRoot: string;
  fileUpload: {
    maxBytes: number;
    chunkBytes: number;
    sessionTtlHours: number;
    maxOpenSessions: number;
  };
  dbBackup: {
    dir: string;
    cron: string;
    timezone: string;
    retentionMax: number;
    filePrefix: string;
    gzip: boolean;
  };
  logger: {
    fileEnabled: boolean;
  };
  corsOrigins: string[];

  // 可以添加更多配置项
  [key: string]: any;
}

const weakSecretPattern = /(change-me|replace-with|password|xzz20)/i;

const productionEnvironmentSchema = z
  .object({
    NODE_ENV: z.literal("production"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    PG_DATABASE_URL: z
      .string()
      .url()
      .startsWith("postgresql://")
      .refine(
        (value) => value.length >= 40 && !weakSecretPattern.test(value),
        "PG_DATABASE_URL contains a placeholder or weak password",
      ),
    TOKEN_SECRET: z.string().min(6),
    TOKEN_REFRESH_SECRET: z.string().min(6),
    TOKEN_EXPIRES_TIME: z.coerce.number().int().positive().default(300),
    TOKEN_REFRESH_EXPIRES_TIME: z.coerce
      .number()
      .int()
      .positive()
      .default(259200),
    REDIS_HOST: z.string().min(1),
    REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
    REDIS_PASSWORD: z
      .string()
      .min(6)
      .refine(
        (value) => !weakSecretPattern.test(value),
        "REDIS_PASSWORD is a placeholder or weak value",
      ),
    STATIC_FILE_ROOT_PATH: z.string().min(1),
    STATIC_FILE_SERVE_ROOT: z.string().min(1),
    SWAGGER: z.enum(["true", "false"]).default("false"),
    SWAGGER_USERNAME: z.string().min(1).optional(),
    SWAGGER_PASSWORD: z
      .string()
      .min(6)
      .refine(
        (value) => !weakSecretPattern.test(value),
        "SWAGGER_PASSWORD is a placeholder or weak value",
      )
      .optional(),
  })
  .passthrough()
  .superRefine((environment, context) => {
    if (environment.SWAGGER !== "true") return;
    if (!environment.SWAGGER_USERNAME) {
      context.addIssue({
        code: "custom",
        path: ["SWAGGER_USERNAME"],
        message: "SWAGGER_USERNAME is required when Swagger is enabled",
      });
    }
    if (!environment.SWAGGER_PASSWORD) {
      context.addIssue({
        code: "custom",
        path: ["SWAGGER_PASSWORD"],
        message: "SWAGGER_PASSWORD is required when Swagger is enabled",
      });
    }
  });

export function validateEnvironment(environment: Record<string, unknown>) {
  if (environment.NODE_ENV !== "production") {
    return environment;
  }

  return productionEnvironmentSchema.parse(environment);
}

// 应用配置工厂函数
export const appConfig = (): AppConfig => {
  const processEnv = process.env;
  const nodeEnv = processEnv.NODE_ENV || "development";
  return {
    nodeEnv,
    isProduction: nodeEnv === "production",
    port: parseInt(processEnv.PORT || "3000"),
    pgDatabaseUrl: processEnv.PG_DATABASE_URL || "",
    token: {
      secret: processEnv.TOKEN_SECRET || "",
      refreshSecret: processEnv.TOKEN_REFRESH_SECRET || "",
      expiresTime: parseInt(processEnv.TOKEN_EXPIRES_TIME || "300", 10),
      refreshExpiresTime: parseInt(
        processEnv.TOKEN_REFRESH_EXPIRES_TIME || "259200",
        10,
      ),
    },
    redis: {
      host: processEnv.REDIS_HOST || "",
      port: parseInt(processEnv.REDIS_PORT || "6379", 10),
      // 空字符串勿写入：ioredis 仍会 AUTH，本地无密码 Redis 会刷 WARN
      password: processEnv.REDIS_PASSWORD?.trim() || undefined,
      url: processEnv.REDIS_URL || "",
    },
    ssoCount: parseInt(processEnv.SSO_COUNT || "3", 10),
    swagger: {
      enabled: processEnv.SWAGGER === "true",
      username: processEnv.SWAGGER_USERNAME || "",
      password: processEnv.SWAGGER_PASSWORD || "",
    },
    staticFileRootPath: processEnv.STATIC_FILE_ROOT_PATH || "",
    staticFileServeRoot: processEnv.STATIC_FILE_SERVE_ROOT || "",
    fileUpload: {
      maxBytes: parseInt(processEnv.FILE_UPLOAD_MAX_BYTES || "524288000", 10),
      chunkBytes: parseInt(processEnv.FILE_UPLOAD_CHUNK_BYTES || "5242880", 10),
      sessionTtlHours: parseInt(
        processEnv.FILE_UPLOAD_SESSION_TTL_HOURS || "24",
        10,
      ),
      maxOpenSessions: parseInt(
        processEnv.FILE_UPLOAD_MAX_OPEN_SESSIONS || "5",
        10,
      ),
    },
    dbBackup: {
      dir: processEnv.DB_BACKUP_DIR || "backups",
      cron: processEnv.DB_BACKUP_CRON || "0 0 * * * *",
      timezone: processEnv.DB_BACKUP_TIMEZONE || "Asia/Shanghai",
      retentionMax: parseInt(processEnv.DB_BACKUP_RETENTION_MAX || "24", 10),
      filePrefix: processEnv.DB_BACKUP_PREFIX || "backstage_db",
      gzip: processEnv.DB_BACKUP_GZIP
        ? processEnv.DB_BACKUP_GZIP === "true"
        : true,
    },
    helmet: processEnv.HELMET
      ? processEnv.HELMET === "true"
      : nodeEnv === "production",
    logger: {
      fileEnabled: processEnv.LOG_FILE === "true",
    },
    corsOrigins: parseCorsOrigins(processEnv.CORS_ORIGINS),
  };
};

// 默认导出保持向后兼容
export default appConfig;

// 完整的配置模块，集成所有配置
export const CONFIG_MODULE = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  ignoreEnvFile: true, // 注释  代表允许使用 .env 文件
  expandVariables: true,
  validate: validateEnvironment,
  load: [
    appConfig, // 应用配置
    // 可以在这里添加其他配置工厂函数
  ],

  /*
  //  同时兼容env配置
  envFilePath: (() => {
    const env = process.env.NODE_ENV;
    console.log('🛠️ 当前使用的环境文件:', `.env.${env}`);
    return [`.env.${env}`, '.env'];
  })(),

  */
  // validationSchema: Joi.object({
  //   NODE_ENV: Joi.string().valid('development', 'production').required(),
  //   PORT: Joi.number().required(),
  //   // 可以添加更多验证规则
  // }),
});

/*

// 完整的配置模块
export const COMPLETE_CONFIG_MODULE = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  ignoreEnvFile: false, // 允许使用 .env 文件
  expandVariables: true,
  load: [
    appConfig, // 应用配置 (TypeScript 配置)
    mail, // 邮件配置
    wxPay, // 微信支付配置
    aliSms, // 阿里云短信配置
    moduleFactory, // 模块工厂配置
    redis, // Redis 配置
    minio, // MinIO 配置
  ],
  envFilePath: (() => {
    const env = process.env.NODE_ENV;
    console.log('🛠️ 当前使用的环境文件:', `.env.${env}`);
    return [`.env.${env}`, '.env'];
  })(),

});

// 仅应用配置的模块（轻量级）
export const APP_CONFIG_MODULE = ConfigModule.forRoot({
  isGlobal: true,
  cache: true,
  ignoreEnvFile: false,
  expandVariables: true,
  load: [appConfig],
  envFilePath: (() => {
    const env = process.env.NODE_ENV;
    console.log('🛠️ 当前使用的环境文件:', `.env.${env}`);
    return [`.env.${env}`, '.env'];
  })(),
});

*/
