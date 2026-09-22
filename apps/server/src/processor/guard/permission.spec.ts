import { AuthorizationContext } from "#/processor/authorization/authorization-context.js";
import type { AuthorizationService } from "#/processor/authorization/authorization.service.js";
import { PERMISSION_KEY } from "#/processor/decorator/permission.js";
import { IS_AUTHENTICATED_KEY, IS_PUBLIC_KEY } from "#/processor/decorator/public.js";
import { Prisma } from "#/generated/prisma/client.js";
import {
  ForbiddenException,
  ServiceUnavailableException,
  type ExecutionContext,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PermissionGuard } from "./permission.js";

describe("PermissionGuard", () => {
  const authCreateContext = vi.fn();

  const createGuard = () =>
    new PermissionGuard(
      { createContext: authCreateContext } as unknown as AuthorizationService,
      new Reflector(),
    );

  const executionContext = (options?: {
    permission?: string;
    userId?: string;
    isPublic?: boolean;
    authenticated?: boolean;
    type?: "http" | "ws";
  }) => {
    const handler = () => undefined;
    class TestController {}
    if (options?.permission) {
      Reflect.defineMetadata(PERMISSION_KEY, options.permission, handler);
    }
    if (options?.isPublic) {
      Reflect.defineMetadata(IS_PUBLIC_KEY, true, handler);
    }
    if (options?.authenticated) {
      Reflect.defineMetadata(IS_AUTHENTICATED_KEY, true, handler);
    }
    const request: {
      user?: { id: string };
      authorizationContext?: AuthorizationContext;
    } = { user: options?.userId ? { id: options.userId } : undefined };

    const context = {
      getType: () => options?.type ?? "http",
      getHandler: () => handler,
      getClass: () => TestController,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects routes without public, authenticated, or permission metadata", async () => {
    await expect(
      createGuard().canActivate(executionContext().context),
    ).rejects.toThrow(new ForbiddenException("接口未配置访问权限"));
    expect(authCreateContext).not.toHaveBeenCalled();
  });

  it("allows public routes without permission metadata", async () => {
    await expect(
      createGuard().canActivate(executionContext({ isPublic: true }).context),
    ).resolves.toBe(true);
    expect(authCreateContext).not.toHaveBeenCalled();
  });

  it("allows authenticated-only routes when the request has a user", async () => {
    await expect(
      createGuard().canActivate(
        executionContext({ authenticated: true, userId: "user-1" }).context,
      ),
    ).resolves.toBe(true);
    expect(authCreateContext).not.toHaveBeenCalled();
  });

  it("rejects authenticated-only routes without a user", async () => {
    await expect(
      createGuard().canActivate(
        executionContext({ authenticated: true }).context,
      ),
    ).rejects.toThrow(new ForbiddenException("身份无效，无法校验权限"));
  });

  it("rejects protected routes without an authenticated user", async () => {
    await expect(
      createGuard().canActivate(
        executionContext({ permission: "user:update" }).context,
      ),
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
    const { context, request } = executionContext({
      permission: "user:update",
      userId: "user-1",
    });

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
        executionContext({
          permission: "user:update",
          userId: "user-1",
        }).context,
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
        executionContext({
          permission: "user:update",
          userId: "user-1",
        }).context,
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it("preserves typed service-unavailable errors from authorization services", async () => {
    const error = new ServiceUnavailableException("授权缓存暂不可用");
    authCreateContext.mockRejectedValue(error);

    await expect(
      createGuard().canActivate(
        executionContext({
          permission: "user:update",
          userId: "user-1",
        }).context,
      ),
    ).rejects.toBe(error);
  });
});
