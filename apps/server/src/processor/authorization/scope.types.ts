export type ScopeGrant =
  { type: "SELF" } | { type: "DEPARTMENT"; ids: string[] };

export interface ResolvedGrant {
  all: boolean;
  scopes: ScopeGrant[];
}

// AuthorizationDecision 权限是否有范围限制  有的话grant显示具体范围
export type AuthorizationDecision =
  { scoped: false } | { scoped: true; grant: ResolvedGrant };

export type AuthorizationDecisions = Readonly<
  Record<string, AuthorizationDecision>
>;
