import { PermissionType } from '#/generated/zod/enums.js';
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const CreatePermissionSchema = z.object({
  name: z.string().min(1).max(50),
  code: z.string().min(1).max(100),
  resource: z.string().min(1).max(100).optional(),
  action: z.string().min(1).max(50).optional(),
  scopeEnabled: z.boolean().optional().default(false),
  type: z.nativeEnum(PermissionType),
  sort: z.number().int().min(0).optional().default(0),
  enabled: z.boolean().optional().default(true),
  menuId: z.string().min(1),
});

const UpdatePermissionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
  code: z.string().min(1).max(100),
  resource: z.string().min(1).max(100).nullable().optional(),
  action: z.string().min(1).max(50).nullable().optional(),
  scopeEnabled: z.boolean().optional(),
  type: z.nativeEnum(PermissionType),
  sort: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});

export class CreatePermissionDto extends createZodDto(CreatePermissionSchema) {}
export class UpdatePermissionDto extends createZodDto(UpdatePermissionSchema) {}

export type CreatePermissionDtoType = z.infer<typeof CreatePermissionSchema>;
export type UpdatePermissionDtoType = z.infer<typeof UpdatePermissionSchema>;
