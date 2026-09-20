import { uniqueBy } from '#/processor/utils/array.js';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DictionarySeedArrayDto,
  UpsertDictionaryDto,
} from './dto/dictionary.dto.js';
import { UpsertItemDto } from './dto/entry.dto.js';
import { DictionaryRepository } from './dictionary.repository.js';

@Injectable()
export class DictionaryService {
  constructor(private readonly dictionaries: DictionaryRepository) {}

  async batchRemove(ids: string[]) {
    const res = await this.dictionaries.deleteTypesByIds(ids);
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
      const result = await this.dictionaries.updateType(id, data);
      return { id: result.id, message: '更新字典成功' };
    }

    const result = await this.dictionaries.createType(data);
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
      const result = await this.dictionaries.updateItem(id, data);
      return { id: result.id, message: '更新字典项成功' };
    }

    const result = await this.dictionaries.createItem(data);
    return { id: result.id, message: '新增字典项成功' };
  }

  async batchRemoveEntry(ids: string[]) {
    const res = await this.dictionaries.deleteItemsByIds(ids);
    const count = res?.count || 0;
    if (count > 0 && count === ids.length)
      return { count, message: '删除字典项成功' };

    throw new BadRequestException('删除字典项部分失败');
  }

  async findAll() {
    const res = await this.dictionaries.findAllWithItems();
    return { list: res, message: '获取所有字典列表成功' };
  }

  async generateDictionarySeed(data: DictionarySeedArrayDto) {
    const dictionaries = uniqueBy(data.data, (dict) => dict.code);
    if (dictionaries.length === 0) {
      return { message: '新增字典成功', success: true };
    }

    await this.dictionaries.seedDictionaries(dictionaries);
    return { message: '新增字典成功', success: true };
  }
}
