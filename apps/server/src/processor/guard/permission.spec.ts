import { AuthorizationContext } from "@/processor/authorization/authorization-context";
import type { AuthorizationService } from "@/processor/authorization/authorization.service";
import { PERMISSION_KEY } from "@/processor/decorator/permission";
import { Prisma } from "@/prisma/generated/prisma/client";
import {
  ForbiddenException,
  ServiceUnavailableException,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionGuard } from "./permission";

describe("PermissionGuard", () => {
  const authCreateContext = jest.fn();

  const createGuard = () =>
    new PermissionGuard(
      { createContext: authCreateContext } as unknown as AuthorizationService,
      new Reflector(),
    );

  const executionContext = (permission?: string, userId?: string) => {
    const handler = () => undefined;
    class TestController {}
    if (permission) Reflect.defineMetadata(PERMISSION_KEY, permission, handler);
    const request: {
      user?: { id: string };
      authorizationContext?: AuthorizationContext;
    } = { user: userId ? { id: userId } : undefined };

    const context = {
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("allows routes without permission metadata", async () => {
    await expect(
      createGuard().canActivate(executionContext().context),
    ).resolves.toBe(true);
    expect(authCreateContext).not.toHaveBeenCalled();
  });

  it("rejects protected routes without an authenticated user", async () => {
    await expect(
      createGuard().canActivate(executionContext("user:update").context),
    ).rejects.toThrow(new ForbiddenException("身份无效，无法校验权限"));
    expect(authCreateContext).not.toHaveBeenCalled();
  });

  it("creates and attaches one authorization context for downstream reuse", async () => {
    const authorizationContext = new AuthorizationContext(
      "user-1",
      ["user:update"],
      {
        "user:update": { scoped: false },
      },
    );
    authCreateContext.mockResolvedValue(authorizationContext);
    const { context, request } = executionContext("user:update", "user-1");

    await expect(createGuard().canActivate(context)).resolves.toBe(true);
    expect(authCreateContext).toHaveBeenCalledWith("user-1", ["user:update"]);
    expect(request.authorizationContext).toBe(authorizationContext);
  });

  it("rejects a request when the required permission is missing", async () => {
    authCreateContext.mockResolvedValue(
      new AuthorizationContext("user-1", ["user:view"], {}),
    );

    await expect(
      createGuard().canActivate(
        executionContext("user:update", "user-1").context,
      ),
    ).rejects.toThrow(new ForbiddenException("无权限访问当前接口"));
  });

  it("maps transient database failures to 503", async () => {
    authCreateContext.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("connection lost", {
        code: "P1001",
        clientVersion: "test",
      }),
    );

    await expect(
      createGuard().canActivate(
        executionContext("user:update", "user-1").context,
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("preserves typed service-unavailable errors from authorization services", async () => {
    const error = new ServiceUnavailableException("授权缓存暂不可用");
    authCreateContext.mockRejectedValue(error);

    await expect(
      createGuard().canActivate(
        executionContext("user:update", "user-1").context,
      ),
    ).rejects.toBe(error);
  });
});
