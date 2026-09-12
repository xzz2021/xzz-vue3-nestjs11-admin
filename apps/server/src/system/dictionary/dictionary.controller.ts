import { RequiredPermission, Serialize } from "@/processor/decorator/index.js";
import { Body, Controller, Delete, Get, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { DictionaryService } from "./dictionary.service.js";
import {
  DeleteDictionaryDto,
  DictionaryListRes,
  DictionarySeedArrayDto,
  UpsertDictionaryDto,
} from "./dto/dictionary.dto.js";
import { DeleteItemDto, UpsertItemDto } from "./dto/entry.dto.js";

// 此模块可以作为范本
@ApiTags("字典")
@Controller("dictionary")
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Get("list")
  @RequiredPermission("dictionary:view")
  @ApiOperation({ summary: "获取字典列表" })
  @Serialize(DictionaryListRes)
  @ApiResponse({ type: DictionaryListRes, isArray: true })
  findAll() {
    return this.dictionaryService.findAll();
  }

  @Post("upsert")
  @RequiredPermission("dictionary:update")
  @ApiOperation({ summary: "创建或更新字典" })
  upsertDictionary(@Body() upsertDictionaryDto: UpsertDictionaryDto) {
    return this.dictionaryService.upsertDictionary(upsertDictionaryDto);
  }

  @Delete("delete")
  @RequiredPermission("dictionary:delete")
  @ApiOperation({ summary: "批量删除字典" })
  delete(@Body() obj: DeleteDictionaryDto) {
    return this.dictionaryService.batchRemove(obj.ids);
  }

  @Post("entry/upsert")
  @RequiredPermission("dictionary:update")
  @ApiOperation({ summary: "创建字典项" })
  createEntry(@Body() upsertEntryData: UpsertItemDto) {
    return this.dictionaryService.upsertEntry(upsertEntryData);
  }

  @Delete("entry/delete")
  @RequiredPermission("dictionary:delete")
  @ApiOperation({ summary: "批量删除字典项" })
  deleteEntry(@Body() deleteEntryData: DeleteItemDto) {
    return this.dictionaryService.batchRemoveEntry(deleteEntryData.ids);
  }

  @Post("generateDictionarySeed")
  @RequiredPermission("dictionary:seed")
  @ApiOperation({ summary: "生成字典种子数据" })
  /*  如果是数组  一定要用一个类包裹  否则不会进行校验过滤
                 也可以手动转换   未实测
  const dto = plainToInstance(DictionarySeedDto, data, {
  });
  */
  generateDictionarySeed(@Body() data: DictionarySeedArrayDto) {
    return this.dictionaryService.generateDictionarySeed(data);
  }
}
