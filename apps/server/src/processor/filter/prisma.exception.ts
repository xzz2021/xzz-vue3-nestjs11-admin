import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from '@/generated/prisma/internal/prismaNamespace.js';

export type PrismaErrorResult = {
  msg: string;
  meta?: string;
  /** 瞬时故障（连接拒绝、库启动中等），应返回 503 */
  transient?: boolean;
};

const TRANSIENT_CODES = new Set([
  'P1001', // Can't reach database
  'P1002', // Database timeout
  'P1008', // Operations timed out
  'P1017', // Server closed connection
  'P2034', // Transaction write conflict or deadlock
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  '57P03', // PostgreSQL: cannot_connect_now / starting up
  '40P01', // PostgreSQL: deadlock_detected
]);

const TRANSIENT_MSG_RE =
  /starting up|ECONNREFUSED|ECONNRESET|ETIMEDOUT|Connection terminated|Can't reach database|connect ECONNREFUSED|the database system is starting up|too many connections|Connection refused|Timed out fetching|Engine is not yet connected|Server has closed|ConnectorError|connect ENOENT/i;

function isTransientMessage(message?: string) {
  return !!message && TRANSIENT_MSG_RE.test(message);
}

/** 是否为数据库瞬时不可用（连接失败 / 启动中等） */
export function isTransientDbError(exception: unknown): boolean {
  if (checkPrismaError(exception)?.transient) return true;

  // Prisma 有时把根因挂在 cause 上，message 本身不含关键字
  if (exception && typeof exception === 'object' && 'cause' in exception) {
    const cause = exception.cause;
    if (cause && cause !== exception) return isTransientDbError(cause);
  }
  return false;
}

export const checkPrismaError = (
  exception: unknown,
): PrismaErrorResult | null => {
  if (exception instanceof PrismaClientKnownRequestError) {
    if (
      TRANSIENT_CODES.has(exception.code) ||
      isTransientMessage(exception.message)
    ) {
      return {
        msg: '数据库暂不可用，请稍后重试',
        meta: exception.message,
        transient: true,
      };
    }
    console.log('TCL: exception', exception);
    switch (exception.code) {
      case 'P2002':
        return { msg: '数据已存在或复合主键冲突', meta: exception.message };
      case 'P2025':
        return { msg: '当前id记录未找到', meta: exception.message };
      case 'P2003':
        return { msg: '外键约束失败', meta: exception.message };
      case 'P2014':
        return { msg: '关系约束失败', meta: exception.message };
      default:
        return {
          msg: `数据库操作失败: ${exception.code}`,
          meta: exception.message,
        };
    }
  }

  if (exception instanceof PrismaClientInitializationError) {
    return {
      msg: '数据库暂不可用，请稍后重试',
      meta: exception.message,
      transient: true,
    };
  }
  if (exception instanceof PrismaClientRustPanicError) {
    return { msg: '数据库Rust Panic', meta: exception.message };
  }

  if (exception instanceof PrismaClientUnknownRequestError) {
    if (isTransientMessage(exception.message)) {
      return {
        msg: '数据库暂不可用，请稍后重试',
        meta: exception.message,
        transient: true,
      };
    }
    return { msg: '未知的数据库错误', meta: exception.message };
  }

  if (exception instanceof PrismaClientValidationError) {
    return { msg: '数据验证失败', meta: exception.message };
  }

  // DriverAdapterError / pg 原生错误等
  if (exception instanceof Error && isTransientMessage(exception.message)) {
    return {
      msg: '数据库暂不可用，请稍后重试',
      meta: exception.message,
      transient: true,
    };
  }

  if (
    exception &&
    typeof exception === 'object' &&
    'code' in exception &&
    typeof exception.code === 'string'
  ) {
    const err = exception as {
      code: string;
      message?: string;
      toString?: () => string;
    };
    const meta = err.message || err.toString?.();
    if (TRANSIENT_CODES.has(err.code) || isTransientMessage(meta)) {
      return { msg: '数据库暂不可用，请稍后重试', meta, transient: true };
    }
    switch (err.code) {
      case 'P2002':
        return { msg: '数据已存在或复合主键冲突', meta };
      case 'P2025':
        return { msg: '当前id记录未找到', meta };
      case 'P2003':
        return { msg: '外键约束失败', meta };
      case 'P2014':
        return { msg: '关系约束失败', meta };
      case 'EPROTO':
        return { msg: 'minio连接失败', meta };
      default:
        return { msg: `数据库操作失败: ${err.code}`, meta };
    }
  }

  return null;
};
