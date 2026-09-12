import type { AuthorizedJwtRequest } from "@/processor/guard/permission.js";
import type { Response } from "express";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { CustomerController } from "./customer.controller.js";
import type { CustomerService } from "./customer.service.js";

describe("CustomerController export lifecycle", () => {
  const exportCustomers = jest.fn();
  const controller = new CustomerController({
    export: exportCustomers,
  } as unknown as CustomerService);

  function httpDoubles() {
    const request = Object.assign(new EventEmitter(), {
      ip: "127.0.0.1",
    }) as unknown as AuthorizedJwtRequest;
    const response = Object.assign(new EventEmitter(), {
      writableEnded: false,
      setHeader: jest.fn(),
    }) as unknown as Response;
    return { request, response };
  }

  beforeEach(() => jest.clearAllMocks());

  it("destroys the export stream when the request is aborted", async () => {
    const stream = new PassThrough();
    exportCustomers.mockResolvedValue(stream);
    const { request, response } = httpDoubles();

    await controller.export({}, request, response);
    request.emit("aborted");

    expect(stream.destroyed).toBe(true);
  });

  it("does not classify a normal response close as an abort", async () => {
    const stream = new PassThrough();
    exportCustomers.mockResolvedValue(stream);
    const { request, response } = httpDoubles();

    await controller.export({}, request, response);
    Object.assign(response, { writableEnded: true });
    response.emit("close");

    expect(stream.destroyed).toBe(false);
  });

  it("documents export 200 as a binary text/csv response", () => {
    const exportHandler = Object.getOwnPropertyDescriptor(
      CustomerController.prototype,
      "export",
    )?.value as object;
    const responses = Reflect.getMetadata(
      "swagger/apiResponse",
      exportHandler,
    ) as Record<
      string,
      {
        content?: Record<
          string,
          { schema?: { type?: string; format?: string } }
        >;
      }
    >;

    expect(responses["200"]?.content?.["text/csv"]?.schema).toEqual({
      type: "string",
      format: "binary",
    });
  });
});
