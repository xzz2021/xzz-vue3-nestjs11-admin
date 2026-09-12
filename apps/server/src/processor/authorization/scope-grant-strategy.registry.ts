import {
  DepartmentScopeGrantStrategy,
  SelfScopeGrantStrategy,
} from './scope-grant-strategies.js';
import type { ScopeGrantStrategy } from './scope-grant-strategy.interface.js';
import type { ResolvedGrant, ScopeGrant } from './scope.types.js';

export class ScopeGrantStrategyRegistry {
  private readonly strategies: ReadonlyMap<
    ScopeGrant['type'],
    ScopeGrantStrategy
  >;

  constructor(strategies: readonly ScopeGrantStrategy[]) {
    this.strategies = new Map(
      strategies.map((strategy) => [strategy.type, strategy]),
    );
  }

  static createDefault(): ScopeGrantStrategyRegistry {
    return new ScopeGrantStrategyRegistry([
      new SelfScopeGrantStrategy(),
      new DepartmentScopeGrantStrategy(),
    ]);
  }

  normalize(grants: readonly ScopeGrant[]): ScopeGrant[] {
    return [...this.strategies.values()]
      .map((strategy) => strategy.merge(grants))
      .filter((grant): grant is ScopeGrant => grant !== null);
  }

  freeze(grant: ScopeGrant): ScopeGrant {
    const strategy = this.strategies.get(grant.type);
    if (!strategy)
      throw new TypeError(`Unknown scope grant type: ${grant.type}`);
    return strategy.freeze(grant);
  }

  validate(value: unknown): value is ScopeGrant {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return false;
    const type = (value as { type?: unknown }).type;
    if (typeof type !== 'string') return false;
    const strategy = this.strategies.get(type as ScopeGrant['type']);
    return strategy?.validate(value) ?? false;
  }
}

export const scopeGrantStrategies = ScopeGrantStrategyRegistry.createDefault();

export function mergeGrants(grants: readonly ResolvedGrant[]): ResolvedGrant {
  if (grants.some((grant) => grant.all)) return { all: true, scopes: [] };

  return {
    all: false,
    scopes: scopeGrantStrategies.normalize(
      grants.flatMap((grant) => grant.scopes),
    ),
  };
}
