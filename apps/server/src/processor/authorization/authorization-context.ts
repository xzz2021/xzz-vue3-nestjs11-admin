import { scopeGrantStrategies } from './scope-grant-strategy.registry.js';
import type {
  AuthorizationDecision,
  AuthorizationDecisions,
} from './scope.types.js';

function immutableSet(values: readonly string[]): ReadonlySet<string> {
  const result = new Set(values);
  result.add = () => {
    throw new TypeError('AuthorizationContext is immutable');
  };
  result.delete = () => {
    throw new TypeError('AuthorizationContext is immutable');
  };
  result.clear = () => {
    throw new TypeError('AuthorizationContext is immutable');
  };
  return Object.freeze(result);
}

function freezeDecision(
  decision: AuthorizationDecision,
): AuthorizationDecision {
  if (!decision.scoped) return Object.freeze({ scoped: false });
  const scopes = decision.grant.scopes.map((scope) =>
    scopeGrantStrategies.freeze(scope),
  );
  return Object.freeze({
    scoped: true,
    grant: Object.freeze({
      all: decision.grant.all,
      scopes: Object.freeze(scopes),
    }),
  }) as AuthorizationDecision;
}

// AuthorizationContext 主要作用: 提供权限代码和决策上下文, 用于细颗粒度权限控制
export class AuthorizationContext {
  readonly permissionCodes: ReadonlySet<string>;
  private readonly decisions: AuthorizationDecisions;
  //userId 留给下游当当前操作人
  constructor(
    readonly userId: string,
    permissionCodes: readonly string[],
    decisions: Readonly<Record<string, AuthorizationDecision>>,
  ) {
    this.permissionCodes = immutableSet(permissionCodes);
    // 只有用户实际拥有的权限码才会出现在这个 map 里（超管例外：目录里每条权限都有一条 decision）。没有的码 decisionFor 得到 undefined。
    this.decisions = Object.freeze(
      Object.fromEntries(
        Object.entries(decisions).map(([code, decision]) => [
          code,
          freezeDecision(decision),
        ]),
      ),
    );
    // Object.freeze 在运行时把授权结果锁成只读,避免后续被污染
    Object.freeze(this);
  }

  // 路由闸门：判断能否进入此接口,放行或者拦截
  hasPermission(code: string): boolean {
    return this.permissionCodes.has('*') || this.permissionCodes.has(code);
  }
  /* 行级Grant范围 细颗粒度权限控制 返回具体的决策  比如 是否具有读取权限 是否具有写入权限 是否具有删除权限
{
  'customer:view': {
    scoped: true,
    grant: {
      all: false,
      scopes: [
        { type: 'DEPARTMENT', ids: ['dept-sales'] },  // ids 已冻结
         { type: 'SELF' }
      ]
    }
  },
  'customer:update': {
    scoped: true,
    grant: {
      all: false,
      scopes: [
        { type: 'SELF' }
      ]
    }
  },
  'customer:assign': {
    scoped: false   // scopeEnabled === false，没有行级 Grant
  }
}

  核心点在于  这里可以细分到 根据不同操作 有不同的限制颗粒度
  */
  decisionFor(code: string): AuthorizationDecision | undefined {
    return this.decisions[code];
  }
}
