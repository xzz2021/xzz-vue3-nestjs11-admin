import { BadRequestException } from "@nestjs/common";
import { CaptchaService } from "./captcha.service.js";

describe("CaptchaService.verify", () => {
  const evalScript = vi.fn();
  const service = new CaptchaService(
    { getOrThrow: () => ({ eval: evalScript }) } as never,
    { get: () => false } as never,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("atomically consumes a matching captcha so it cannot be replayed", async () => {
    evalScript.mockResolvedValueOnce(1);
    await expect(service.verify("id-1", "AbC")).resolves.toBe(true);
    expect(evalScript).toHaveBeenCalledWith(
      expect.stringContaining("DEL"),
      1,
      "captchaId:id-1",
      "AbC",
    );

    evalScript.mockResolvedValueOnce(0);
    await expect(service.verify("id-1", "AbC")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("keeps the captcha when the text does not match", async () => {
    evalScript.mockResolvedValueOnce(-1);
    await expect(service.verify("id-1", "wrong")).resolves.toBe(false);
    expect(evalScript.mock.calls[0][0]).toMatch(/GET/);
  });
});
