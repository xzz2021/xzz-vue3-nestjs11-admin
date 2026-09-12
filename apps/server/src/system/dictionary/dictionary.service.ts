import { PgService } from '#/infrastructure/database/prisma/pg.service.js';
import { uniqueBy } from '#/processor/utils/array.js';
import {
  sqlBatchUpdateDictionaryItems,
  sqlBatchUpdateDictionaryTypes,
} from '#/processor/utils/sql-batch.js';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DictionarySeedArrayDto,
  UpsertDictionaryDto,
} from './dto/dictionary.dto.js';
import { UpsertItemDto } from './dto/entry.dto.js';

@Injectable()
export class DictionaryService {
  constructor(private readonly pgService: PgService) {}

  async batchRemove(ids: string[]) {
    const res = await this.pgService.dictionaryType.deleteMany({
      where: { id: { in: ids } },
    });
    const count = res?.count || 0;
    if (count > 0 && count === ids.length)
      return { count, message: '删除字典成功' };
    return { count, message: '删除字典部分失败' };
  }

  async upsertDictionary(upsertDictionaryDto: UpsertDictionaryDto) {
    const { id, status, name, code } = upsertDictionaryDto;
    const data = {
      name,
      code,
      ...(status !== undefined ? { enabled: status } : {}),
    };

    if (id) {
      const result = await this.pgService.dictionaryType.update({
        where: { id },
        data,
        select: { id: true },
      });
      return { id: result.id, message: '更新字典成功' };
    }

    const result = await this.pgService.dictionaryType.create({
      data,
      select: { id: true },
    });
    return { id: result.id, message: '新增字典成功' };
  }

  async upsertEntry(upsertEntryData: UpsertItemDto) {
    const { id, dictionaryId, name, code, sort, enabled } = upsertEntryData;
    if (!dictionaryId) {
      throw new BadRequestException('父级字典不能为空');
    }

    const data = {
      label: name,
      value: code,
      sort: sort ?? 0,
      ...(enabled !== undefined ? { enabled } : {}),
      typeId: dictionaryId,
    };

    if (id) {
      const result = await this.pgService.dictionaryItem.update({
        where: { id },
        data,
        select: { id: true },
      });
      return { id: result.id, message: '更新字典项成功' };
    }

    const result = await this.pgService.dictionaryItem.create({
      data,
      select: { id: true },
    });
    return { id: result.id, message: '新增字典项成功' };
  }

  async batchRemoveEntry(ids: string[]) {
    const res = await this.pgService.dictionaryItem.deleteMany({
      where: { id: { in: ids } },
    });
    const count = res?.count || 0;
    if (count > 0 && count === ids.length)
      return { count, message: '删除字典项成功' };

    throw new BadRequestException('删除字典项部分失败');
  }

  async findAll() {
    const res = await this.pgService.dictionaryType.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        enabled: true,
        createdAt: true,
        items: {
          orderBy: {
            sort: 'asc',
          },
        },
      },
    });
    return { list: res, message: '获取所有字典列表成功' };
  }

  async generateDictionarySeed(data: DictionarySeedArrayDto) {
    const dictionaries = uniqueBy(data.data, (dict) => dict.code);
    if (dictionaries.length === 0) {
      return { message: '新增字典成功', success: true };
    }

    await this.pgService.$transaction(async (tx) => {
      const codes = dictionaries.map((dict) => dict.code);
      const existingTypes = await tx.dictionaryType.findMany({
        where: { code: { in: codes } },
        select: { id: true, code: true },
      });
      const existingByCode = new Map(
        existingTypes.map((item) => [item.code, item.id]),
      );
      const toCreate = dictionaries.filter(
        (dict) => !existingByCode.has(dict.code),
      );
      const toUpdate = dictionaries.filter((dict) =>
        existingByCode.has(dict.code),
      );

      const createdTypes =
        toCreate.length > 0
          ? await tx.dictionaryType.createManyAndReturn({
              data: toCreate.map((dict) => ({
                code: dict.code,
                name: dict.name,
                ...(dict.status !== undefined ? { enabled: dict.status } : {}),
              })),
              select: { id: true, code: true },
            })
          : [];

      if (toUpdate.length) {
        await tx.$executeRaw(
          sqlBatchUpdateDictionaryTypes(
            toUpdate.map((dict) => ({
              code: dict.code,
              name: dict.name,
              enabled: dict.status ?? null,
            })),
          ),
        );
      }

      const typeIdByCode = new Map<string, string>([
        ...existingTypes.map((item) => [item.code, item.id] as const),
        ...createdTypes.map((item) => [item.code, item.id] as const),
      ]);

      const items = dictionaries.flatMap((dict) => {
        const typeId = typeIdByCode.get(dict.code);
        if (!typeId) return [];
        return uniqueBy(dict.entries ?? [], (entry) => entry.code).map(
          (entry) => ({
            typeId,
            label: entry.name,
            value: entry.code,
            sort: entry.sort ?? 0,
            enabled: entry.enabled ?? null,
          }),
        );
      });
      if (items.length === 0) return;

      const existingItems = await tx.dictionaryItem.findMany({
        where: {
          typeId: { in: [...new Set(items.map((item) => item.typeId))] },
        },
        select: { typeId: true, value: true },
      });
      const existingItemKeys = new Set(
        existingItems.map((item) => `${item.typeId}:${item.value}`),
      );
      const itemsToCreate = items.filter(
        (item) => !existingItemKeys.has(`${item.typeId}:${item.value}`),
      );
      const itemsToUpdate = items.filter((item) =>
        existingItemKeys.has(`${item.typeId}:${item.value}`),
      );

      if (itemsToCreate.length) {
        await tx.dictionaryItem.createMany({
          data: itemsToCreate.map(({ enabled, ...rest }) => ({
            ...rest,
            ...(enabled !== null ? { enabled } : {}),
          })),
        });
      }
      if (itemsToUpdate.length) {
        await tx.$executeRaw(sqlBatchUpdateDictionaryItems(itemsToUpdate));
      }
    });

    return { message: '新增字典成功', success: true };
  }
}
