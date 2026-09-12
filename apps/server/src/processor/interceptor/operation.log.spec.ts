import { ExecutionContext } from "@nestjs/common";
import { lastValueFrom, throwError } from "rxjs";
import type { LogService } from "@/core/logger/logger.service";
import { OperationLogInterceptor } from "./operation.log";

describe("OperationLogInterceptor", () => {
  it("does not persist stack traces on failed requests", async () => {
    const addUserOperationLog = jest.fn().mockResolvedValue(undefined);
    const interceptor = new OperationLogInterceptor({
      addUserOperationLog,
    } as unknown as LogService);
    const err = Object.assign(new Error("boom"), {
      stack: "Error: boom\n    at test",
    });
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: "POST",
          url: "/user",
          ip: "127.0.0.1",
          headers: { "user-agent": "jest" },
          user: { id: "user-1", username: "alice", phone: "13800000000" },
        }),
      }),
    } as ExecutionContext;

    await expect(
      lastValueFrom(
        interceptor.intercept(context, { handle: () => throwError(() => err) }),
      ),
    ).rejects.toThrow("boom");

    expect(addUserOperationLog).toHaveBeenCalledWith(
      expect.objectContaining({
        isSuccess: false,
        detailInfo: expect.not.objectContaining({ stack: expect.anything() }),
      }),
    );
    expect(
      addUserOperationLog.mock.calls[0]?.[0].detailInfo,
    ).not.toHaveProperty("stack");
  });
});
