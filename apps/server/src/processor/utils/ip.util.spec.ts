import type { IncomingMessage } from "node:http";
import type { Request } from "express";
import { formatIpRegion, getIp, lookupIpLocation } from "./ip.util";

describe("getIp", () => {
  it("prefers Express req.ip over client-supplied forwarding headers", () => {
    const request = {
      ip: "203.0.113.10",
      headers: {
        "x-forwarded-for": "1.1.1.1",
        "x-real-ip": "1.1.1.1",
      },
      socket: { remoteAddress: "172.18.0.2" },
    } as unknown as Request;

    expect(getIp(request)).toBe("203.0.113.10");
  });

  it("uses sanitized headers on raw sockets only when the peer is private", () => {
    const request = {
      headers: {
        "x-real-ip": "203.0.113.9",
        "x-forwarded-for": "198.51.100.1",
      },
      socket: { remoteAddress: "::ffff:172.18.0.4" },
    } as unknown as IncomingMessage;

    expect(getIp(request)).toBe("203.0.113.9");
  });

  it("ignores spoofed forwarding headers from a public peer", () => {
    const request = {
      headers: { "x-forwarded-for": "1.1.1.1", "x-real-ip": "1.1.1.1" },
      socket: { remoteAddress: "8.8.8.8" },
    } as unknown as IncomingMessage;

    expect(getIp(request)).toBe("8.8.8.8");
  });
});

describe("lookupIpLocation", () => {
  it("maps loopback and private addresses to LAN", async () => {
    await expect(lookupIpLocation("127.0.0.1")).resolves.toBe("内网IP");
    await expect(lookupIpLocation("::ffff:127.0.0.1")).resolves.toBe("内网IP");
    await expect(lookupIpLocation("192.168.1.1")).resolves.toBe("内网IP");
    await expect(lookupIpLocation("10.0.0.8")).resolves.toBe("内网IP");
  });

  it("returns unknown for empty input", async () => {
    await expect(lookupIpLocation("")).resolves.toBe("未知");
    await expect(lookupIpLocation("-")).resolves.toBe("未知");
    await expect(lookupIpLocation(null)).resolves.toBe("未知");
  });

  it("formats ip2region region as country province city", () => {
    expect(formatIpRegion("中国|0|广东省|深圳市|电信")).toBe(
      "中国 广东省 深圳市",
    );
    expect(formatIpRegion("美国|0|0|0|0")).toBe("美国");
  });

  it("does not throw when looking up a public IPv4", async () => {
    const location = await lookupIpLocation("218.4.167.70");
    expect(typeof location).toBe("string");
    expect(location.length).toBeGreaterThan(0);
  });
});
