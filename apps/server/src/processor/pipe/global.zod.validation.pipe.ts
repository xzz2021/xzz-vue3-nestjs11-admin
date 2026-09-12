import { UnprocessableEntityException } from '@nestjs/common';
import { createZodValidationPipe, ZodValidationPipe } from 'nestjs-zod';
import { formatZodErrorMessage } from './zod-error.util.js';

/** 全局 Zod 校验管道，统一返回 422 校验错误 */
export const GlobalZodValidationPipe: typeof ZodValidationPipe =
  createZodValidationPipe({
    createValidationException: (error) =>
      new UnprocessableEntityException(formatZodErrorMessage(error)),
  });
