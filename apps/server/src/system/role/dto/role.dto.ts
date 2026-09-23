import {
  MenuSchema,
  PermissionSchema,
  RoleSchema,
} from '#/generated/zod/schemas/models/index.js';
import { DataScope } from '#/generated/prisma/enums.js';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const PermissionScopeSchema = z.object({
  permissionId: z.string().min(1),
  dataScope: z.nativeEnum(DataScope),
  departmentIds: z
    .array(z.string().min(1))
    .transform((ids) => [...new Set(ids)])
    .optional(),
});

const RoleMenuAssignSchema = z.object({
  id: z.string().min(1),

  // 允许为空数组，因为更新时可能不勾选权限
  permissionIds: z
    .array(z.string().min(1))
    .optional()
    .default([])
    .transform((val) => [...new Set(val)])
    .meta({ description: '权限ID', example: ['2', '3'] }),
  permissionScopes: z
    .array(PermissionScopeSchema)
    .optional()
    .superRefine((scopes, context) => {
      if (!scopes) return;
      const seen = new Set<string>();
      for (const scope of scopes) {
        if (seen.has(scope.permissionId)) {
          context.addIssue({
            code: 'custom',
            message: `权限 ${scope.permissionId} 存在重复数据范围配置`,
          });
        }
        seen.add(scope.permissionId);
      }
    }),
});
const CreateRoleSchema = RoleSchema.pick({
  name: true,
  code: true,
  enabled: true,
  description: true,
}).extend({
  menus: z
    .array(RoleMenuAssignSchema)
    .default([])
    .superRefine((menus, context) => {
      const seen = new Set<string>();
      for (const menu of menus) {
        if (seen.has(menu.id)) {
          context.addIssue({
            code: 'custom',
            message: `菜单 ${menu.id} 重复`,
          });
        }
        seen.add(menu.id);
      }
    }),
});
export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}

const QueryRoleParamsSchema = z.object({
  pageIndex: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .meta({ description: '页码', example: 1 }),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(10)
    .meta({ description: '每页条数', example: 10 }),
  keyword: z
    .string()
    .optional()
    .meta({ description: '角色名称或编码（模糊匹配）' }),
  // query 中拿到的都是序列化后的字符串
  enabled: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform((val) =>
      val === undefined ? undefined : val === true || val === 'true',
    )
    .meta({ description: '角色状态', example: true }),
});
export class QueryRoleParams extends createZodDto(QueryRoleParamsSchema) {}

const UpdateRoleSchema = CreateRoleSchema.and(
  z.object({
    id: z.string().min(1).meta({ description: '角色ID', example: '1' }),
  }),
);
export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}

const DeleteRoleSchema = z.object({
  id: z.string().min(1).meta({ description: '角色ID', example: '1' }),
});
export class DeleteRoleDto extends createZodDto(DeleteRoleSchema) {}

const RoleSeedSchema = RoleSchema.pick({
  name: true,
  code: true,
  enabled: true,
  description: true,
}).partial({
  enabled: true,
  description: true,
});
export class RoleSeedDto extends createZodDto(RoleSeedSchema) {}

const RoleSeedArraySchema = z.object({
  data: z.array(RoleSeedSchema),
});
export class RoleSeedArrayDto extends createZodDto(RoleSeedArraySchema) {}

const RoleListSchema = RoleSchema.pick({
  id: true,
  name: true,
  code: true,
  sort: true,
  description: true,
  isSystem: true,
  enabled: true,
}).extend({
  createdAt: z.string(),
  updatedAt: z.string(),
});

const RoleListResSchema = z.object({
  total: z.number().meta({ description: '总条数', example: 10 }),
  list: z.array(RoleListSchema).meta({ description: '列表数据' }),
});
export class RoleListRes extends createZodDto(RoleListResSchema) {}

const MetaPermissionSchema = MenuSchema.pick({
  title: true,
  icon: true,
  affix: true,
  activeMenu: true,
  alwaysShow: true,
  breadcrumb: true,
  canTo: true,
  hidden: true,
  noCache: true,
  noTagsView: true,
}).extend({
  permissions: z
    .array(z.string())
    .meta({ description: '权限code列表', example: ['add', 'edit', 'delete'] }),
});

const MenuPermissionListSchema = MenuSchema.pick({
  id: true,
  name: true,
  path: true,
  component: true,
  redirect: true,
  type: true,
  sort: true,
  enabled: true,
  parentId: true,
}).extend({
  meta: MetaPermissionSchema,
});

const MenuPermissionListResSchema = z.object({
  list: z.array(MenuPermissionListSchema).meta({ description: '列表数据' }),
});
export class MenuPermissionListRes extends createZodDto(
  MenuPermissionListResSchema,
) {}

const RoleAuthorizationPermissionSchema = PermissionSchema.extend({
  resource: z.string().nullable(),
  action: z.string().nullable(),
  sort: z.number().int(),
  enabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  checked: z.boolean(),
  dataScope: z.nativeEnum(DataScope).nullable(),
  departmentIds: z.array(z.string()),
  disabledDepartmentIds: z.array(z.string()),
});

const RoleAuthorizationMenuBaseSchema = MenuSchema.extend({
  sort: z.number().int(),
  enabled: z.boolean(),
  parentId: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  checked: z.boolean(),
  permissions: z.array(RoleAuthorizationPermissionSchema),
});

type RoleAuthorizationMenu = z.infer<typeof RoleAuthorizationMenuBaseSchema> & {
  children: RoleAuthorizationMenu[];
};

const RoleAuthorizationMenuSchema: z.ZodType<RoleAuthorizationMenu> = z.lazy(
  () =>
    RoleAuthorizationMenuBaseSchema.extend({
      children: z.array(RoleAuthorizationMenuSchema),
    }),
);

const RoleAuthorizationTreeResSchema = z.object({
  list: z.array(RoleAuthorizationMenuSchema),
  message: z.string(),
});

export class RoleAuthorizationTreeRes extends createZodDto(
  RoleAuthorizationTreeResSchema,
) {}
