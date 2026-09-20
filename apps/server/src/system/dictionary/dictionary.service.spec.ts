import type { PgService } from "#/prisma/pg.service.js";
import { DictionaryService } from "./dictionary.service.js";

describe("DictionaryService seed", () => {
  const typeFindMany = vi.fn();
  const typeCreateManyAndReturn = vi.fn();
  const typeUpsert = vi.fn();
  const itemFindMany = vi.fn();
  const itemCreateMany = vi.fn();
  const itemUpsert = vi.fn();
  const executeRaw = vi.fn();
  const transaction = vi.fn(
    async (
      callback: (tx: {
        dictionaryType: {
          findMany: typeof typeFindMany;
          createManyAndReturn: typeof typeCreateManyAndReturn;
          upsert: typeof typeUpsert;
        };
        dictionaryItem: {
          findMany: typeof itemFindMany;
          createMany: typeof itemCreateMany;
          upsert: typeof itemUpsert;
        };
        $executeRaw: typeof executeRaw;
      }) => Promise<unknown>,
    ) =>
      callback({
        dictionaryType: {
          findMany: typeFindMany,
          createManyAndReturn: typeCreateManyAndReturn,
          upsert: typeUpsert,
        },
        dictionaryItem: {
          findMany: itemFindMany,
          createMany: itemCreateMany,
          upsert: itemUpsert,
        },
        $executeRaw: executeRaw,
      }),
  );

  const service = new DictionaryService({ $transaction: transaction });

  beforeEach(() => {
    vi.clearAllMocks();
    typeCreateManyAndReturn.mockResolvedValue([
      { id: "type-new", code: "gender" },
    ]);
    itemCreateMany.mockResolvedValue({ count: 1 });
    executeRaw.mockResolvedValue(1);
    typeUpsert.mockResolvedValue({ id: "type-old" });
    itemUpsert.mockResolvedValue({});
  });

  it("seeds dictionaries with createMany instead of nested upsert loops", async () => {
    typeFindMany.mockResolvedValue([{ id: "type-old", code: "status" }]);
    itemFindMany.mockResolvedValue([{ typeId: "type-old", value: "on" }]);

    await service.generateDictionarySeed({
      data: [
        {
          code: "status",
          name: "状态",
          status: true,
          entries: [
            { name: "启用", code: "on", sort: 1, enabled: true },
            { name: "停用", code: "off", sort: 2, enabled: false },
          ],
        },
        {
          code: "gender",
          name: "性别",
          status: true,
          entries: [{ name: "男", code: "male", sort: 1, enabled: true }],
        },
      ],
    });

    expect(typeUpsert).not.toHaveBeenCalled();
    expect(itemUpsert).not.toHaveBeenCalled();
    expect(typeCreateManyAndReturn).toHaveBeenCalledTimes(1);
    expect(itemCreateMany).toHaveBeenCalledTimes(1);
    expect(executeRaw).toHaveBeenCalled();
  });
});
