import { SKIP_WRAP_KEY } from "#/processor/decorator/skip-wrap";
import { StreamableFile } from "@nestjs/common";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { of } from "rxjs";
import { lastValueFrom } from "rxjs";
import { TransformInterceptor } from "./transform";

describe("TransformInterceptor", () => {
  const interceptor = new TransformInterceptor(new Reflector());

  const createContext = (
    type: "http" | "ws" = "http",
    skipWrap = false,
  ): ExecutionContext => {
    const handler = () => undefined;
    class TestController {}
    if (skipWrap) Reflect.defineMetadata(SKIP_WRAP_KEY, true, handler);

    return {
      getType: () => type,
      getHandler: () => handler,
      getClass: () => TestController,
    } as unknown as ExecutionContext;
  };

  const call = (data: unknown, context = createContext()) =>
    lastValueFrom(
      interceptor.intercept(context, { handle: () => of(data) } as CallHandler),
    );

  it("wraps HTTP payloads into ResOp", async () => {
    await expect(call({ id: "1", message: "ok" })).resolves.toMatchObject({
      code: 200,
      message: "ok",
      data: { id: "1" },
    });
  });

  it("does not wrap WebSocket handler results", async () => {
    const payload = { event: "unread", data: { unread: 3 } };
    await expect(call(payload, createContext("ws"))).resolves.toEqual(payload);
  });

  it("does not wrap StreamableFile", async () => {
    const file = new StreamableFile(Buffer.from("x"));
    await expect(call(file)).resolves.toBe(file);
  });

  it("skips wrapping when @SkipWrap is set", async () => {
    const payload = { raw: true };
    await expect(call(payload, createContext("http", true))).resolves.toEqual(
      payload,
    );
  });
});
