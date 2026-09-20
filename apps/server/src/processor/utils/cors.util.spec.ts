import { httpCorsOptions, parseCorsOrigins, wsCorsOptions } from "./cors.util";

describe("parseCorsOrigins", () => {
  it("returns empty when unset or blank", () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins("")).toEqual([]);
    expect(parseCorsOrigins("  ")).toEqual([]);
  });

  it("splits a comma list and strips trailing slashes", () => {
    expect(parseCorsOrigins("https://a.com/, https://b.com")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });
});

describe("httpCorsOptions", () => {
  it("enables credentials against the origin whitelist", () => {
    const options = httpCorsOptions(["https://a.com"]);
    expect(options.origin).toEqual(["https://a.com"]);
    expect(options.credentials).toBe(true);
  });
});

describe("wsCorsOptions", () => {
  it("disables cross-origin when the whitelist is empty", () => {
    expect(wsCorsOptions("")).toEqual({ origin: false, credentials: true });
  });

  it("uses the parsed whitelist", () => {
    expect(wsCorsOptions("https://a.com/")).toEqual({
      origin: ["https://a.com"],
      credentials: true,
    });
  });
});
