import { Prisma } from '#/generated/prisma/client.js';
import { DepartmentRepository } from './department.repository.js';
import { DepartmentService } from './department.service.js';

const organizationGenerationBump = vi.fn().mockResolvedValue(undefined);
const organizationGeneration = {
  bump: organizationGenerationBump,
} as unknown as import('#/processor/authorization/organization-generation.service.js').OrganizationGenerationService;

describe('DepartmentService tree updates', () => {
  const findMany = vi.fn();
  const update = vi.fn();
  const executeRaw = vi.fn();
  const transaction = vi.fn(
    async (
      callback: (tx: {
        department: { findMany: typeof findMany; update: typeof update };
        $executeRaw: typeof executeRaw;
      }) => Promise<unknown>,
    ) =>
      callback({ department: { findMany, update }, $executeRaw: executeRaw }),
  );

  const service = new DepartmentService(
    new DepartmentRepository({ $transaction: transaction } as any),
    {
      record: vi.fn(),
    } as unknown as import('#/core/logger/audit-log.service.js').AuditLogService,
    organizationGeneration,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    update.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ id: where.id }),
    );
    executeRaw.mockResolvedValue(1);
  });

  it('updates descendant materialized paths with one SQL statement when moving a department', async () => {
    findMany.mockResolvedValue([
      { id: 'root-a', parentId: null, path: '/root-a' },
      { id: 'node', parentId: 'root-a', path: '/root-a/node' },
      { id: 'child', parentId: 'node', path: '/root-a/node/child' },
      { id: 'root-b', parentId: null, path: '/root-b' },
    ]);

    await service.update({
      id: 'node',
      parentId: 'root-b',
      name: 'Node',
      enabled: true,
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'node' },
        data: expect.objectContaining({
          parentId: 'root-b',
          path: '/root-b/node',
        }),
      }),
    );
    expect(executeRaw).toHaveBeenCalledTimes(1);
    const sql = executeRaw.mock.calls[0][0] as {
      sql: string;
      values: unknown[];
    };
    expect(sql.sql).toMatch(/regexp_replace/i);
    expect(sql.values).toEqual(
      expect.arrayContaining(['/root-b/node', '/root-a/node/%']),
    );
  });

  it('does not rewrite descendant paths when the materialized path is unchanged', async () => {
    findMany.mockResolvedValue([
      { id: 'node', parentId: null, path: '/node' },
      { id: 'child', parentId: 'node', path: '/node/child' },
    ]);

    await service.update({
      id: 'node',
      name: 'Renamed',
      enabled: true,
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it('rejects moving a department under its descendant before writing', async () => {
    findMany.mockResolvedValue([
      { id: 'node', parentId: null, path: '/node' },
      { id: 'child', parentId: 'node', path: '/node/child' },
    ]);

    await expect(
      service.update({
        id: 'node',
        parentId: 'child',
        name: 'Node',
        enabled: true,
      }),
    ).rejects.toThrow('不能将部门移动到自己的后代节点下');
    expect(update).not.toHaveBeenCalled();
    expect(executeRaw).not.toHaveBeenCalled();
  });
});

describe('DepartmentService list queries', () => {
  const findMany = vi.fn();
  const count = vi.fn();
  const service = new DepartmentService(
    new DepartmentRepository({
      department: { findMany, count },
    } as any),
    {
      record: vi.fn(),
    } as unknown as import('#/core/logger/audit-log.service.js').AuditLogService,
    organizationGeneration,
  );

  it('loads list and count in parallel', async () => {
    let resolveList!: (value: unknown[]) => void;
    let resolveCount!: (value: number) => void;
    findMany.mockReturnValue(
      new Promise((resolve) => {
        resolveList = resolve;
      }),
    );
    count.mockReturnValue(
      new Promise((resolve) => {
        resolveCount = resolve;
      }),
    );

    const pending = service.findAll();

    expect(findMany).toHaveBeenCalled();
    expect(count).toHaveBeenCalled();

    const list = [{ id: 'dept-1', name: '研发部', children: [] }];
    resolveList(list);
    resolveCount(1);
    await expect(pending).resolves.toEqual({
      list,
      total: 1,
      message: '获取部门列表成功',
    });
  });

  it('throws when the department list is empty', async () => {
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);

    await expect(service.findAll()).rejects.toThrow('部门列表为空');
  });
});

describe('DepartmentService delete rules', () => {
  const findUnique = vi.fn();
  const findFirst = vi.fn();
  const rolePermissionDepartmentFindFirst = vi.fn();
  const customerFindFirst = vi.fn();
  const remove = vi.fn();
  const queryRaw = vi.fn();
  const deleteDb = {
    department: { findUnique, findFirst, delete: remove },
    rolePermissionDepartment: { findFirst: rolePermissionDepartmentFindFirst },
    customer: { findFirst: customerFindFirst },
    $queryRaw: queryRaw,
    $transaction: vi.fn(),
  };
  deleteDb.$transaction.mockImplementation((callback) => callback(deleteDb));
  const service = new DepartmentService(
    new DepartmentRepository(deleteDb as any),
    {
      record: vi.fn(),
    } as unknown as import('#/core/logger/audit-log.service.js').AuditLogService,
    organizationGeneration,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    rolePermissionDepartmentFindFirst.mockResolvedValue(null);
    customerFindFirst.mockResolvedValue(null);
    queryRaw.mockResolvedValue([{ id: 'node' }]);
  });

  it('refuses to delete a department that still has children', async () => {
    findUnique.mockResolvedValue({ path: '/node' });
    findFirst.mockResolvedValue({ id: 'child' });

    await expect(service.delete('node')).rejects.toThrow(
      '当前项有子部门无法删除',
    );
    expect(remove).not.toHaveBeenCalled();
  });

  it.each(['CUSTOM_DEFINE 数据范围', '客户'])(
    'refuses deletion when referenced by %s without bumping generation',
    async (label) => {
      const referenceQuery =
        label === 'CUSTOM_DEFINE 数据范围'
          ? rolePermissionDepartmentFindFirst
          : customerFindFirst;
      findUnique.mockResolvedValue({ path: '/node' });
      findFirst.mockResolvedValue(null);
      referenceQuery.mockResolvedValue({ id: 'reference-1' });

      await expect(service.delete('node')).rejects.toThrow('部门仍被');
      expect(remove).not.toHaveBeenCalled();
      expect(organizationGenerationBump).not.toHaveBeenCalled();
    },
  );
});

describe('DepartmentService unique names', () => {
  const create = vi.fn();
  const transaction = vi.fn(
    async (
      callback: (tx: {
        department: { create: typeof create };
      }) => Promise<unknown>,
    ) => callback({ department: { create } }),
  );
  const service = new DepartmentService(
    new DepartmentRepository({ $transaction: transaction } as any),
    {
      record: vi.fn(),
    } as unknown as import('#/core/logger/audit-log.service.js').AuditLogService,
    organizationGeneration,
  );

  it('maps unique constraint failures to a sibling name conflict', async () => {
    create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );

    await expect(
      service.add({ name: '研发部', enabled: true }),
    ).rejects.toThrow('同级已存在同名部门');
  });
});

describe('DepartmentService lookup', () => {
  const findMany = vi.fn();
  const count = vi.fn();
  const service = new DepartmentService(
    new DepartmentRepository({
      department: { findMany, count },
    } as any),
    {
      record: vi.fn(),
    } as unknown as import('#/core/logger/audit-log.service.js').AuditLogService,
    organizationGeneration,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a slim tree without management fields', async () => {
    findMany.mockResolvedValue([
      {
        id: 'root',
        name: '总部',
        parentId: null,
        enabled: true,
        path: '/root',
        description: '内部备注',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
        children: [
          {
            id: 'child',
            name: '研发',
            parentId: 'root',
            enabled: true,
            path: '/root/child',
            description: '子部门备注',
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            updatedAt: new Date('2026-01-02T00:00:00.000Z'),
            children: [],
          },
        ],
      },
    ]);
    count.mockResolvedValue(2);

    await expect(service.lookup()).resolves.toEqual({
      list: [
        {
          id: 'root',
          name: '总部',
          parentId: null,
          enabled: true,
          children: [
            {
              id: 'child',
              name: '研发',
              parentId: 'root',
              enabled: true,
              children: [],
            },
          ],
        },
      ],
      total: 2,
      message: '获取部门列表成功',
    });
  });
});
