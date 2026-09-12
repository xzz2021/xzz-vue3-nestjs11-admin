export interface Options {
  select?: unknown;

  include?: unknown;

  sort?: unknown;

  pageNo?: number;

  pageSize?: number;
}

export abstract class BaseService<T> {
  protected abstract model: any;

  public async create(data: Partial<T>): Promise<T> {
    return await this.model.create({ data });
  }
  public async findAll(where: Partial<T>): Promise<T[]> {
    return await this.model.findMany({
      where: {
        ...where,
        deleted: null,
      },
    });
  }

  public async findPage(
    where: Partial<T>,
    options: Partial<Options>,
  ): Promise<{ list: T[]; total: number }> {
    const {
      select,
      include,
      sort = { id: "desc" },
      pageNo = 1,
      pageSize = 20,
    } = options;
    const orderBy = typeof sort === "string" ? JSON.parse(sort) : sort;
    const skip = (Number(pageNo) - 1) * Number(pageSize);
    const take = Number(pageSize);
    const [list, count] = await Promise.all([
      this.model.findMany({
        where: {
          ...where,
          deleted: null,
        },
        select,
        include,
        orderBy,
        skip,
        take,
      }),
      this.model.count({
        where: {
          ...where,
          deleted: null,
        },
      }),
      //  `count` 在大数据量时性能差   使用游标分页   或缓存 count 结果
      this.model.aggregate({
        _count: true,
        where: {
          ...where,
          deleted: null,
        },
      }),
    ]);
    return {
      list,
      total: count,
    };
  }

  public async findById(id: string, options?: Partial<Options>): Promise<T> {
    const { select, include } = options || {};
    return await this.model.findUnique({
      where: { id, deleted: null },
      select,
      include,
    });
  }

  public async findOne(
    where: Partial<T>,
    options: Partial<Options>,
  ): Promise<T> {
    const { select, include } = options;
    return await this.model.findFirst({
      where: {
        ...where,
        deleted: null,
      },
      select,
      include,
    });
  }

  public async updateOne(where: Partial<T>, data: Partial<T>) {
    return await this.model.update({
      where: {
        ...where,
        deleted: null,
      },
      data,
    });
  }

  public async deleteById(id: string): Promise<T> {
    return await this.model.delete({ where: { id } });
  }
}

/*

// 可以用于被继承给其他模块 实现通用方法 复用


其他service 继承方法



import { BaseService } from '@happykit/common/base/base.service';
import { User } from '@prisma/client';

@Injectable()
export class UserService extends BaseService<User> {
  constructor(
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  //  通过get 传递 prisma实例

  protected get model() {
    return this.prisma.user;
  }
}


*/
