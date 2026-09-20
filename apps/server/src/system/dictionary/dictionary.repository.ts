import { Prisma } from '#/generated/prisma/client.js';
import { PgService } from '#/infrastructure/database/prisma/pg.service.js';
import { uniqueBy } from '#/processor/utils/array.js';
import {
  sqlBatchUpdateDictionaryItems,
  sqlBatchUpdateDictionaryTypes,
} from '#/processor/utils/sql-batch.js';
import { Injectable } from '@nestjs/common';
import type { DictionarySeedArrayDto } from './dto/dictionary.dto.js';

type SeedDictionary = DictionarySeedArrayDto['data'][number];

@Injectable()
export class DictionaryRepository {
  constructor(private readonly db: PgService) {}

  transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(fn);
  }

  deleteTypesByIds(ids: string[]) {
    return this.db.dictionaryType.deleteMany({
      where: { id: { in: ids } },
    });
  }

  updateType(id: string, data: Prisma.DictionaryTypeUncheckedUpdateInput) {
    return this.db.dictionaryType.update({
      where: { id },
      data,
      select: { id: true },
    });
  }

  createType(data: Prisma.DictionaryTypeUncheckedCreateInput) {
    return this.db.dictionaryType.create({
      data,
      select: { id: true },
    });
  }

  updateItem(id: string, data: Prisma.DictionaryItemUncheckedUpdateInput) {
    return this.db.dictionaryItem.update({
      where: { id },
      data,
      select: { id: true },
    });
  }

  createItem(data: Prisma.DictionaryItemUncheckedCreateInput) {
    return this.db.dictionaryItem.create({
      data,
      select: { id: true },
    });
  }

  deleteItemsByIds(ids: string[]) {
    return this.db.dictionaryItem.deleteMany({
      where: { id: { in: ids } },
    });
  }

  findAllWithItems() {
    return this.db.dictionaryType.findMany({
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
  }

  seedDictionaries(dictionaries: SeedDictionary[]) {
    return this.transaction(async (tx) => {
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
  }
}
