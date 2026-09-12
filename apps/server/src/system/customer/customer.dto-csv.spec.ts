import { CustomerStatus } from "@/prisma/generated/prisma/enums.js";
import {
  CreateCustomerSchema,
  CustomerDeleteSuccessEnvelopeSchema,
  CustomerDetailSuccessEnvelopeSchema,
  CustomerListSuccessEnvelopeSchema,
  CustomerMutationSuccessEnvelopeSchema,
  DeleteCustomerSchema,
  QueryCustomerSchema,
  UpdateCustomerSchema,
} from "./dto/customer.dto.js";
import { escapeCsvCell, serializeCustomerCsvRow } from "./customer.csv.js";
import { wrapSuccess } from "@/processor/utils/response.model.js";

describe("Customer DTO whitelist", () => {
  it("accepts safe decimal inputs at Decimal(18,2) boundaries", () => {
    expect(
      CreateCustomerSchema.parse({
        name: "A",
        dealAmount: "9999999999999999.99",
      }).dealAmount,
    ).toBe("9999999999999999.99");
    expect(
      CreateCustomerSchema.parse({ name: "A", dealAmount: 12.3 }).dealAmount,
    ).toBe("12.3");
  });

  it.each([
    "-0.01",
    "10000000000000000.00",
    "1.001",
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])("rejects unsafe decimal value %p", (dealAmount) => {
    expect(() =>
      CreateCustomerSchema.parse({ name: "A", dealAmount }),
    ).toThrow();
  });

  it("rejects server-owned or unknown fields on create and update", () => {
    expect(() =>
      CreateCustomerSchema.parse({ name: "A", createdById: "attacker" }),
    ).toThrow();
    expect(() =>
      UpdateCustomerSchema.parse({
        id: "c1",
        version: 0,
        name: "A",
        createdAt: new Date(),
      }),
    ).toThrow();
  });

  it("requires version and at least one mutable field on update", () => {
    expect(() => UpdateCustomerSchema.parse({ id: "c1", name: "A" })).toThrow();
    expect(() =>
      UpdateCustomerSchema.parse({ id: "c1", version: 0 }),
    ).toThrow();
    expect(
      UpdateCustomerSchema.parse({
        id: "c1",
        version: 0,
        status: CustomerStatus.WON,
      }),
    ).toMatchObject({
      id: "c1",
      version: 0,
      status: CustomerStatus.WON,
    });
  });

  it("normalizes delete ids and enforces 1..100 unique ids", () => {
    expect(DeleteCustomerSchema.parse({ ids: ["b", "a", "b"] })).toEqual({
      ids: ["b", "a"],
    });
    expect(() => DeleteCustomerSchema.parse({ ids: [] })).toThrow();
    expect(() =>
      DeleteCustomerSchema.parse({
        ids: Array.from({ length: 101 }, (_, i) => String(i)),
      }),
    ).toThrow();
  });

  it("caps page size at 100 and rejects unknown query fields", () => {
    expect(QueryCustomerSchema.parse({}).pageSize).toBe(20);
    expect(() => QueryCustomerSchema.parse({ pageSize: 101 })).toThrow();
    expect(() => QueryCustomerSchema.parse({ injected: "yes" })).toThrow();
  });
});

describe("Customer CSV safety", () => {
  it.each([
    ["a,b", '"a,b"'],
    ['a"b', '"a""b"'],
    ["a\nb", '"a\nb"'],
    ["=SUM(1,2)", '"\'=SUM(1,2)"'],
    ["+1", "'+1"],
    ["-1", "'-1"],
    ["@cmd", "'@cmd"],
    ["\tcmd", "'\tcmd"],
    ["  =SUM(1,2)", '"\'  =SUM(1,2)"'],
    ["\r\n+cmd", '"\'\r\n+cmd"'],
    ["\u0000\u001f-cmd", "'\u0000\u001f-cmd"],
    ["\u007f=cmd", "'\u007f=cmd"],
    [" \t@cmd", "' \t@cmd"],
  ])("escapes %p as %p", (input, expected) => {
    expect(escapeCsvCell(input)).toBe(expected);
  });

  it("serializes Decimal and Date values as stable strings", () => {
    expect(
      serializeCustomerCsvRow({
        id: "c1",
        name: "A",
        phone: null,
        status: CustomerStatus.LEAD,
        dealAmount: { toString: () => "12.30" },
        internalCost: { toString: () => "4.50" },
        confidential: false,
        ownerId: "u1",
        departmentId: "d1",
        createdAt: new Date("2026-01-02T03:04:05.000Z"),
      }),
    ).toContain("12.30,4.50,2026-01-02T03:04:05.000Z");
  });
});

describe("Customer response envelopes", () => {
  const customer = {
    id: "c1",
    name: "A",
    phone: null,
    remark: null,
    status: CustomerStatus.LEAD,
    dealAmount: "10.00",
    confidential: false,
    ownerId: "u1",
    departmentId: "d1",
    createdById: "u1",
    version: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    capabilities: ["update"] as const,
  };

  it("matches the actual TransformInterceptor list and detail envelopes", () => {
    expect(() =>
      CustomerListSuccessEnvelopeSchema.parse(
        wrapSuccess({ list: [customer], total: 1, pageIndex: 1, pageSize: 20 }),
      ),
    ).not.toThrow();
    expect(() =>
      CustomerDetailSuccessEnvelopeSchema.parse(wrapSuccess(customer)),
    ).not.toThrow();
  });

  it("matches mutation envelopes after service message promotion", () => {
    expect(
      CustomerMutationSuccessEnvelopeSchema.parse(
        wrapSuccess({ id: "c1", message: "添加客户成功" }),
      ),
    ).toMatchObject({ data: { id: "c1" }, message: "添加客户成功" });
    expect(
      CustomerDeleteSuccessEnvelopeSchema.parse(
        wrapSuccess({ count: 2, message: "删除客户成功" }),
      ),
    ).toMatchObject({ data: { count: 2 }, message: "删除客户成功" });
  });
});
