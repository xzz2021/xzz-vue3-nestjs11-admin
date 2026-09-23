import {
  MenuSchema,
  PermissionSchema,
} from '#/generated/zod/schemas/models/index.js';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MetaSchema = MenuSchema.pick({
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
});
export class MetaDto extends createZodDto(MetaSchema) {}

const PermissionPickSchema = PermissionSchema.pick({
  name: true,
  code: true,
});

export class PermissionNoIdDto extends createZodDto(PermissionPickSchema) {}

const MenuDtoSchema = MenuSchema.pick({
  id: true,
  name: true,
  path: true,
  component: true,
  redirect: true,
  type: true,
  sort: true,
  enabled: true,
  parentId: true,
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
  external: true,
  link: true,
}).extend({
  id: z.string().min(1),
  parentId: z.string().min(1).nullish(),
});
export class MenuDto extends createZodDto(MenuDtoSchema) {}

const MenuSortSchema = MenuSchema.pick({
  id: true,
  sort: true,
}).extend({
  id: z.string().min(1),
});
export class MenuSortDto extends createZodDto(MenuSortSchema) {}

const CreateMenuSchema = MenuDtoSchema.omit({
  id: true,
});
export class CreateMenuDto extends createZodDto(CreateMenuSchema) {}

//  继承 MenuDtoSchema 并且 限制id 不能等于 parentId
const UpdateMenuSchema = MenuDtoSchema.refine(
  (data) => data.parentId == null || data.id !== data.parentId,
  {
    message: 'id 不能等于 parentId',
    path: ['parentId'], // 错误挂到 parentId 上，方便前端展示
  },
);
export class UpdateMenuDto extends createZodDto(UpdateMenuSchema) {}

const MenuSortArraySchema = z.object({
  data: z.array(MenuSortSchema).nonempty(),
});
export class MenuSortArrayDto extends createZodDto(MenuSortArraySchema) {}

const MenuListSchema = MenuDtoSchema.extend({
  permissions: z.array(PermissionPickSchema),
  children: z.array(MenuDtoSchema),
});
export class MenuListRes extends createZodDto(MenuListSchema) {}

const SeedMenuSchema = MenuDtoSchema.omit({
  id: true,
  parentId: true,
}).extend({
  children: z.array(MenuDtoSchema),
  permissions: z.array(PermissionPickSchema),
});
export class SeedMenuDto extends createZodDto(SeedMenuSchema) {}

const MenuSeedArraySchema = z.object({
  data: z.array(SeedMenuSchema),
});
export class MenuSeedArrayDto extends createZodDto(MenuSeedArraySchema) {}
