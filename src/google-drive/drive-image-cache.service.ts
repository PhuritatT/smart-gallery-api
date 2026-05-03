import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { RedisService } from '../redis/redis.service';

interface CacheKeyInput {
  folderId: string;
  folderName?: string | null;
  fileId: string;
  fileName: string;
}

interface CachedImage {
  stream: Readable;
  mimeType?: string;
  fileName?: string;
}

interface SignedReadUrlOptions {
  fileName: string;
  mimeType: string;
  download?: boolean;
}

interface SignedReadUrl {
  url: string;
  expiresAt: Date;
}

// Shape stored in Redis (Date serialised as ISO string)
interface SignedReadUrlCached {
  url: string;
  expiresAt: string;
}

@Injectable()
export class DriveImageCacheService {
  private readonly logger = new Logger(DriveImageCacheService.name);
  private readonly client?: S3Client;
  private readonly bucketName?: string;
  private readonly signedUrlExpiresInSeconds = 300;
  private readonly signedUrlCacheSkewMs = 30000;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly redisService?: RedisService,
  ) {
    const endpoint = this.configService.get<string>('R2_ENDPOINT');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');
    const bucketName = this.configService.get<string>('R2_BUCKET_NAME');

    if (endpoint && accessKeyId && secretAccessKey && bucketName) {
      this.bucketName = bucketName;
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
  }

  isEnabled(): boolean {
    return Boolean(this.client && this.bucketName);
  }

  getCacheKey(input: CacheKeyInput): string {
    const folderName = this.sanitizePathSegment(input.folderName || 'folder', 'folder');
    const folderId = this.sanitizePathSegment(input.folderId, 'folder-id');
    const fileId = this.sanitizePathSegment(input.fileId, 'file-id');
    const fileName = this.sanitizePathSegment(input.fileName, 'image');

    return `images-cache/${folderName}-${folderId}/${fileId}-${fileName}`;
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client || !this.bucketName) return false;

    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      return true;
    } catch (error) {
      if (!this.isNotFound(error)) {
        this.logger.warn(`R2 cache head failed for key ${key}`);
      }
      return false;
    }
  }

  async getCachedImage(key: string): Promise<CachedImage | null> {
    if (!this.client || !this.bucketName) return null;

    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      if (!result.Body) return null;

      return {
        stream: this.toReadable(result.Body),
        mimeType: result.ContentType,
        fileName: result.Metadata?.filename,
      };
    } catch (error) {
      if (!this.isNotFound(error)) {
        this.logger.warn(`R2 cache read failed for key ${key}`);
      }
      return null;
    }
  }

  async getSignedReadUrl(
    key: string,
    options: SignedReadUrlOptions,
  ): Promise<SignedReadUrl> {
    if (!this.client || !this.bucketName) {
      throw new Error('R2 cache is not configured');
    }

    const dispositionType = options.download ? 'attachment' : 'inline';
    const sanitizedFileName = this.sanitizeContentDispositionFileName(options.fileName);
    const disposition = `${dispositionType}; filename="${sanitizedFileName}"; filename*=UTF-8''${encodeURIComponent(sanitizedFileName)}`;
    const redisCacheKey = `r2:signed:${[key, options.mimeType, disposition].join('|')}`;

    // Try Redis cache first
    if (this.redisService?.isEnabled()) {
      const cached = await this.redisService.get<SignedReadUrlCached>(redisCacheKey);
      if (cached) {
        const expiresAt = new Date(cached.expiresAt);
        if (expiresAt.getTime() - this.signedUrlCacheSkewMs > Date.now()) {
          return { url: cached.url, expiresAt };
        }
      }
    }

    const now = Date.now();
    const expiresAt = new Date(now + this.signedUrlExpiresInSeconds * 1000);
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ResponseContentType: options.mimeType,
      ResponseContentDisposition: disposition,
      ResponseCacheControl: 'public, max-age=86400',
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: this.signedUrlExpiresInSeconds,
    });
    const signedUrl: SignedReadUrl = { url, expiresAt };

    // Store in Redis — TTL slightly less than presign expiry
    if (this.redisService?.isEnabled()) {
      await this.redisService.set(
        redisCacheKey,
        { url, expiresAt: expiresAt.toISOString() } satisfies SignedReadUrlCached,
        this.signedUrlExpiresInSeconds - 30,
      );
    }

    return signedUrl;
  }

  async uploadStream(
    key: string,
    stream: Readable,
    mimeType: string,
    fileName: string,
  ): Promise<void> {
    if (!this.client || !this.bucketName) return;

    await new Upload({
      client: this.client,
      params: {
        Bucket: this.bucketName,
        Key: key,
        Body: stream,
        ContentType: mimeType,
        Metadata: {
          filename: this.sanitizeMetadataValue(fileName),
        },
      },
    }).done();
  }

  private sanitizePathSegment(value: string, fallback: string): string {
    const cleaned = value
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[\r\n"]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 120);

    return cleaned || fallback;
  }

  private sanitizeMetadataValue(value: string): string {
    return (
      value
        .replace(/[\r\n"]/g, '')
        .replace(/[^\x20-\x7E]/g, '')
        .trim()
        .slice(0, 180) || 'download'
    );
  }

  private sanitizeContentDispositionFileName(value: string): string {
    return value.replace(/[\r\n"]/g, '').trim() || 'download';
  }

  private toReadable(body: GetObjectCommandOutput['Body']): Readable {
    if (body instanceof Readable) {
      return body;
    }

    const maybeWebBody = body as {
      transformToWebStream?: () => ReadableStream<Uint8Array>;
      stream?: () => ReadableStream<Uint8Array>;
    };

    if (maybeWebBody.transformToWebStream) {
      return Readable.fromWeb(
        maybeWebBody.transformToWebStream() as Parameters<typeof Readable.fromWeb>[0],
      );
    }

    if (maybeWebBody.stream) {
      return Readable.fromWeb(
        maybeWebBody.stream() as Parameters<typeof Readable.fromWeb>[0],
      );
    }

    throw new Error('Unsupported R2 response body');
  }

  private isNotFound(error: unknown): boolean {
    const candidate = error as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };

    return (
      candidate.name === 'NotFound' ||
      candidate.name === 'NoSuchKey' ||
      candidate.$metadata?.httpStatusCode === 404
    );
  }
}
