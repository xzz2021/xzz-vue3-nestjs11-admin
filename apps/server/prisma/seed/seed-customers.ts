import { Prisma } from '#/generated/prisma/client.js';
import { CustomerStatus } from '#/generated/prisma/enums.js';

export interface CustomerSeedItem {
  id: string;
  name: string;
  phone: string;
  remark: string;
  status: CustomerStatus;
  dealAmount: string;
  internalCost: string;
  confidential: boolean;
}

export const _customer: CustomerSeedItem[] = [
  {
    id: 'demo_customer_001',
    name: '演示客户·线索小额',
    phone: '13800000001',
    remark: '普通可读可改',
    status: CustomerStatus.LEAD,
    dealAmount: '28000.00',
    internalCost: '8000.00',
    confidential: false,
  },
  {
    id: 'demo_customer_002',
    name: '演示客户·线索敏感',
    phone: '13800000002',
    remark: '机密 + 高金额',
    status: CustomerStatus.LEAD,
    dealAmount: '180000.00',
    internalCost: '52000.00',
    confidential: true,
  },
  {
    id: 'demo_customer_003',
    name: '演示客户·跟进普通',
    phone: '13800000003',
    remark: '高金额阈值下界之前',
    status: CustomerStatus.FOLLOWING,
    dealAmount: '99999.99',
    internalCost: '28000.00',
    confidential: false,
  },
  {
    id: 'demo_customer_004',
    name: '演示客户·跟进高额',
    phone: '13800000004',
    remark: '高金额边界 + 机密',
    status: CustomerStatus.FOLLOWING,
    dealAmount: '100000.00',
    internalCost: '35000.00',
    confidential: true,
  },
  {
    id: 'demo_customer_005',
    name: '演示客户·成交普通',
    phone: '13800000005',
    remark: '成交删除限制',
    status: CustomerStatus.WON,
    dealAmount: '86000.00',
    internalCost: '24000.00',
    confidential: false,
  },
  {
    id: 'demo_customer_006',
    name: '演示客户·成交敏感',
    phone: '13800000006',
    remark: '成交 + 高金额 + 机密',
    status: CustomerStatus.WON,
    dealAmount: '360000.00',
    internalCost: '98000.00',
    confidential: true,
  },
  {
    id: 'demo_customer_007',
    name: '演示客户·冻结普通',
    phone: '13800000007',
    remark: '冻结禁改删',
    status: CustomerStatus.FROZEN,
    dealAmount: '45000.00',
    internalCost: '12000.00',
    confidential: false,
  },
  {
    id: 'demo_customer_008',
    name: '演示客户·冻结敏感',
    phone: '13800000008',
    remark: '冻结 + 高金额 + 机密',
    status: CustomerStatus.FROZEN,
    dealAmount: '580000.00',
    internalCost: '160000.00',
    confidential: true,
  },
];

interface CustomerOwner {
  id: string;
  departmentId: string;
}

async function resolveOwners(
  tx: Prisma.TransactionClient,
): Promise<CustomerOwner[]> {
  const usersWithDepartment = await tx.user.findMany({
    where: { enabled: true, departmentId: { not: null } },
    select: { id: true, departmentId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  const owners = usersWithDepartment.flatMap((user) =>
    user.departmentId ? [{ id: user.id, departmentId: user.departmentId }] : [],
  );
  if (owners.length > 0) return owners;

  const user = await tx.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  const sales = await tx.department.findFirst({
    where: { name: '销售部' },
    select: { id: true },
  });
  const department =
    sales ?? (await tx.department.findFirst({ select: { id: true } }));
  if (!user || !department) {
    throw new Error('无法写入客户种子：需要至少一个用户和一个部门');
  }
  return [{ id: user.id, departmentId: department.id }];
}

export async function create_customers(
  customer_data: readonly CustomerSeedItem[],
  tx: Prisma.TransactionClient,
) {
  const existing = await tx.customer.findMany({
    where: { id: { in: customer_data.map((item) => item.id) } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((item) => item.id));
  const pending = customer_data.filter((item) => !existingIds.has(item.id));
  if (pending.length === 0) {
    console.log('ℹ️ Customer demo records already exist; skipping seed.');
    return;
  }

  const owners = await resolveOwners(tx);
  for (const [index, item] of pending.entries()) {
    const owner = owners[index % owners.length];
    await tx.customer.create({
      data: {
        id: item.id,
        name: item.name,
        phone: item.phone,
        remark: item.remark,
        status: item.status,
        dealAmount: item.dealAmount,
        internalCost: item.internalCost,
        confidential: item.confidential,
        ownerId: owner.id,
        departmentId: owner.departmentId,
        createdById: owner.id,
      },
    });
  }
  console.log(`🌱 Seeding customers data success... (${pending.length})`);
}
