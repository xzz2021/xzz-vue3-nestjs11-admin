import {
  SessionEventBus,
  SESSION_EVENTS,
} from "#/system/session/session.events.js";
import { BadRequestException } from "@nestjs/common";
import type { OnlineGateway } from "./online.gateway.js";
import type { OnlineService } from "./online.service.js";
import { OnlineSessionListener } from "./online.session.listener.js";

describe("OnlineSessionListener", () => {
  const removeByUserId = jest.fn();
  const remove = jest.fn();
  const terminateUserByOperator = jest.fn();
  const notifyForceLogout = jest.fn();
  const notifyForceLogoutByUser = jest.fn();

  const events = new SessionEventBus();
  const listener = new OnlineSessionListener(
    events,
    {
      removeByUserId,
      remove,
      terminateUserByOperator,
    } as unknown as OnlineService,
    { notifyForceLogout, notifyForceLogoutByUser } as unknown as OnlineGateway,
  );

  beforeAll(() => {
    listener.onModuleInit();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("clears presence and notifies WS on user-revoked without revoking tokens again", async () => {
    removeByUserId.mockResolvedValue(["jti-1"]);

    await events.emit(SESSION_EVENTS.USER_REVOKED, {
      userId: "user-1",
      reason: "revoked",
    });

    expect(removeByUserId).toHaveBeenCalledWith("user-1");
    expect(terminateUserByOperator).not.toHaveBeenCalled();
    expect(notifyForceLogout).toHaveBeenCalledWith(["jti-1"], "revoked");
    expect(notifyForceLogoutByUser).toHaveBeenCalledWith("user-1", "revoked");
  });

  it("removes a single session on session-ended", async () => {
    remove.mockResolvedValue(undefined);

    await events.emit(SESSION_EVENTS.SESSION_ENDED, { jti: "jti-9" });

    expect(remove).toHaveBeenCalledWith("jti-9");
    expect(notifyForceLogout).not.toHaveBeenCalled();
  });

  it("kicks a user on force-logout and notifies WS", async () => {
    terminateUserByOperator.mockResolvedValue(["jti-2"]);

    const results = await events.emit(SESSION_EVENTS.FORCE_LOGOUT_REQUESTED, {
      operatorId: "op-1",
      targetUserId: "user-2",
    });

    expect(terminateUserByOperator).toHaveBeenCalledWith("op-1", "user-2");
    expect(notifyForceLogout).toHaveBeenCalledWith(["jti-2"], "forced");
    expect(notifyForceLogoutByUser).toHaveBeenCalledWith("user-2", "forced");
    expect(results).toEqual([["jti-2"]]);
  });

  it("propagates kick policy errors from presence", async () => {
    terminateUserByOperator.mockRejectedValue(
      new BadRequestException("不能强制下线自己"),
    );

    await expect(
      events.emit(SESSION_EVENTS.FORCE_LOGOUT_REQUESTED, {
        operatorId: "op-1",
        targetUserId: "op-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
