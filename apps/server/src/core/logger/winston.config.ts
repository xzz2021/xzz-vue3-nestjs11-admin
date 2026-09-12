import { utilities as nestWinstonModuleUtilities } from "nest-winston";
import * as winston from "winston";
import "winston-daily-rotate-file";

export const LOG_FILE_DIR = "logs";
export const LOG_FILE_FILENAME = "app-%DATE%.log";
export const LOG_FILE_DATE_PATTERN = "YYYY-MM-DD-HH";
export const LOG_FILE_MAX_SIZE = "2m";
export const LOG_FILE_MAX_FILES = 10;
export const LOG_FILE_LEVEL = "warn";

export interface WinstonEnvOptions {
  isProduction: boolean;
  level: string;
  appName: string;
  fileEnabled?: boolean;
}

export function createLogFileTransportOptions() {
  return {
    level: LOG_FILE_LEVEL,
    dirname: LOG_FILE_DIR,
    filename: LOG_FILE_FILENAME,
    datePattern: LOG_FILE_DATE_PATTERN,
    maxSize: LOG_FILE_MAX_SIZE,
    maxFiles: LOG_FILE_MAX_FILES,
    auditFile: "logs/.audit/app.json",
  };
}

export function createWinstonOptions(
  env: WinstonEnvOptions,
): winston.LoggerOptions {
  const consoleFormat = env.isProduction
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      )
    : winston.format.combine(
        winston.format.timestamp(),
        winston.format.ms(),
        nestWinstonModuleUtilities.format.nestLike(env.appName, {
          colors: true,
          prettyPrint: true,
          processId: true,
          appName: true,
        }),
      );

  const fileTransport = env.fileEnabled
    ? new winston.transports.DailyRotateFile({
        ...createLogFileTransportOptions(),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.errors({ stack: true }),
          winston.format.json(),
        ),
      })
    : undefined;

  const transports = [
    new winston.transports.Console({ format: consoleFormat }),
    ...(fileTransport ? [fileTransport] : []),
  ];

  return {
    level: env.level,
    defaultMeta: { service: env.appName },
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.ms(),
    ),
    transports,
  };
}
