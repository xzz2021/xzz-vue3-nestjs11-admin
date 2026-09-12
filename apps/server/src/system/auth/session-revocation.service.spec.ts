import type { SessionEventBus } from "@/system/session/session.events.js";
import { SESSION_EVENTS } from "@/system/session/session.events.js";
import { BadRequestException } from "@nestjs/common";
import type { RtTokenService } from "./rt.token.service.js";
import { SessionRevocationService } from "./session-revocation.service.js";
import type { TokenService } from "./token.service.js";

describe("SessionRevocationService", () => {
  const revokeAllAccess = jest.fn();
  const revokeAllRt = jest.fn();
  const emit = jest.fn();

  const service = () =>
    new SessionRevocationService(
      { revokeAll: revokeAllAccess } as unknown as TokenService,
      { revokeAll: revokeAllRt } as unknown as RtTokenService,
      { emit } as unknown as SessionEventBus,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("revokes tokens then emits user-revoked", async () => {
    emit.mockResolvedValue([]);

    await service().revokeAll("user-1");

    expect(revokeAllAccess).toHaveBeenCalledWith("user-1");
    expect(revokeAllRt).toHaveBeenCalledWith("user-1");
    expect(emit).toHaveBeenCalledWith(SESSION_EVENTS.USER_REVOKED, {
      userId: "user-1",
      reason: "revoked",
    });
  });

  it("emits session-ended for a single jti", async () => {
    emit.mockResolvedValue([]);

    await service().endSession("jti-1");

    expect(emit).toHaveBeenCalledWith(SESSION_EVENTS.SESSION_ENDED, {
      jti: "jti-1",
    });
  });

  it("requestForceLogout succeeds when presence listener responds", async () => {
    emit.mockResolvedValue([["jti-1"]]);

    await expect(
      service().requestForceLogout("op-1", "user-2"),
    ).resolves.toBeUndefined();
    expect(emit).toHaveBeenCalledWith(SESSION_EVENTS.FORCE_LOGOUT_REQUESTED, {
      operatorId: "op-1",
      targetUserId: "user-2",
    });
  });

  it("requestForceLogout fails when presence module is not loaded", async () => {
    emit.mockResolvedValue([]);

    await expect(
      service().requestForceLogout("op-1", "user-2"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
