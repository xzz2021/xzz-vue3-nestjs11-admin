import { ErrorEnum } from "#/processor/constants/error-code.js";
import { DANGEROUS_FILENAME_RE } from "#/processor/constants/filename.js";
import { throwOssError } from "./oss.exception.js";

const MAX_SEGMENT_CHARS = 255;
const MAX_KEY_BYTES = 1024;

export function assertObjectSegment(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throwOssError(ErrorEnum.OSS_INVALID_KEY);
  }
  if (
    trimmed.includes("/") ||
    trimmed.includes("\\") ||
    trimmed.includes("\0")
  ) {
    throwOssError(ErrorEnum.OSS_INVALID_KEY);
  }
  if (trimmed === "." || trimmed === "..") {
    throwOssError(ErrorEnum.OSS_INVALID_KEY);
  }
  if (trimmed.length > MAX_SEGMENT_CHARS) {
    throwOssError(ErrorEnum.OSS_INVALID_KEY);
  }
  if (DANGEROUS_FILENAME_RE.test(trimmed)) {
    throwOssError(ErrorEnum.OSS_INVALID_KEY);
  }
  return trimmed;
}

export function normalizePrefix(prefix?: string | null): string {
  const raw = (prefix ?? "").replace(/\\/g, "/").trim();
  if (!raw) {
    return "";
  }
  const parts = raw.split("/").filter((part) => part !== "");
  for (const part of parts) {
    assertObjectSegment(part);
  }
  return `${parts.join("/")}/`;
}

function assertKeyLength(key: string): string {
  if (Buffer.byteLength(key, "utf8") > MAX_KEY_BYTES) {
    throwOssError(ErrorEnum.OSS_INVALID_KEY);
  }
  return key;
}

export function joinObjectKey(
  prefix: string | undefined | null,
  filename: string,
): string {
  const normalizedPrefix = normalizePrefix(prefix);
  const name = assertObjectSegment(filename);
  return assertKeyLength(`${normalizedPrefix}${name}`);
}

export function joinFolderKey(
  prefix: string | undefined | null,
  name: string,
): string {
  const key = `${joinObjectKey(prefix, name)}/`;
  return assertKeyLength(key);
}

export function joinRelativeKey(
  prefix: string | undefined | null,
  relativePath: string,
): { prefix: string; filename: string; key: string } {
  const segments = relativePath
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part !== "");
  if (segments.length === 0) {
    throwOssError(ErrorEnum.OSS_INVALID_KEY);
  }
  const filename = segments.pop() as string;
  let current = normalizePrefix(prefix);
  for (const segment of segments) {
    current = joinFolderKey(current, segment);
  }
  const key = joinObjectKey(current, filename);
  return { prefix: current, filename: assertObjectSegment(filename), key };
}

export function folderNameFromPrefix(prefix: string): string {
  const parts = prefix.split("/").filter(Boolean);
  return parts[parts.length - 1] || prefix;
}

export function isFolderKey(key: string): boolean {
  return key.endsWith("/");
}

export function isDescendantPrefix(
  sourceFolderPrefix: string,
  destinationPrefix: string,
): boolean {
  const source = normalizePrefix(sourceFolderPrefix);
  const dest = normalizePrefix(destinationPrefix);
  if (!source) {
    return false;
  }
  return dest.startsWith(source);
}
