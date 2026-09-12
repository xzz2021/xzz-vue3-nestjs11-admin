import { IS_PUBLIC_KEY } from '@/processor/decorator/public.js';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';

export function isPublicRoute(
  reflector: Reflector,
  context: ExecutionContext,
): boolean {
  return Boolean(
    reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]),
  );
}
