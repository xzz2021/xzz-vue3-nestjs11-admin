import type { ScopeGrant } from './scope.types.js';

export interface ScopeGrantStrategy {
  readonly type: ScopeGrant['type'];
  merge(grants: readonly ScopeGrant[]): ScopeGrant | null;
  freeze(grant: ScopeGrant): ScopeGrant;
  validate(value: unknown): value is ScopeGrant;
}
