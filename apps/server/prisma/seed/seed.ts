/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/*
种子服务需要  菜单  初始数据

*/

import { prisma, Prisma } from '#/infrastructure/database/prisma/pg.lib.js';
import { createSeedAdmin } from './seed-admin.js';
import { _department, _menu, _permission, _role } from './data.js';
import type { DepartmentModel } from '#/generated/prisma/models.js';
async function create_menus_batch(
  menu_data: any[],
  tx: Prisma.TransactionClient,
  parentId?: string,
) {
  for (const menu_item of menu_data) {
    const { children, ...menu_fields } = menu_item;
    const menu = await tx.menu.create({
      data: {
        ...menu_fields,
        parentId: parentId || null,
      },
    });
    if (Array.isArray(children) && children.length > 0) {
      await create_menus_batch(children, tx, menu.id);
    }
  }
}
async function create_menus(menu_data: any[], tx: Prisma.TransactionClient) {
  await create_menus_batch(menu_data, tx);
}

async function create_roles(role_data: any[], tx: Prisma.TransactionClient) {
  for (const role_item of role_data) {
    await tx.role.create({
      data: role_item,
    });
  }
}

async function create_users(
  user_data: { username: string; password: string; phone: string },
  tx: Prisma.TransactionClient,
) {
  // 1. 查出超管角色id 2. 创建用户并关联角色
  const super_admin_role = await tx.role.findFirst({
    where: {
      code: 'super_admin',
    },
  });
  if (!super_admin_role) {
    throw new Error('Super admin role not found');
  }
  await tx.user.create({
    data: {
      ...user_data,
      // 因为 User.roles 关联的不是 Role，而是中间表 UserRole
      roles: {
        create: {
          role: {
            connect: { id: super_admin_role.id },
          },
        },
      },
    },
  });
  console.log(`🌱 Created user: ${user_data.username}`);
}

//  创建权限  先查找menu表path字段= resource的menuId,进行关联, code的值取resource:code
async function create_permissions(
  permission_data: any[],
  tx: Prisma.TransactionClient,
) {
  for (const permission_item of permission_data) {
    const { resource, code, name, type } = permission_item;
    const menu = await tx.menu.findFirst({
      where: {
        path: resource,
      },
      select: {
        id: true,
      },
    });
    if (!menu) {
      throw new Error(`Menu ${resource} not found`);
    }
    await tx.permission.create({
      data: {
        name,
        code: `${resource}:${code}`,
        menuId: menu.id,
        type,
      },
    });
  }
}

async function create_departments_batch(
  department_data: any[],
  tx: Prisma.TransactionClient,
  parent?: DepartmentModel,
) {
  for (const department_item of department_data) {
    const { children, ...department_fields } = department_item;
    const department = await tx.department.create({
      data: {
        ...department_fields,
        parent: parent ? { connect: { id: parent.id } } : undefined,
        path: '',
      },
    });
    const path = parent ? `${parent.path}/${department.id}` : '';
    await tx.department.update({
      where: { id: department.id },
      data: { path },
    });
    if (Array.isArray(children) && children.length > 0) {
      await create_departments_batch(children, tx, department);
    }
  }
}

async function seedInitialData() {
  await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      //  创建前先检查数据库mneu是否存在,有说明已经生成过,跳过
      //  这里用于服务器首次部署时初始化完整数据
      const menuCount = await tx.menu.count();
      if (menuCount > 0) {
        console.log(
          `ℹ️ Menu already contains ${menuCount} records; skipping seed.`,
        );
        return;
      }
      await create_menus(_menu, tx);
      console.log('🌱 Seeding menus data success...');
      await create_roles(_role, tx);
      console.log('🌱 Seeding roles data success...');
      await create_departments_batch(_department, tx);
      console.log('🌱 Seeding departments data success...');
      await create_permissions(_permission, tx);
      console.log('🌱 Seeding permissions data success...');
      const seedAdmin = await createSeedAdmin(process.env);
      await create_users(seedAdmin, tx);
      console.log('✅ Seeding finished.');
    },
    { timeout: 30_000 },
  );
}

// async function seedAdditionalData() {
//   await prisma.$transaction(
//     async (tx: Prisma.TransactionClient) => {
//       // 这里相当于可以后续开发过程补充生产服务器增量数据
//       await create_additional_permissions(permission, tx);
//       console.log("🌱 Seeding additional permissions success...");
//       await create_customers(_customer, tx);
//       console.log("🌱 Seeding customers data success...");
//     },
//     { timeout: 30_000 },
//   );
// }

async function main() {
  await seedInitialData();
  // await seedAdditionalData()
  // console.log('✅ Seeding additional data finished.')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
