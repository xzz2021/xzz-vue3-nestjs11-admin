import { S3Client } from "@aws-sdk/client-s3";

const MIN_MULTIPART_PART_BYTES = 5 * 1024 * 1024;

export const OSS_S3_CLIENT = "OSS_S3_CLIENT";
export const OSS_S3_CONFIG = "OSS_S3_CONFIG";

export interface OssS3RuntimeConfig {
  configured: boolean;
  bucket: string;
  region: string;
  endpoint: string;
  accessKey: string;
  secretKey: string;
  forcePathStyle: boolean;
  putSimpleMaxBytes: number;
  multipartPartBytes: number;
  presignGetExpiresSec: number;
  presignPutExpiresSec: number;
  maxBatchKeys: number;
}

const parsePositiveInt = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (
  value: string | undefined,
  fallback: boolean,
): boolean => {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
};

export function loadOssS3Config(
  env: NodeJS.Dict<string> = process.env,
): OssS3RuntimeConfig {
  const endpoint = env.OSS_S3_ENDPOINT?.trim() || "";
  const accessKey = env.OSS_S3_ACCESS_KEY?.trim() || "";
  const secretKey = env.OSS_S3_SECRET_KEY?.trim() || "";
  const bucket = env.OSS_S3_BUCKET?.trim() || "";
  const multipartPartBytes = Math.max(
    MIN_MULTIPART_PART_BYTES,
    parsePositiveInt(env.OSS_MULTIPART_PART_BYTES, 8 * 1024 * 1024),
  );
  return {
    configured: Boolean(endpoint && accessKey && secretKey && bucket),
    bucket,
    region: env.OSS_S3_REGION?.trim() || "us-east-1",
    endpoint,
    accessKey,
    secretKey,
    forcePathStyle: parseBoolean(env.OSS_S3_FORCE_PATH_STYLE, true),
    putSimpleMaxBytes: parsePositiveInt(
      env.OSS_PUT_SIMPLE_MAX_BYTES,
      16 * 1024 * 1024,
    ),
    multipartPartBytes,
    presignGetExpiresSec: parsePositiveInt(
      env.OSS_PRESIGN_GET_EXPIRES_SEC,
      3600,
    ),
    presignPutExpiresSec: parsePositiveInt(
      env.OSS_PRESIGN_PUT_EXPIRES_SEC,
      900,
    ),
    maxBatchKeys: parsePositiveInt(env.OSS_MAX_BATCH_KEYS, 1000),
  };
}

export function createOssS3Client(config: OssS3RuntimeConfig): S3Client | null {
  if (!config.configured) {
    return null;
  }
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  });
}

export function isS3NotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const candidate = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    candidate.name === "NotFound" ||
    candidate.name === "NoSuchKey" ||
    candidate.Code === "NoSuchKey" ||
    candidate.Code === "NotFound" ||
    candidate.$metadata?.httpStatusCode === 404
  );
}
