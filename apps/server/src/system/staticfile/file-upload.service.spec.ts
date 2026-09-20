import { Prisma } from "#/prisma/generated/prisma/client.js";
import type { FileCleanupService } from "#/system/file-cleanup/file-cleanup.service.js";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import type { FileUploadRepository } from "./file-upload.repository.js";
import { FileUploadService } from "./file-upload.service.js";
import type { FileRepository } from "./file.repository.js";

const SHA = "a".repeat(64);

describe("FileUploadService", () => {
  const findActiveBySha256 = vi.fn();
  const findDeletedBySha256 = vi.fn();
  const restoreById = vi.fn();
  const createFile = vi.fn();
  const countOpenSessions = vi.fn();
  const findResumable = vi.fn();
  const createSession = vi.fn();
  const updateTempDir = vi.fn();
  const findById = vi.fn();
  const listChunkIndexes = vi.fn();
  const upsertChunk = vi.fn();
  const markUploading = vi.fn();
  const tryBeginComplete = vi.fn();
  const tryAbort = vi.fn();
  const setStatus = vi.fn();
  const findExpiredOpen = vi.fn();
  const findStuckCompleting = vi.fn();
  const markExpired = vi.fn();
  const markFailed = vi.fn();
  const enqueue = vi.fn();

  let root: string;
  let previousRoot: string | undefined;
  let service: FileUploadService;

  const fileRow = {
    id: 1,
    name: "stored.bin",
    mimeType: "application/octet-stream",
    path: "",
    extension: "bin",
    size: 4n,
    url: "/static/file/manage/stored.bin",
    sha256: SHA,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    deletedAt: null as Date | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    previousRoot = process.env.STATIC_FILE_ROOT_PATH;
    root = mkdtempSync(join(tmpdir(), "file-upload-"));
    process.env.STATIC_FILE_ROOT_PATH = root;
    fileRow.path = join(root, "file", "manage", "stored.bin");
    mkdirSync(join(root, "file", "manage"), { recursive: true });

    findActiveBySha256.mockResolvedValue(null);
    findDeletedBySha256.mockResolvedValue(null);
    findResumable.mockResolvedValue(null);
    countOpenSessions.mockResolvedValue(0);
    createSession.mockResolvedValue({ id: "sess-1" });
    updateTempDir.mockResolvedValue({});
    enqueue.mockResolvedValue(undefined);
    setStatus.mockResolvedValue({});
    tryBeginComplete.mockResolvedValue({ count: 1 });
    tryAbort.mockResolvedValue({ count: 1 });
    listChunkIndexes.mockResolvedValue([]);
    findExpiredOpen.mockResolvedValue([]);
    findStuckCompleting.mockResolvedValue([]);

    service = new FileUploadService(
      {
        findActiveBySha256,
        findDeletedBySha256,
        restoreById,
        create: createFile,
      } as unknown as FileRepository,
      {
        countOpenSessions,
        findResumable,
        createSession,
        updateTempDir,
        findById,
        listChunkIndexes,
        upsertChunk,
        markUploading,
        tryBeginComplete,
        tryAbort,
        setStatus,
        findExpiredOpen,
        findStuckCompleting,
        markExpired,
        markFailed,
      } as unknown as FileUploadRepository,
      { enqueue } as unknown as FileCleanupService,
      {
        get: (key: string) => {
          if (key === "fileUpload") {
            return {
              maxBytes: 1024,
              chunkBytes: 8,
              sessionTtlHours: 24,
              maxOpenSessions: 2,
            };
          }
          if (key === "staticFileServeRoot") return "/static";
          return undefined;
        },
      } as unknown as ConfigService,
    );
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    if (previousRoot === undefined) delete process.env.STATIC_FILE_ROOT_PATH;
    else process.env.STATIC_FILE_ROOT_PATH = previousRoot;
  });

  it("returns instant when an active file with the same hash exists", async () => {
    findActiveBySha256.mockResolvedValue(fileRow);

    const result = await service.initiate("user-1", {
      sha256: SHA,
      size: 4,
      originalName: "a.bin",
      mimeType: "application/octet-stream",
    });

    expect(result.data).toMatchObject({
      outcome: "instant",
      file: { id: 1, size: 4 },
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("restores a soft-deleted file when the disk copy still exists", async () => {
    writeFileSync(fileRow.path, "data");
    findDeletedBySha256.mockResolvedValue({
      ...fileRow,
      deletedAt: new Date(),
    });
    restoreById.mockResolvedValue(fileRow);

    const result = await service.initiate("user-1", {
      sha256: SHA,
      size: 4,
      originalName: "a.bin",
      mimeType: "application/octet-stream",
    });

    expect(result.data.outcome).toBe("restored");
    expect(restoreById).toHaveBeenCalledWith(1);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("creates a new session when the soft-deleted file is already gone from disk", async () => {
    findDeletedBySha256.mockResolvedValue({
      ...fileRow,
      deletedAt: new Date(),
    });

    const result = await service.initiate("user-1", {
      sha256: SHA,
      size: 4,
      originalName: "a.bin",
      mimeType: "application/octet-stream",
    });

    expect(result.data.outcome).toBe("created");
    expect(restoreById).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalled();
  });

  it("resumes the latest matching open session", async () => {
    findResumable.mockResolvedValue({
      id: "sess-old",
      chunkSize: 8,
      totalChunks: 1,
      expiresAt: new Date("2026-09-02T00:00:00.000Z"),
      chunks: [{ chunkIndex: 0 }],
    });

    const result = await service.initiate("user-1", {
      sha256: SHA,
      size: 4,
      originalName: "a.bin",
      mimeType: "application/octet-stream",
    });

    expect(result.data).toMatchObject({
      outcome: "resumed",
      sessionId: "sess-old",
      uploadedChunks: [0],
    });
  });

  it("rejects oversized files, dangerous names, and too many open sessions", async () => {
    await expect(
      service.initiate("user-1", {
        sha256: SHA,
        size: 2048,
        originalName: "a.bin",
        mimeType: "application/octet-stream",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.initiate("user-1", {
        sha256: SHA,
        size: 4,
        originalName: "run.exe",
        mimeType: "application/octet-stream",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    countOpenSessions.mockResolvedValue(2);
    await expect(
      service.initiate("user-1", {
        sha256: SHA,
        size: 4,
        originalName: "a.bin",
        mimeType: "application/octet-stream",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("hides other users sessions behind 404", async () => {
    findById.mockResolvedValue({
      id: "sess-1",
      createdById: "other",
      status: "UPLOADING",
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(service.getSession("user-1", "sess-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("writes an idempotent chunk and rejects a wrong size", async () => {
    findById.mockResolvedValue({
      id: "sess-1",
      createdById: "user-1",
      status: "INITIATED",
      expiresAt: new Date(Date.now() + 60_000),
      chunkSize: 8,
      totalChunks: 1,
      size: 4n,
    });

    await expect(
      service.uploadChunk("user-1", "sess-1", 0, Buffer.alloc(8)),
    ).rejects.toBeInstanceOf(BadRequestException);

    await service.uploadChunk("user-1", "sess-1", 0, Buffer.from("abcd"));
    expect(upsertChunk).toHaveBeenCalledWith("sess-1", 0, 4);
    expect(markUploading).toHaveBeenCalledWith("sess-1");
  });

  it("rejects complete when chunks are missing and keeps the session uploadable", async () => {
    findById.mockResolvedValue({
      id: "sess-1",
      createdById: "user-1",
      status: "UPLOADING",
      expiresAt: new Date(Date.now() + 60_000),
      chunkSize: 8,
      totalChunks: 1,
      size: 4n,
      sha256: SHA,
      tempDir: "file/tmp/sess-1",
      originalName: "a.bin",
      mimeType: "application/octet-stream",
      chunks: [],
    });

    await expect(service.complete("user-1", "sess-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(setStatus).toHaveBeenCalledWith("sess-1", "UPLOADING");
  });

  it("rejects chunks after the session has expired", async () => {
    findById.mockResolvedValue({
      id: "sess-1",
      createdById: "user-1",
      status: "UPLOADING",
      expiresAt: new Date(Date.now() - 1000),
      chunkSize: 8,
      totalChunks: 1,
      size: 4n,
    });

    await expect(
      service.uploadChunk("user-1", "sess-1", 0, Buffer.from("abcd")),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(upsertChunk).not.toHaveBeenCalled();
  });

  it("completes a hashed file onto disk", async () => {
    const content = Buffer.from("abcd");
    const sha256 = createHash("sha256").update(content).digest("hex");
    const tempDir = join(root, "file", "tmp", "sess-1");
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, "0"), content);
    const session = {
      id: "sess-1",
      createdById: "user-1",
      status: "UPLOADING",
      expiresAt: new Date(Date.now() + 60_000),
      chunkSize: 8,
      totalChunks: 1,
      size: 4n,
      sha256,
      tempDir: "file/tmp/sess-1",
      originalName: "a.bin",
      mimeType: "application/octet-stream",
      chunks: [{ chunkIndex: 0, size: 4 }],
    };
    findById.mockResolvedValue(session);
    createFile.mockImplementation((data) => ({
      ...fileRow,
      ...data,
      id: 2,
      sha256,
      size: 4n,
      deletedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    }));

    const result = await service.complete("user-1", "sess-1");

    expect(result.data.file.sha256).toBe(sha256);
    expect(result.data.file.name).toBe("a.bin");
    expect(createFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: "a.bin" }),
    );
    expect(setStatus).toHaveBeenCalledWith("sess-1", "COMPLETED");
    expect(enqueue).toHaveBeenCalledWith([
      expect.objectContaining({ kind: "upload-session", sessionId: "sess-1" }),
    ]);
  });

  it("fails complete when the server hash does not match", async () => {
    const tempDir = join(root, "file", "tmp", "sess-1");
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, "0"), "abcd");
    findById.mockResolvedValue({
      id: "sess-1",
      createdById: "user-1",
      status: "UPLOADING",
      expiresAt: new Date(Date.now() + 60_000),
      chunkSize: 8,
      totalChunks: 1,
      size: 4n,
      sha256: SHA,
      tempDir: "file/tmp/sess-1",
      originalName: "a.bin",
      mimeType: "application/octet-stream",
      chunks: [{ chunkIndex: 0, size: 4 }],
    });

    await expect(service.complete("user-1", "sess-1")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(setStatus).toHaveBeenCalledWith("sess-1", "FAILED");
    expect(enqueue).toHaveBeenCalledWith([
      expect.objectContaining({ kind: "upload-session", sessionId: "sess-1" }),
    ]);
    expect(createFile).not.toHaveBeenCalled();
  });

  it("returns the existing file when a concurrent complete wins the unique index", async () => {
    const content = Buffer.from("abcd");
    const sha256 = createHash("sha256").update(content).digest("hex");
    const tempDir = join(root, "file", "tmp", "sess-1");
    mkdirSync(tempDir, { recursive: true });
    writeFileSync(join(tempDir, "0"), content);
    findById.mockResolvedValue({
      id: "sess-1",
      createdById: "user-1",
      status: "UPLOADING",
      expiresAt: new Date(Date.now() + 60_000),
      chunkSize: 8,
      totalChunks: 1,
      size: 4n,
      sha256,
      tempDir: "file/tmp/sess-1",
      originalName: "a.bin",
      mimeType: "application/octet-stream",
      chunks: [{ chunkIndex: 0, size: 4 }],
    });
    createFile.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    findActiveBySha256
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...fileRow, sha256, size: 4n });

    const result = await service.complete("user-1", "sess-1");

    expect(result.data.file.id).toBe(1);
    expect(setStatus).toHaveBeenCalledWith("sess-1", "COMPLETED");
    expect(setStatus).not.toHaveBeenCalledWith("sess-1", "FAILED");
    expect(enqueue).toHaveBeenCalledWith([
      expect.objectContaining({ kind: "orphan-path" }),
    ]);
  });
});
