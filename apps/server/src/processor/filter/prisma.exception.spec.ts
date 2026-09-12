import { ConflictException } from "@nestjs/common";
import { checkPrismaError, isTransientDbError } from "./prisma.exception";

describe("Prisma transient database classification", () => {
  it.each(["40P01", "P2034"])(
    "classifies %s as a transient database failure",
    (code) => {
      const error = { code, message: "retry transaction" };

      expect(isTransientDbError(error)).toBe(true);
      expect(checkPrismaError(error)).toMatchObject({ transient: true });
    },
  );

  it("does not turn an application optimistic-lock conflict into a database 503", () => {
    expect(
      isTransientDbError(new ConflictException("数据已被其他请求修改")),
    ).toBe(false);
  });
});
