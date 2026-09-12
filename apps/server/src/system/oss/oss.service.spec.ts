import {
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { HttpException, HttpStatus } from "@nestjs/common";
import { loadOssS3Config, type OssS3RuntimeConfig } from "./oss.s3.js";
import { OssService } from "./oss.service.js";

jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: jest.fn(() => "https://s3.example/presigned"),
}));

const presign = getSignedUrl;

function configured(
  overrides: Partial<OssS3RuntimeConfig> = {},
): OssS3RuntimeConfig {
  return {
    configured: true,
    bucket: "bucket",
    region: "us-east-1",
    endpoint: "http://127.0.0.1:9000",
    forcePathStyle: true,
    putSimpleMaxBytes: 16 * 1024 * 1024,
    multipartPartBytes: 8 * 1024 * 1024,
    presignGetExpiresSec: 3600,
    presignPutExpiresSec: 900,
    maxBatchKeys: 3,
    accessKey: "ak",
    secretKey: "sk",
    ...overrides,
  };
}

describe("loadOssS3Config", () => {
  it("is unconfigured when any required field is missing", () => {
    expect(loadOssS3Config({}).configured).toBe(false);
    expect(
      loadOssS3Config({
        OSS_S3_ENDPOINT: "http://127.0.0.1:9000",
        OSS_S3_ACCESS_KEY: "ak",
        OSS_S3_SECRET_KEY: "sk",
      }).configured,
    ).toBe(false);
  });

  it("is configured when endpoint, keys and bucket are set", () => {
    const cfg = loadOssS3Config({
      OSS_S3_ENDPOINT: "http://127.0.0.1:9000",
      OSS_S3_ACCESS_KEY: "ak",
      OSS_S3_SECRET_KEY: "sk",
      OSS_S3_BUCKET: "public",
    });
    expect(cfg.configured).toBe(true);
    expect(cfg.bucket).toBe("public");
    expect(cfg.forcePathStyle).toBe(true);
  });
});

describe("OssService", () => {
  let send: jest.Mock;
  let service: OssService;

  beforeEach(() => {
    send = jest.fn();
    presign.mockResolvedValue("https://s3.example/presigned");
    service = new OssService({ send }, configured());
  });

  const expectOss = async (
    fn: () => void | Promise<void>,
    status: number,
    errorCode: string,
  ) => {
    try {
      await fn();
      throw new Error("expected throw");
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(status);
      const body = (error as HttpException).getResponse() as {
        errorCode?: string;
      };
      expect(body.errorCode).toBe(errorCode);
    }
  };

  it("returns 503 when OSS is not configured", async () => {
    const unconfigured = new OssService(
      null,
      configured({ configured: false, bucket: "" }),
    );
    await expectOss(
      () => void unconfigured.getPublicConfig(),
      HttpStatus.SERVICE_UNAVAILABLE,
      "1404",
    );
  });

  it("lists one level and drops the current-prefix placeholder", async () => {
    send.mockResolvedValue({
      CommonPrefixes: [{ Prefix: "docs/a/" }],
      Contents: [
        { Key: "docs/", Size: 0, LastModified: new Date("2026-01-01") },
        {
          Key: "docs/readme.txt",
          Size: 12,
          LastModified: new Date("2026-01-02"),
          ContentType: "text/plain",
        },
        { Key: "docs/skip/", Size: 0 },
      ],
      IsTruncated: false,
    });

    const result = await service.listObjects({ prefix: "docs" });
    expect(result.prefix).toBe("docs/");
    expect(result.folders).toEqual([{ prefix: "docs/a/", name: "a" }]);
    expect(result.files.map((file) => file.key)).toEqual(["docs/readme.txt"]);
    expect(result.truncated).toBe(false);
    expect(send.mock.calls[0][0]).toBeInstanceOf(ListObjectsV2Command);
    expect(send.mock.calls[0][0].input).toMatchObject({
      Prefix: "docs/",
      Delimiter: "/",
      MaxKeys: 1000,
    });
  });

  it("creates a folder placeholder and rejects existing names", async () => {
    send.mockImplementation((command: HeadObjectCommand | PutObjectCommand) => {
      if (command instanceof HeadObjectCommand) {
        const error = Object.assign(new Error("not found"), {
          name: "NotFound",
          $metadata: { httpStatusCode: 404 },
        });
        throw error;
      }
      return {};
    });
    await service.createFolder({ prefix: "docs", name: "photos" });
    const put = send.mock.calls.find(
      (call) => call[0] instanceof PutObjectCommand,
    )?.[0] as PutObjectCommand;
    expect(put.input).toMatchObject({ Key: "docs/photos/", Bucket: "bucket" });

    send.mockImplementation((command: HeadObjectCommand) => {
      if (
        command instanceof HeadObjectCommand &&
        command.input.Key === "docs/photos/"
      ) {
        return { ContentLength: 0 };
      }
      const error = Object.assign(new Error("not found"), {
        name: "NotFound",
        $metadata: { httpStatusCode: 404 },
      });
      throw error;
    });
    await expectOss(
      () => void service.createFolder({ prefix: "docs", name: "photos" }),
      HttpStatus.CONFLICT,
      "1401",
    );
  });

  it("rejects simple PUT when the object already exists and overwrite is false", async () => {
    send.mockResolvedValue({ ContentLength: 10 });
    await expectOss(
      () =>
        void service.presignPut({
          prefix: "",
          filename: "a.txt",
          contentType: "text/plain",
          size: 4,
          overwrite: false,
        }),
      HttpStatus.CONFLICT,
      "1401",
    );
  });

  it("issues a PUT presign when overwrite is true for an existing file", async () => {
    send.mockImplementation((command: HeadObjectCommand) => {
      if (command.input.Key === "a.txt") return { ContentLength: 10 };
      const error = Object.assign(new Error("not found"), {
        name: "NotFound",
        $metadata: { httpStatusCode: 404 },
      });
      throw error;
    });
    const result = await service.presignPut({
      prefix: "",
      filename: "a.txt",
      contentType: "text/plain",
      size: 4,
      overwrite: true,
    });
    expect(result.url).toBe("https://s3.example/presigned");
    expect(result.method).toBe("PUT");
    expect(result.key).toBe("a.txt");
  });

  it("rejects delete when expanded keys exceed the batch cap", async () => {
    send.mockResolvedValue({
      Contents: [
        { Key: "docs/a" },
        { Key: "docs/b" },
        { Key: "docs/c" },
        { Key: "docs/d" },
      ],
      IsTruncated: false,
    });
    await expectOss(
      () =>
        void service.deleteObjects({
          keys: [{ key: "docs/", isFolder: true }],
        }),
      HttpStatus.BAD_REQUEST,
      "1403",
    );
  });

  it("rejects moving a folder into its own descendant path", async () => {
    await expectOss(
      () =>
        void service.copyObjects({
          sources: [{ key: "docs/", isFolder: true }],
          destinationPrefix: "docs/nested/",
        }),
      HttpStatus.BAD_REQUEST,
      "1405",
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("copies then deletes a single file", async () => {
    send.mockImplementation(
      (
        command: HeadObjectCommand | CopyObjectCommand | DeleteObjectCommand,
      ) => {
        if (command instanceof HeadObjectCommand) {
          const error = Object.assign(new Error("not found"), {
            name: "NotFound",
            $metadata: { httpStatusCode: 404 },
          });
          throw error;
        }
        return {};
      },
    );
    await service.copyObjects({
      sources: [{ key: "a.txt", isFolder: false }],
      destinationPrefix: "docs/",
      destinationName: "b.txt",
    });
    expect(
      send.mock.calls.some((call) => call[0] instanceof CopyObjectCommand),
    ).toBe(true);
    expect(
      send.mock.calls.some((call) => call[0] instanceof DeleteObjectCommand),
    ).toBe(true);
  });

  it("creates a multipart upload", async () => {
    send.mockImplementation(
      (command: HeadObjectCommand | CreateMultipartUploadCommand) => {
        if (command instanceof HeadObjectCommand) {
          const error = Object.assign(new Error("not found"), {
            name: "NotFound",
            $metadata: { httpStatusCode: 404 },
          });
          throw error;
        }
        return { UploadId: "up-1" };
      },
    );
    const result = await service.initiateMultipart({
      prefix: "",
      filename: "big.bin",
      contentType: "application/octet-stream",
      size: 20 * 1024 * 1024,
    });
    expect(result.uploadId).toBe("up-1");
    expect(result.key).toBe("big.bin");
    expect(result.partSize).toBe(8 * 1024 * 1024);
    expect(result.partCount).toBe(3);
  });
});
