import { ErrorEnum } from '@/processor/constants/error-code.js';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  type CreateMultipartUploadCommandOutput,
  type DeleteObjectsCommandOutput,
  type GetObjectCommandOutput,
  type ListObjectsV2CommandOutput,
  type ListPartsCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  HttpException,
  Inject,
  Injectable,
  StreamableFile,
} from '@nestjs/common';
import { createRequire } from 'node:module';
import { PassThrough, type Readable } from 'stream';
import {
  folderNameFromPrefix,
  isDescendantPrefix,
  isFolderKey,
  joinFolderKey,
  joinObjectKey,
  normalizePrefix,
} from './oss-key.js';
import type {
  AbortMultipartDto,
  ArchiveQueryDto,
  CompleteMultipartDto,
  CopyObjectsDto,
  CreateFolderDto,
  DeleteObjectsDto,
  InitiateMultipartDto,
  ListObjectsQueryDto,
  MultipartPartsQueryDto,
  PresignGetQueryDto,
  PresignPartQueryDto,
  PresignPutDto,
} from './oss.dto.js';
import { throwOssError } from './oss.exception.js';
import {
  isS3NotFound,
  OSS_S3_CLIENT,
  OSS_S3_CONFIG,
  type OssS3RuntimeConfig,
} from './oss.s3.js';

export interface OssFolderItem {
  prefix: string;
  name: string;
}

export interface OssFileItem {
  key: string;
  name: string;
  size: number;
  lastModified: string;
  contentType?: string;
}

@Injectable()
export class OssService {
  constructor(
    @Inject(OSS_S3_CLIENT) private readonly s3: S3Client | null,
    @Inject(OSS_S3_CONFIG) private readonly config: OssS3RuntimeConfig,
  ) {}

  getPublicConfig() {
    this.ensureClient();
    return {
      putSimpleMaxBytes: this.config.putSimpleMaxBytes,
      multipartPartBytes: this.config.multipartPartBytes,
      presignGetExpiresSec: this.config.presignGetExpiresSec,
      maxBatchKeys: this.config.maxBatchKeys,
    };
  }

  async listObjects(query: ListObjectsQueryDto) {
    const client = this.ensureClient();
    const prefix = normalizePrefix(query.prefix);
    const result = await this.send<ListObjectsV2CommandOutput>(
      client,
      new ListObjectsV2Command({
        Bucket: this.config.bucket,
        Prefix: prefix,
        Delimiter: '/',
        MaxKeys: 1000,
        ContinuationToken: query.continuationToken || undefined,
      }),
    );

    const folders: OssFolderItem[] = (result.CommonPrefixes ?? [])
      .map((item) => item.Prefix)
      .filter((value): value is string => Boolean(value))
      .map((folderPrefix) => ({
        prefix: folderPrefix,
        name: folderNameFromPrefix(folderPrefix),
      }));

    const files: OssFileItem[] = (result.Contents ?? [])
      .filter(
        (item) => item.Key && item.Key !== prefix && !item.Key.endsWith('/'),
      )
      .map((item) => ({
        key: item.Key as string,
        name: (item.Key as string).slice(prefix.length),
        size: item.Size ?? 0,
        lastModified: item.LastModified ? item.LastModified.toISOString() : '',
      }));

    return {
      prefix,
      folders,
      files,
      nextContinuationToken: result.NextContinuationToken ?? null,
      truncated: Boolean(result.IsTruncated),
    };
  }

  async presignGet(query: PresignGetQueryDto) {
    const client = this.ensureClient();
    const key = query.key;
    if (isFolderKey(key)) {
      throwOssError(ErrorEnum.OSS_INVALID_KEY);
    }
    if (!(await this.exists(client, key))) {
      throwOssError(ErrorEnum.OSS_NOT_FOUND);
    }
    const filename = key.split('/').filter(Boolean).pop() || 'download';
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ResponseContentDisposition:
        query.disposition === 'attachment'
          ? this.contentDisposition(filename, 'attachment')
          : undefined,
    });
    const url = await getSignedUrl(client, command, {
      expiresIn: this.config.presignGetExpiresSec,
    });
    return { url, expiresIn: this.config.presignGetExpiresSec, key };
  }

  async createFolder(dto: CreateFolderDto) {
    const client = this.ensureClient();
    const key = joinFolderKey(dto.prefix, dto.name);
    const fileKey = key.slice(0, -1);
    if (
      (await this.exists(client, key)) ||
      (await this.exists(client, fileKey))
    ) {
      throwOssError(ErrorEnum.OSS_FILE_OR_DIR_EXIST);
    }
    await this.send(
      client,
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: Buffer.alloc(0),
        ContentType: 'application/x-directory',
      }),
    );
    return { key };
  }

  async presignPut(dto: PresignPutDto) {
    const client = this.ensureClient();
    if (dto.size >= this.config.putSimpleMaxBytes) {
      throw new BadRequestException('文件过大，请使用分片上传');
    }
    const key = joinObjectKey(dto.prefix, dto.filename);
    await this.assertWritableFile(client, key, dto.overwrite);
    const contentType = dto.contentType || 'application/octet-stream';
    const command = new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: contentType,
    });
    const url = await getSignedUrl(client, command, {
      expiresIn: this.config.presignPutExpiresSec,
    });
    return {
      url,
      method: 'PUT' as const,
      headers: { 'Content-Type': contentType },
      key,
      expiresIn: this.config.presignPutExpiresSec,
    };
  }

  async initiateMultipart(dto: InitiateMultipartDto) {
    const client = this.ensureClient();
    const key = joinObjectKey(dto.prefix, dto.filename);
    await this.assertWritableFile(client, key, dto.overwrite);
    const contentType = dto.contentType || 'application/octet-stream';
    const created = await this.send<CreateMultipartUploadCommandOutput>(
      client,
      new CreateMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: key,
        ContentType: contentType,
      }),
    );
    if (!created.UploadId) {
      throwOssError(ErrorEnum.OSS_S3_FAILED);
    }
    const partSize = this.config.multipartPartBytes;
    const partCount = Math.max(1, Math.ceil(dto.size / partSize));
    return { uploadId: created.UploadId, key, partSize, partCount };
  }

  async listMultipartParts(query: MultipartPartsQueryDto) {
    const client = this.ensureClient();
    const listed = await this.send<ListPartsCommandOutput>(
      client,
      new ListPartsCommand({
        Bucket: this.config.bucket,
        Key: query.key,
        UploadId: query.uploadId,
      }),
    );
    return {
      list: (listed.Parts ?? []).map((part) => ({
        partNumber: part.PartNumber ?? 0,
        etag: (part.ETag || '').replaceAll('"', ''),
        size: part.Size ?? 0,
      })),
    };
  }

  async presignPart(query: PresignPartQueryDto) {
    const client = this.ensureClient();
    const command = new UploadPartCommand({
      Bucket: this.config.bucket,
      Key: query.key,
      UploadId: query.uploadId,
      PartNumber: query.partNumber,
    });
    const url = await getSignedUrl(client, command, {
      expiresIn: this.config.presignPutExpiresSec,
    });
    return { url };
  }

  async completeMultipart(dto: CompleteMultipartDto) {
    const client = this.ensureClient();
    await this.send(
      client,
      new CompleteMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: dto.key,
        UploadId: dto.uploadId,
        MultipartUpload: {
          Parts: dto.parts.map((part) => ({
            ETag: part.etag,
            PartNumber: part.partNumber,
          })),
        },
      }),
    );
    return { key: dto.key };
  }

  async abortMultipart(dto: AbortMultipartDto) {
    const client = this.ensureClient();
    await this.send(
      client,
      new AbortMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: dto.key,
        UploadId: dto.uploadId,
      }),
    );
    return { key: dto.key };
  }

  async copyObjects(dto: CopyObjectsDto) {
    const client = this.ensureClient();
    if (dto.destinationName && dto.sources.length !== 1) {
      throwOssError(ErrorEnum.OSS_INVALID_KEY);
    }
    const destinationPrefix = normalizePrefix(dto.destinationPrefix);
    const jobs = await this.expandCopyJobs(client, dto, destinationPrefix);
    if (jobs.length > this.config.maxBatchKeys) {
      throwOssError(ErrorEnum.OSS_EXCEE_MAXIMUM_QUANTITY);
    }
    if (jobs.some((job) => job.source === job.destination)) {
      throwOssError(ErrorEnum.OSS_NO_OPERATION_REQUIRED);
    }
    for (const job of jobs) {
      if (!dto.overwrite && (await this.exists(client, job.destination))) {
        throwOssError(ErrorEnum.OSS_FILE_OR_DIR_EXIST);
      }
    }
    for (const job of jobs) {
      await this.send(
        client,
        new CopyObjectCommand({
          Bucket: this.config.bucket,
          Key: job.destination,
          CopySource: this.copySource(job.source),
        }),
      );
    }
    for (const job of jobs) {
      await this.send(
        client,
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: job.source,
        }),
      );
    }
    return { count: jobs.length };
  }

  async deleteObjects(dto: DeleteObjectsDto) {
    const client = this.ensureClient();
    const keys = await this.expandDeleteKeys(client, dto.keys);
    if (keys.length > this.config.maxBatchKeys) {
      throwOssError(ErrorEnum.OSS_EXCEE_MAXIMUM_QUANTITY);
    }
    const deleted: string[] = [];
    const failed: string[] = [];
    for (let index = 0; index < keys.length; index += 1000) {
      const chunk = keys.slice(index, index + 1000);
      const result = await this.send<DeleteObjectsCommandOutput>(
        client,
        new DeleteObjectsCommand({
          Bucket: this.config.bucket,
          Delete: { Objects: chunk.map((key) => ({ Key: key })), Quiet: false },
        }),
      );
      deleted.push(
        ...(result.Deleted ?? [])
          .map((item) => item.Key)
          .filter((key): key is string => Boolean(key)),
      );
      failed.push(
        ...(result.Errors ?? [])
          .map((item) => item.Key)
          .filter((key): key is string => Boolean(key)),
      );
    }
    if (failed.length) {
      throwOssError(ErrorEnum.OSS_S3_FAILED, { failedKeys: failed });
    }
    return { count: deleted.length };
  }

  async archiveFolder(query: ArchiveQueryDto) {
    const client = this.ensureClient();
    const prefix = normalizePrefix(query.prefix);
    if (!prefix) {
      throwOssError(ErrorEnum.OSS_INVALID_KEY);
    }
    const keys = (await this.listAllKeys(client, prefix)).filter(
      (key) => !key.endsWith('/'),
    );
    if (keys.length > this.config.maxBatchKeys) {
      throwOssError(ErrorEnum.OSS_EXCEE_MAXIMUM_QUANTITY);
    }

    const requireArchiver = createRequire(__filename);
    const archiver = requireArchiver('archiver') as (
      format: string,
      opts?: { zlib?: { level: number } },
    ) => {
      pipe: (stream: PassThrough) => void;
      append: (source: Readable, data: { name: string }) => void;
      finalize: () => Promise<void>;
      destroy: (error?: Error) => void;
    };
    const zip = archiver('zip', { zlib: { level: 0 } });
    const pass = new PassThrough();
    zip.pipe(pass);
    const folderName = folderNameFromPrefix(prefix) || 'folder';

    void (async () => {
      try {
        for (const key of keys) {
          const object = await this.send<GetObjectCommandOutput>(
            client,
            new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
          );
          if (!object.Body) {
            continue;
          }
          zip.append(object.Body as Readable, {
            name: key.slice(prefix.length),
          });
        }
        await zip.finalize();
      } catch (error) {
        zip.destroy(error instanceof Error ? error : new Error(String(error)));
        pass.destroy(error instanceof Error ? error : new Error(String(error)));
      }
    })();

    return new StreamableFile(pass, {
      type: 'application/zip',
      disposition: this.contentDisposition(`${folderName}.zip`, 'attachment'),
    });
  }

  private async expandCopyJobs(
    client: S3Client,
    dto: CopyObjectsDto,
    destinationPrefix: string,
  ): Promise<{ source: string; destination: string }[]> {
    const jobs: { source: string; destination: string }[] = [];
    for (const source of dto.sources) {
      if (source.isFolder) {
        const sourcePrefix = normalizePrefix(source.key);
        if (isDescendantPrefix(sourcePrefix, destinationPrefix)) {
          throwOssError(ErrorEnum.OSS_INVALID_KEY);
        }
        const folderName =
          dto.destinationName || folderNameFromPrefix(sourcePrefix);
        const targetPrefix = joinFolderKey(destinationPrefix, folderName);
        const keys = await this.listAllKeys(client, sourcePrefix);
        for (const key of keys) {
          jobs.push({
            source: key,
            destination: targetPrefix + key.slice(sourcePrefix.length),
          });
        }
      } else {
        const basename =
          dto.destinationName || source.key.split('/').filter(Boolean).pop();
        jobs.push({
          source: source.key,
          destination: joinObjectKey(destinationPrefix, basename || 'file'),
        });
      }
    }
    return jobs;
  }

  private async expandDeleteKeys(
    client: S3Client,
    items: { key: string; isFolder: boolean }[],
  ): Promise<string[]> {
    const keys: string[] = [];
    for (const item of items) {
      if (item.isFolder) {
        keys.push(
          ...(await this.listAllKeys(client, normalizePrefix(item.key))),
        );
      } else {
        keys.push(item.key);
      }
    }
    return [...new Set(keys)];
  }

  private async listAllKeys(
    client: S3Client,
    prefix: string,
  ): Promise<string[]> {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const listed = await this.send<ListObjectsV2CommandOutput>(
        client,
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: prefix,
          ContinuationToken: token,
          MaxKeys: 1000,
        }),
      );
      for (const item of listed.Contents ?? []) {
        if (!item.Key) continue;
        keys.push(item.Key);
        if (keys.length > this.config.maxBatchKeys) {
          throwOssError(ErrorEnum.OSS_EXCEE_MAXIMUM_QUANTITY);
        }
      }
      token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (token);
    return keys;
  }

  private async assertWritableFile(
    client: S3Client,
    key: string,
    overwrite?: boolean,
  ) {
    if (await this.exists(client, `${key}/`)) {
      throwOssError(ErrorEnum.OSS_FILE_OR_DIR_EXIST);
    }
    const exists = await this.exists(client, key);
    if (exists && !overwrite) {
      throwOssError(ErrorEnum.OSS_FILE_OR_DIR_EXIST);
    }
  }

  private async exists(client: S3Client, key: string): Promise<boolean> {
    try {
      await this.send(
        client,
        new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }),
      );
      return true;
    } catch (error) {
      if (isS3NotFound(error)) {
        return false;
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throwOssError(ErrorEnum.OSS_S3_FAILED);
    }
  }

  private async send<T>(client: S3Client, command: any): Promise<T> {
    try {
      return (await client.send(command)) as T;
    } catch (error) {
      if (isS3NotFound(error)) {
        throw error;
      }
      if (error instanceof HttpException) {
        throw error;
      }
      throwOssError(ErrorEnum.OSS_S3_FAILED);
    }
  }

  private ensureClient(): S3Client {
    if (!this.config.configured || !this.s3) {
      throwOssError(ErrorEnum.OSS_NOT_CONFIGURED);
    }
    return this.s3;
  }

  private copySource(key: string): string {
    const encoded = encodeURIComponent(key).replaceAll('%2F', '/');
    return `${this.config.bucket}/${encoded}`;
  }

  private contentDisposition(
    filename: string,
    type: 'inline' | 'attachment',
  ): string {
    const encoded = encodeURIComponent(filename);
    const ascii = filename.replace(/[^\x20-\x7E]/g, '_');
    return `${type}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
  }
}
