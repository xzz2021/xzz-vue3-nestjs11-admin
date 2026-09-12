import { HttpException, HttpStatus } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { formatZodErrorMessage } from '@/processor/pipe/zod-error.util.js';

export interface ParsedException {
  status: number;
  message: string;
  meta: unknown;
}

export function parseException(exception: unknown): ParsedException {
  if (exception instanceof ZodValidationException) {
    const status = exception.getStatus();
    const response = exception.getResponse();
    const zodError = exception.getZodError();
    const message = formatZodErrorMessage(zodError);

    return {
      status,
      message,
      meta:
        typeof response === 'object' && response !== null
          ? response
          : { errors: zodError },
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const response = exception.getResponse();
    let message = exception.message;
    let meta: unknown = response;

    if (typeof response === 'string') {
      message = response;
    } else if (typeof response === 'object' && response !== null) {
      const body = response as Record<string, unknown>;
      if (typeof body.message === 'string') {
        message = body.message;
      } else if (Array.isArray(body.message)) {
        message = body.message.join(', ');
      }
      if (typeof body.errorCode === 'string') {
        meta = { errorCode: body.errorCode, message: body.message ?? message };
      }
    }

    return { status, message, meta };
  }

  if (exception instanceof Error) {
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: exception.message,
      meta: {},
    };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error',
    meta: {},
  };
}
