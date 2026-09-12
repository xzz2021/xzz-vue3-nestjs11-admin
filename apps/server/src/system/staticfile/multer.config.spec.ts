import { BadRequestException } from "@nestjs/common";
import { join, resolve, sep } from "path";
import {
  assertPathInsideRoot,
  sanitizePathSegment,
  sanitizeUploadFilename,
  sanitizeUploadFilenameByBlacklist,
  originalUploadBasename,
  tryResolvePathInsideRoot,
  UPLOAD_ALLOWLIST,
} from "./multer.config.js";

describe("multer upload safety helpers", () => {
  const prevRoot = process.env.STATIC_FILE_ROOT_PATH;

  beforeAll(() => {
    process.env.STATIC_FILE_ROOT_PATH = "public";
  });

  afterAll(() => {
    process.env.STATIC_FILE_ROOT_PATH = prevRoot;
  });

  it("rejects path traversal and dangerous extensions in filenames", () => {
    expect(() =>
      sanitizeUploadFilename("../../etc/passwd", UPLOAD_ALLOWLIST.MANAGE_EXT),
    ).toThrow(BadRequestException);
    expect(() =>
      sanitizeUploadFilename("shell.php", UPLOAD_ALLOWLIST.MANAGE_EXT),
    ).toThrow(BadRequestException);
    expect(() =>
      sanitizeUploadFilename("photo.exe.jpg", UPLOAD_ALLOWLIST.IMAGE_EXT),
    ).toThrow(BadRequestException);
  });

  it("blacklist sanitizer allows non-dangerous types and still blocks double extensions", () => {
    const name = sanitizeUploadFilenameByBlacklist("report.docx");
    expect(name).toMatch(/^\d+-[a-f0-9]{8}-report\.docx$/i);
    expect(() => sanitizeUploadFilenameByBlacklist("payload.php.jpg")).toThrow(
      BadRequestException,
    );
    expect(() => sanitizeUploadFilenameByBlacklist("run.exe")).toThrow(
      BadRequestException,
    );
  });

  it("keeps the original basename for display without a unique prefix", () => {
    expect(originalUploadBasename("report.docx")).toBe("report.docx");
    expect(originalUploadBasename("../dir/报告.ZIP")).toBe("报告.ZIP");
    expect(() => originalUploadBasename("run.exe")).toThrow(
      BadRequestException,
    );
  });

  it("keeps only basename and generates a safe stored name", () => {
    const name = sanitizeUploadFilename(
      "../dir/avatar.PNG",
      UPLOAD_ALLOWLIST.IMAGE_EXT,
    );
    expect(name).toMatch(/^\d+-[a-f0-9]{8}-avatar\.png$/i);
    expect(name.includes("..")).toBe(false);
    expect(name.includes(sep)).toBe(false);
  });

  it("sanitizes path segments used for avatar directories", () => {
    expect(sanitizePathSegment("138-0013/../../root")).toBe("138-0013root");
    expect(sanitizePathSegment("")).toBe("unknown");
  });

  it("blocks delete/unlink targets outside the static root", () => {
    const root = resolve(process.cwd(), "public");
    expect(() =>
      assertPathInsideRoot(root, resolve(root, "..", "package.json")),
    ).toThrow(BadRequestException);
    expect(
      assertPathInsideRoot(root, resolve(root, "avatar", "u1", "a.png")),
    ).toBe(resolve(root, "avatar", "u1", "a.png"));
  });

  it("soft-resolves paths for compatible delete without throwing", () => {
    const root = resolve(process.cwd(), "public");
    expect(
      tryResolvePathInsideRoot(root, resolve(root, "..", "package.json")),
    ).toBeNull();
    expect(tryResolvePathInsideRoot(root, "")).toBeNull();
    expect(tryResolvePathInsideRoot(root, join("avatar", "u1", "a.png"))).toBe(
      resolve(root, "avatar", "u1", "a.png"),
    );
    expect(
      tryResolvePathInsideRoot(root, resolve(root, "file", "manage", "a.png")),
    ).toBe(resolve(root, "file", "manage", "a.png"));
  });
});
