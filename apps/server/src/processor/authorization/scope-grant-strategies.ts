import type { ScopeGrantStrategy } from './scope-grant-strategy.interface.js';
import type { ScopeGrant } from './scope.types.js';

type SelfGrant = Extract<ScopeGrant, { type: 'SELF' }>;
type DepartmentGrant = Extract<ScopeGrant, { type: 'DEPARTMENT' }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export class SelfScopeGrantStrategy implements ScopeGrantStrategy {
  readonly type = 'SELF' as const;

  merge(grants: readonly ScopeGrant[]): SelfGrant | null {
    return grants.some((grant) => grant.type === this.type)
      ? { type: this.type }
      : null;
  }

  freeze(grant: ScopeGrant): SelfGrant {
    if (grant.type !== this.type)
      throw new TypeError(`Expected ${this.type} grant`);
    return Object.freeze({ type: this.type });
  }

  validate(value: unknown): value is SelfGrant {
    return isRecord(value) && value.type === this.type && !('ids' in value);
  }
}

export class DepartmentScopeGrantStrategy implements ScopeGrantStrategy {
  readonly type = 'DEPARTMENT' as const;

  // 去重合并排序
  merge(grants: readonly ScopeGrant[]): DepartmentGrant | null {
    const ids = new Set<string>();
    for (const grant of grants) {
      if (grant.type === this.type) grant.ids.forEach((id) => ids.add(id));
    }
    return ids.size ? { type: this.type, ids: [...ids].sort() } : null;
  }

  freeze(grant: ScopeGrant): DepartmentGrant {
    if (grant.type !== this.type)
      throw new TypeError(`Expected ${this.type} grant`);
    return Object.freeze({
      type: this.type,
      ids: Object.freeze([...grant.ids]),
    }) as DepartmentGrant;
  }

  validate(value: unknown): value is DepartmentGrant {
    if (
      !isRecord(value) ||
      value.type !== this.type ||
      !Array.isArray(value.ids) ||
      value.ids.length === 0
    ) {
      return false;
    }
    if (!value.ids.every((id) => typeof id === 'string' && id.length > 0))
      return false;
    const ids = value.ids as string[];
    return ids.every((id, index) => index === 0 || ids[index - 1] < id);
  }
}
