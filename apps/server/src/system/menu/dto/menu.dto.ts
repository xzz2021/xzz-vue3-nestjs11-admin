import { MenuModel, PermissionModel } from '@/generated/zod/index.js';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const MetaSchema = MenuModel.pick({
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

const PermissionSchema = PermissionModel.pick({
  name: true,
  code: true,
});

export class PermissionNoIdDto extends createZodDto(PermissionSchema) {}

const MenuSchema = MenuModel.pick({
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
export class MenuDto extends createZodDto(MenuSchema) {}

const MenuSortSchema = MenuModel.pick({
  id: true,
  sort: true,
}).extend({
  id: z.string().min(1),
});
export class MenuSortDto extends createZodDto(MenuSortSchema) {}

const CreateMenuSchema = MenuSchema.omit({
  id: true,
});
export class CreateMenuDto extends createZodDto(CreateMenuSchema) {}

//  继承MenuSchema 并且 限制id 不能等于 parentId
const UpdateMenuSchema = MenuSchema.refine(
  (data: MenuDto) => data.parentId == null || data.id !== data.parentId,
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

const MenuListSchema = MenuSchema.extend({
  permissions: z.array(PermissionSchema),
  children: z.array(MenuSchema),
});
export class MenuListRes extends createZodDto(MenuListSchema) {}

const SeedMenuSchema = MenuSchema.omit({
  id: true,
  parentId: true,
}).extend({
  children: z.array(MenuSchema),
  permissions: z.array(PermissionSchema),
});
export class SeedMenuDto extends createZodDto(SeedMenuSchema) {}

const MenuSeedArraySchema = z.object({
  data: z.array(SeedMenuSchema),
});
export class MenuSeedArrayDto extends createZodDto(MenuSeedArraySchema) {}
