import { ApiProperty } from '@nestjs/swagger';
import {
  RESPONSE_SUCCESS_CODE,
  RESPONSE_SUCCESS_MSG,
} from '@/processor/constants/response.js';
import { formatDateToYMDHMS } from './date.js';

export class ResOp<T = unknown> {
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true })
  data: T | null;

  @ApiProperty({ type: 'number', default: RESPONSE_SUCCESS_CODE })
  code: number;

  @ApiProperty({ type: 'string', default: RESPONSE_SUCCESS_MSG })
  message: string;

  @ApiProperty({ type: 'string', description: '响应时间' })
  timestamp: string;

  constructor(code: number, data: T | null, message = RESPONSE_SUCCESS_MSG) {
    this.code = code;
    this.data = data ?? null;
    this.message = message;
    this.timestamp = formatDateToYMDHMS(new Date());
  }

  static success<T>(data?: T, message = RESPONSE_SUCCESS_MSG) {
    return new ResOp<T>(
      RESPONSE_SUCCESS_CODE,
      data === undefined ? null : data,
      message,
    );
  }

  static error(code: number, message: string, data: unknown = null) {
    return new ResOp(code, data, message);
  }
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * 将 Controller/Service 返回值收成统一成功信封。
 * handler 里的 `message` 提升到信封；数字 `code` 视为误用的状态码并丢弃（失败应抛 HttpException）。
 */
export function wrapSuccess(
  payload: unknown,
  defaultMessage = RESPONSE_SUCCESS_MSG,
): ResOp {
  if (payload instanceof ResOp) {
    return payload;
  }

  if (!isPlainObject(payload)) {
    return ResOp.success(payload, defaultMessage);
  }

  const rest: Record<string, unknown> = { ...payload };
  let resolvedMessage = defaultMessage;
  if (typeof rest.message === 'string' && rest.message.length > 0) {
    resolvedMessage = rest.message;
    delete rest.message;
  }
  if (typeof rest.code === 'number') {
    delete rest.code;
  }

  const keys = Object.keys(rest);
  if (keys.length === 0) {
    return ResOp.success(null, resolvedMessage);
  }
  if (keys.length === 1 && keys[0] === 'data') {
    return ResOp.success(rest.data, resolvedMessage);
  }
  return ResOp.success(rest, resolvedMessage);
}
