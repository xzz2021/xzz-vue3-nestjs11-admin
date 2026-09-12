import { Prisma } from '#/generated/prisma/client.js';
import {
  CustomerStatus,
  type CustomerStatus as CustomerStatusValue,
} from '#/generated/prisma/enums.js';
import { AuthorizationContext } from '#/processor/authorization/authorization-context.js';
import type { ScopeGrant } from '#/processor/authorization/scope.types.js';
import {
  createMongoAbility,
  subject,
  type MongoAbility,
  type RawRuleOf,
} from '@casl/ability';

export const CUSTOMER_HIGH_VALUE_THRESHOLD = 100000;

export type CustomerCapability = 'update' | 'delete' | 'detail';
type CustomerAbilityAction =
  CustomerCapability | 'read-sensitive' | 'update-sensitive';

interface CustomerAbilityAttributes {
  id: string;
  status: CustomerStatusValue;
  highValue: boolean;
  frozen: boolean;
  won: boolean;
}

interface CustomerAbilityObject extends CustomerAbilityAttributes {
  readonly __caslSubjectType__: 'Customer';
}
type CustomerAbility = MongoAbility<
  [CustomerAbilityAction, 'Customer' | CustomerAbilityObject]
>;

export interface CustomerPolicyRecord {
  id: string;
  status: CustomerStatusValue;
  dealAmount: string | number | { toString(): string };
  confidential: boolean;
  ownerId: string;
  departmentId: string;
  internalCost?: string | number | { toString(): string };
  [key: string]: unknown;
}

export type CustomerProjection = Omit<
  CustomerPolicyRecord,
  'dealAmount' | 'internalCost'
> & {
  dealAmount: string;
  internalCost?: string;
  capabilities: CustomerCapability[];
};

const DENY_ALL_WHERE: Prisma.CustomerWhereInput = { id: { in: [] } };

export class CustomerPolicy {
  private readonly ability: CustomerAbility;
  private readonly superAdmin: boolean;

  constructor(private readonly context: AuthorizationContext) {
    this.superAdmin = context.permissionCodes.has('*');
    this.ability = this.buildAbility();
  }

  // 负责行的decision过滤条件, 不管是查看编辑或任意操作 , 都是根据传入的权限code获取当前code下的行权限
  whereFor(permissionCode: string): Prisma.CustomerWhereInput {
    if (this.superAdmin) return {};
    const decision = this.context.decisionFor(permissionCode);
    if (!decision?.scoped) return DENY_ALL_WHERE;
    if (decision.grant.all) return {};
    if (decision.grant.scopes.length === 0) return DENY_ALL_WHERE;
    return { OR: decision.grant.scopes.map((scope) => this.scopeWhere(scope)) };
  }

  /* 合并查询条件   作为查询 第一个入口  接受权限code  以及自定义的不涉及权限的 简单查询条件
      核心是 合并 whereFor
  */
  queryWhere(
    permissionCode: string,
    businessWhere: Prisma.CustomerWhereInput,
  ): Prisma.CustomerWhereInput {
    return {
      /*  合并敏感信息 也是根据数据库对应字段 和 权限key  判断过滤  也就是表格数据的confidential字段  其实也能合并任意其他简单判断的字段
          this.canReadSensitive() 这里调用是为了在查询数据库时就直接过滤掉   queryWhere 控制数据库层
          控制 是否查出 敏感数据
      */
      AND: [
        this.whereFor(permissionCode),
        this.canReadSensitive() ? {} : { confidential: false },
        businessWhere,
      ],
    };
  }

  // mutation 突变操作  具体字段的 金额范围权限  大于 小于  手写实现
  mutationWhere(
    permissionCode: 'customer:update' | 'customer:delete',
    businessWhere: Prisma.CustomerWhereInput = {},
  ): Prisma.CustomerWhereInput {
    const attributeWhere: Prisma.CustomerWhereInput[] = [];
    if (!this.superAdmin) {
      attributeWhere.push({ status: { not: CustomerStatus.FROZEN } });
      if (
        permissionCode === 'customer:update' &&
        !this.context.hasPermission('customer:high-value-update')
      ) {
        attributeWhere.push({
          dealAmount: { lt: CUSTOMER_HIGH_VALUE_THRESHOLD },
        });
      }
      if (
        permissionCode === 'customer:delete' &&
        !this.context.hasPermission('customer:won-delete')
      ) {
        attributeWhere.push({ status: { not: CustomerStatus.WON } });
      }
    }
    return {
      AND: [
        this.whereFor(permissionCode),
        this.canReadSensitive() ? {} : { confidential: false },
        ...attributeWhere,
        businessWhere,
      ],
    };
  }

  // 判断 是否具有当前行的  相应操作权限
  can(
    action: CustomerAbilityAction,
    record: CustomerPolicyRecord,
    field?: string,
  ): boolean {
    const permissionCode =
      action === 'delete'
        ? 'customer:delete'
        : action === 'detail'
          ? 'customer:detail'
          : action === 'update' || action === 'update-sensitive'
            ? 'customer:update'
            : undefined;
    if (permissionCode && !this.recordMatchesGrant(permissionCode, record))
      return false;
    const attributes = this.abilityAttributes(record);
    return field
      ? this.ability.can(action, subject('Customer', attributes), field)
      : this.ability.can(action, subject('Customer', attributes));
  }

  canReadSensitive(): boolean {
    return this.context.hasPermission('customer:sensitive-view');
  }

  canUpdateSensitive(
    record: CustomerPolicyRecord,
    field: 'internalCost' | 'confidential',
  ): boolean {
    return this.can('update-sensitive', record, field);
  }

  // 构建ability数组  返回给每一行的能力
  capabilities(record: CustomerPolicyRecord): CustomerCapability[] {
    const result: CustomerCapability[] = [];
    if (this.can('update', record)) result.push('update');
    if (this.can('delete', record)) result.push('delete');
    if (this.can('detail', record)) result.push('detail');
    return result;
  }

  // 用于响应数据脱敏和 ability 计算 返回最终数据 以及 行数据的操作权限   主要为了控制当前行
  project<T extends CustomerPolicyRecord>(
    record: T,
    capabilities = this.capabilities(record),
  ): CustomerProjection {
    const { internalCost, dealAmount, ...rest } = record;
    return {
      ...rest,
      dealAmount: dealAmount.toString(),
      //  queryWhere在数据库层过滤了  为什么还要调用一次this.canReadSensitive()??   当允许敏感数据后  再次判断 是否返回 普通数据 下  当前行  的 internalCost 字段
      ...(this.canReadSensitive() && internalCost !== undefined
        ? { internalCost: internalCost.toString() }
        : {}),
      capabilities, //  行数据的权限
    };
  }

  targetMatchesGrant(
    permissionCode: string,
    ownerId: string,
    departmentId: string,
  ): boolean {
    if (this.superAdmin) return true;
    const decision = this.context.decisionFor(permissionCode);
    if (!decision?.scoped) return false;
    if (decision.grant.all) return true;
    return decision.grant.scopes.some((scope) =>
      scope.type === 'SELF'
        ? ownerId === this.context.userId
        : scope.ids.includes(departmentId),
    );
  }

  // 判断 当前行  数据的所有者 或者 所属部门  是否符合权限
  private recordMatchesGrant(
    permissionCode: string,
    record: CustomerPolicyRecord,
  ): boolean {
    if (this.superAdmin) return true;
    const decision = this.context.decisionFor(permissionCode);
    if (!decision?.scoped) return false;
    if (decision.grant.all) return true;
    return decision.grant.scopes.some((scope) =>
      scope.type === 'SELF'
        ? record.ownerId === this.context.userId
        : scope.ids.includes(record.departmentId),
    );
  }

  //  一次构建所有crud等权限
  private buildAbility(): CustomerAbility {
    const rules: RawRuleOf<CustomerAbility>[] = [];
    const allow = (
      action: CustomerAbilityAction,
      conditions?: Partial<CustomerAbilityAttributes>,
      fields?: string[],
    ) => {
      rules.push({
        action,
        subject: 'Customer',
        ...(conditions ? { conditions } : {}),
        ...(fields ? { fields } : {}),
      });
    };

    //  遍历所有权限code  负责code权限ability  包含字段判断   只判断有无  不包含范围
    if (this.superAdmin) {
      for (const action of [
        'update',
        'delete',
        'detail',
        'read-sensitive',
        'update-sensitive',
      ] as const)
        allow(action);
      return createMongoAbility(rules);
    }

    const updateConditions: Partial<CustomerAbilityAttributes> = {
      frozen: false,
      ...(this.context.hasPermission('customer:high-value-update')
        ? {}
        : { highValue: false }),
    };
    if (this.context.hasPermission('customer:update'))
      allow('update', updateConditions);
    if (this.context.hasPermission('customer:delete')) {
      allow('delete', {
        frozen: false,
        ...(this.context.hasPermission('customer:won-delete')
          ? {}
          : { won: false }),
      });
    }
    if (this.context.hasPermission('customer:detail')) allow('detail');
    if (this.context.hasPermission('customer:sensitive-view'))
      allow('read-sensitive');
    if (this.context.hasPermission('customer:sensitive-update')) {
      allow('update-sensitive', updateConditions, [
        'internalCost',
        'confidential',
      ]);
    }
    return createMongoAbility(rules);
  }

  private abilityAttributes(
    record: CustomerPolicyRecord,
  ): CustomerAbilityAttributes {
    return {
      id: record.id,
      status: record.status,
      frozen: record.status === CustomerStatus.FROZEN,
      won: record.status === CustomerStatus.WON,
      highValue:
        Number(record.dealAmount.toString()) >= CUSTOMER_HIGH_VALUE_THRESHOLD,
    };
  }

  //  这里控制判断 数据的所有者 或者 所属部门     后期如果有其他限制条件也可以放这里筛选, 字段 ownerId 根据业务调整
  private scopeWhere(scope: ScopeGrant): Prisma.CustomerWhereInput {
    return scope.type === 'SELF'
      ? { ownerId: this.context.userId }
      : { departmentId: { in: scope.ids } };
  }
}
