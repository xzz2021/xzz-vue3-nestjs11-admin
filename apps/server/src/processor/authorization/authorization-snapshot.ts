import type { AuthorizationDecision } from './scope.types.js';

export interface AuthorizationSnapshot {
  permissionCodes: string[];
  decisions: Record<string, AuthorizationDecision>;
}
