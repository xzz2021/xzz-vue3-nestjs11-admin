import { DataScope } from '#/generated/prisma/enums.js';
import { DepartmentRepository } from '#/system/department/department.repository.js';
import { Injectable } from '@nestjs/common';
import type {
  ScopeResolutionInput,
  ScopeResolver,
} from './scope-resolver.interface.js';
import {
  AllScopeResolver,
  CustomScopeResolver,
  DepartmentScopeResolver,
  DepartmentTreeScopeResolver,
  SelfScopeResolver,
} from './scope-resolvers.js';
import type { ResolvedGrant } from './scope.types.js';

@Injectable()
export class ScopeResolverRegistry {
  /** DataScope 枚举 → 对应策略实例。只做查找，不按数组顺序执行。 */
  private readonly byDataScope: ReadonlyMap<DataScope, ScopeResolver>;

  constructor(private readonly departments: DepartmentRepository) {
    const strategies: readonly ScopeResolver[] = [
      new AllScopeResolver(),
      new SelfScopeResolver(),
      new DepartmentScopeResolver(),
      new DepartmentTreeScopeResolver(departments),
      new CustomScopeResolver(),
    ];
    this.byDataScope = new Map(
      strategies.map((strategy) => [strategy.scope, strategy]),
    );
  }

  /** 按枚举选出策略，再把用户上下文交给该策略算出 Grant。 */
  async resolveGrant(
    scope: DataScope,
    input: ScopeResolutionInput,
  ): Promise<ResolvedGrant> {
    const strategy = this.byDataScope.get(scope);
    if (!strategy) return { all: false, scopes: [] };
    return strategy.resolve(input);
  }
}
