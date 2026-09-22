import { DANGEROUS_FILENAME_RE } from "#/processor/constants/filename.js";
import { BadRequestException } from "@nestjs/common";
import type { MulterOptions } from "@nestjs/platform-express/multer/interfaces/multer-options.interface";
import { randomUUID } from "crypto";
import type { Request } from "express";
import * as fs from "fs";
import { diskStorage, memoryStorage } from "multer";
import path, { basename, extname, join, resolve, sep } from "path";

const IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
]);
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

const MANAGE_MIME = new Set([
  ...IMAGE_MIME,
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
]);
const MANAGE_EXT = new Set([...IMAGE_EXT, ".pdf", ".txt", ".zip"]);

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const MANAGE_MAX_BYTES = 10 * 1024 * 1024;

export { DANGEROUS_FILENAME_RE };

export function getStaticFileRoot(): string {
  const configured = process.env.STATIC_FILE_ROOT_PATH;
  if (!configured) {
    throw new Error("STATIC_FILE_ROOT_PATH is not configured");
  }
  return resolve(process.cwd(), configured);
}

export function decodeOriginalName(originalname: string): string {
  return Buffer.from(originalname, "latin1").toString("utf-8");
}

/** 仅保留 basename，拒绝路径穿越与危险扩展名，并生成不可猜测的存储名 */
export function sanitizeUploadFilename(
  originalname: string,
  allowedExts: Set<string>,
): string {
  const decoded = decodeOriginalName(originalname);
  const base = basename(decoded).replace(/[/\\]/g, "");
  if (DANGEROUS_FILENAME_RE.test(base)) {
    throw new BadRequestException("文件名包含危险扩展名");
  }
  const ext = extname(base).toLowerCase();
  if (!allowedExts.has(ext)) {
    throw new BadRequestException(`不允许的文件扩展名: ${ext || "(无)"}`);
  }
  const stem =
    base
      .slice(0, Math.max(0, base.length - ext.length))
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 64) || "file";
  return `${Date.now()}-${randomUUID().slice(0, 8)}-${stem}${ext}`;
}

export function assertNotDangerousFilename(originalname: string): void {
  const decoded = decodeOriginalName(originalname);
  const base = basename(decoded).replace(/[/\\]/g, "");
  if (!base || DANGEROUS_FILENAME_RE.test(base)) {
    throw new BadRequestException("文件名包含危险扩展名");
  }
}

/** 列表/下载展示用原始文件名：只取 basename，不加时间戳或随机串 */
export function originalUploadBasename(originalname: string): string {
  const base = basename(originalname).replace(/[/\\]/g, "").trim();
  if (!base || DANGEROUS_FILENAME_RE.test(base)) {
    throw new BadRequestException("文件名包含危险扩展名");
  }
  return base.slice(0, 255);
}

/** 大文件上传：只拦危险后缀，允许其余类型；磁盘文件名仍加唯一前缀避免同名覆盖 */
export function sanitizeUploadFilenameByBlacklist(
  originalname: string,
): string {
  const base = originalUploadBasename(originalname);
  const ext = extname(base).toLowerCase();
  const stem =
    base
      .slice(0, Math.max(0, base.length - ext.length))
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(0, 64) || "file";
  return `${Date.now()}-${randomUUID().slice(0, 8)}-${stem}${ext}`;
}

export function sanitizePathSegment(segment: string): string {
  const cleaned = segment.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return cleaned || "unknown";
}

export function assertPathInsideRoot(root: string, targetPath: string): string {
  const resolvedRoot = resolve(root);
  const resolvedTarget = resolve(targetPath);
  const rootPrefix = resolvedRoot.endsWith(sep)
    ? resolvedRoot
    : resolvedRoot + sep;
  if (
    resolvedTarget !== resolvedRoot &&
    !resolvedTarget.startsWith(rootPrefix)
  ) {
    throw new BadRequestException("非法文件路径");
  }
  return resolvedTarget;
}

/**
 * 兼容解析落盘路径：相对路径按 STATIC_FILE_ROOT 拼接；越界或非法则返回 null（不抛错）。
 * 删除场景用：避免历史脏数据因路径失效阻断 DB 清理。
 */
export function tryResolvePathInsideRoot(
  root: string,
  targetPath: string,
): string | null {
  if (!targetPath?.trim()) {
    return null;
  }
  try {
    const candidate = path.isAbsolute(targetPath)
      ? targetPath
      : join(root, targetPath);
    return assertPathInsideRoot(root, candidate);
  } catch {
    return null;
  }
}

function ensureDirInsideRoot(root: string, relativeDir: string): string {
  if (
    !relativeDir ||
    relativeDir.includes("..") ||
    path.isAbsolute(relativeDir)
  ) {
    throw new BadRequestException("非法上传目录");
  }
  const target = assertPathInsideRoot(root, join(root, relativeDir));
  fs.mkdirSync(target, { recursive: true });
  return target;
}

export function ensureUploadTempDir(sessionId: string): string {
  if (!/^[a-z0-9_-]+$/i.test(sessionId) || sessionId.length > 64) {
    throw new BadRequestException("非法会话");
  }
  return ensureDirInsideRoot(
    getStaticFileRoot(),
    join("file", "tmp", sessionId),
  );
}

function createFileFilter(
  allowedMimes: Set<string>,
  allowedExts: Set<string>,
): NonNullable<MulterOptions["fileFilter"]> {
  return (_req, file, cb) => {
    try {
      const decoded = decodeOriginalName(file.originalname);
      const ext = extname(basename(decoded)).toLowerCase();
      if (!allowedMimes.has(file.mimetype) || !allowedExts.has(ext)) {
        cb(new BadRequestException("不支持的文件类型"), false);
        return;
      }
      cb(null, true);
    } catch (error) {
      cb(
        error instanceof Error
          ? error
          : new BadRequestException("文件校验失败"),
        false,
      );
    }
  };
}

function createSafeFilenameHandler(allowedExts: Set<string>) {
  return (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    try {
      cb(null, sanitizeUploadFilename(file.originalname, allowedExts));
    } catch (error) {
      cb(
        error instanceof Error ? error : new BadRequestException("文件名非法"),
        "",
      );
    }
  };
}

/** 通用文件管理上传：类型白名单 + 大小限制 + 安全文件名 */
export const generateMulterConfig = (
  directory: string = "file/manage",
): MulterOptions => {
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        try {
          const uploadPath = ensureDirInsideRoot(
            getStaticFileRoot(),
            directory,
          );
          cb(null, uploadPath);
        } catch (error) {
          cb(error instanceof Error ? error : new Error("上传目录无效"), "");
        }
      },
      filename: createSafeFilenameHandler(MANAGE_EXT),
    }),
    fileFilter: createFileFilter(MANAGE_MIME, MANAGE_EXT),
    limits: {
      fileSize: MANAGE_MAX_BYTES,
      files: 1,
    },
  };
};

/** 头像上传：仅图片、限制大小、目录隔离在 STATIC_FILE_ROOT/avatar/<phone> */
export const multerConfigForAvatar: MulterOptions = {
  storage: diskStorage({
    destination: (req, _file, cb) => {
      try {
        const authenticatedRequest = req as Request & {
          user?: { phone?: string };
        };
        const phone = sanitizePathSegment(
          authenticatedRequest.user?.phone ?? "anonymous",
        );
        const uploadPath = ensureDirInsideRoot(
          getStaticFileRoot(),
          join("avatar", phone),
        );
        cb(null, uploadPath);
      } catch (error) {
        cb(error instanceof Error ? error : new Error("头像目录无效"), "");
      }
    },
    filename: createSafeFilenameHandler(IMAGE_EXT),
  }),
  fileFilter: createFileFilter(IMAGE_MIME, IMAGE_EXT),
  limits: {
    fileSize: AVATAR_MAX_BYTES,
    files: 1,
  },
};

/** @deprecated 保留兼容；内部已走安全配置 */
export const multerConfig = generateMulterConfig("file/test");

export const generateMulterConfigOfImg = (
  directory: string,
  isImg: boolean = true,
): MulterOptions => {
  const allowedMimes = isImg ? IMAGE_MIME : MANAGE_MIME;
  const allowedExts = isImg ? IMAGE_EXT : MANAGE_EXT;
  return {
    fileFilter: createFileFilter(allowedMimes, allowedExts),
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        try {
          // directory 视为相对 STATIC_FILE_ROOT 的子目录，禁止绝对路径
          const uploadPath = ensureDirInsideRoot(
            getStaticFileRoot(),
            directory,
          );
          cb(null, uploadPath);
        } catch (error) {
          cb(error instanceof Error ? error : new Error("上传目录无效"), "");
        }
      },
      filename: createSafeFilenameHandler(allowedExts),
    }),
    limits: {
      fileSize: isImg ? AVATAR_MAX_BYTES : MANAGE_MAX_BYTES,
      files: 1,
    },
  };
};

/** 分片上传：内存接收裸字节，类型在 initiate 已校验 */
export const generateChunkMulterConfig = (
  maxChunkBytes: number,
): MulterOptions => {
  return {
    storage: memoryStorage(),
    limits: {
      fileSize: maxChunkBytes + 1024,
      files: 1,
    },
  };
};

const CSV_MIME = new Set([
  "text/csv",
  "application/csv",
  "text/plain",
  "application/vnd.ms-excel",
]);
const CSV_EXT = new Set([".csv"]);
const CSV_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

/** CSV 导入：内存缓冲，仅允许 .csv */
export const multerConfigForCsvImport: MulterOptions = {
  storage: memoryStorage(),
  fileFilter: (_req, file, cb) => {
    try {
      const decoded = decodeOriginalName(file.originalname);
      const ext = extname(basename(decoded)).toLowerCase();
      if (!CSV_EXT.has(ext)) {
        cb(new BadRequestException("仅支持 CSV 文件"), false);
        return;
      }
      if (
        file.mimetype &&
        !CSV_MIME.has(file.mimetype) &&
        file.mimetype !== "application/octet-stream"
      ) {
        cb(new BadRequestException("仅支持 CSV 文件"), false);
        return;
      }
      cb(null, true);
    } catch (error) {
      cb(
        error instanceof Error
          ? error
          : new BadRequestException("文件校验失败"),
        false,
      );
    }
  },
  limits: {
    fileSize: CSV_IMPORT_MAX_BYTES,
    files: 1,
  },
};

export const UPLOAD_ALLOWLIST = {
  IMAGE_MIME,
  IMAGE_EXT,
  MANAGE_MIME,
  MANAGE_EXT,
  AVATAR_MAX_BYTES,
  MANAGE_MAX_BYTES,
};
