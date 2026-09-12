import { HttpException, HttpStatus } from "@nestjs/common";
import { ErrorEnum } from "#/processor/constants/error-code.js";
import {
  joinFolderKey,
  joinObjectKey,
  joinRelativeKey,
  normalizePrefix,
} from "./oss-key.js";

describe("oss-key", () => {
  it("normalizes empty prefix to bucket root", () => {
    expect(normalizePrefix("")).toBe("");
    expect(normalizePrefix(undefined)).toBe("");
    expect(normalizePrefix("  ")).toBe("");
  });

  it("appends a trailing slash and validates each segment", () => {
    expect(normalizePrefix("docs/2026")).toBe("docs/2026/");
    expect(normalizePrefix("/docs/2026/")).toBe("docs/2026/");
  });

  it("rejects parent-directory segments", () => {
    expect(() => normalizePrefix("docs/../secret")).toThrow(HttpException);
    expect(() => normalizePrefix("..")).toThrow(HttpException);
  });

  it("joins a file key under a prefix", () => {
    expect(joinObjectKey("docs/", "a.png")).toBe("docs/a.png");
    expect(joinObjectKey("", "a.png")).toBe("a.png");
  });

  it("joins a folder placeholder key", () => {
    expect(joinFolderKey("docs/", "photos")).toBe("docs/photos/");
  });

  it("validates every segment of a dragged relative path", () => {
    expect(joinRelativeKey("docs/", "nested/photo.png")).toEqual({
      prefix: "docs/nested/",
      filename: "photo.png",
      key: "docs/nested/photo.png",
    });
  });

  it("rejects dangerous extensions", () => {
    expect(() => joinObjectKey("", "payload.exe")).toThrow(HttpException);
    expect(() => joinObjectKey("", "shell.php.jpg")).toThrow(HttpException);
  });

  it("rejects slash in a single segment name", () => {
    expect(() => joinObjectKey("", "a/b")).toThrow(HttpException);
  });
});

describe("oss-key error mapping", () => {
  it("uses OSS_INVALID_KEY for illegal names", () => {
    try {
      joinObjectKey("", "..");
      fail("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
      const body = (error as HttpException).getResponse() as {
        errorCode?: string;
        message?: string;
      };
      expect(body.errorCode).toBe("1405");
      expect(body.message).toBe(ErrorEnum.OSS_INVALID_KEY.split(":")[1]);
    }
  });
});
