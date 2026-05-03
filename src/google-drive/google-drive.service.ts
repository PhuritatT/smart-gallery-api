// Google Drive Service - Updated: 2026-01-02
// Added modifiedTime to file listing for sorting
import { Injectable, NotFoundException, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassThrough, Readable } from 'stream';
import { DriveFile } from './interfaces/drive-file.interface';
import { DriveImageCacheService } from './drive-image-cache.service';
import { RedisService } from '../redis/redis.service';

export interface DriveFileStreamContext {
    folderId?: string;
    folderName?: string;
    fileName?: string;
    mimeType?: string;
}

export interface DriveFileUrlOptions {
    baseUrl: string;
    download?: boolean;
}

export interface DriveFileUrlResult {
    url: string;
    source: 'r2' | 'proxy';
    expiresAt?: string;
}

@Injectable()
export class GoogleDriveService {
    private readonly logger = new Logger(GoogleDriveService.name);
    private readonly apiKey: string;
    private readonly baseUrl = 'https://www.googleapis.com/drive/v3';
    private readonly folderNameCache = new Map<string, string | null>();
    private readonly prewarmInFlight = new Set<string>();
    private readonly fileListCacheTtlSeconds = 300; // 5 minutes

    constructor(
        private readonly configService: ConfigService,
        @Optional() private readonly imageCacheService?: DriveImageCacheService,
        @Optional() private readonly redisService?: RedisService,
    ) {
        this.apiKey = this.configService.get<string>('GOOGLE_API_KEY') || '';
        if (!this.apiKey) {
            this.logger.warn('GOOGLE_API_KEY is not configured');
        }
    }

    private async readDriveError(response: Response, fallbackMessage: string): Promise<string> {
        const statusLabel = [response.status, response.statusText].filter(Boolean).join(' ');
        let responseBody = '';

        try {
            responseBody = await response.text();
        } catch {
            responseBody = '';
        }

        if (responseBody) {
            try {
                const error = JSON.parse(responseBody);
                const message = error.error?.message || error.message;
                if (message) {
                    return `${fallbackMessage} (${statusLabel}): ${message}`;
                }
            } catch {
                const preview = responseBody.replace(/\s+/g, ' ').trim().slice(0, 200);
                if (preview) {
                    return `${fallbackMessage} (${statusLabel}): ${preview}`;
                }
            }
        }

        return `${fallbackMessage} (${statusLabel})`;
    }

    private createNodeStream(webStream: ReadableStream<Uint8Array> | null): Readable {
        if (!webStream) {
            throw new Error('No response body');
        }

        const reader = webStream.getReader();
        return new Readable({
            async read() {
                const { done, value } = await reader.read();
                if (done) {
                    this.push(null);
                } else {
                    this.push(Buffer.from(value));
                }
            },
        });
    }

    private isHtmlResponse(response: Response): boolean {
        const contentType = response.headers.get('content-type') || '';
        return contentType.toLowerCase().includes('text/html');
    }

    private async getDirectDownloadStream(
        fileId: string,
        apiErrorMessage: string,
    ): Promise<Readable> {
        const directResponse = await fetch(this.getDirectUrl(fileId));

        if (!directResponse.ok || this.isHtmlResponse(directResponse)) {
            const directError = await this.readDriveError(
                directResponse,
                'Direct Google Drive download failed',
            );
            throw new Error(`${apiErrorMessage}; ${directError}`);
        }

        return this.createNodeStream(directResponse.body);
    }

    /**
     * Extract folder ID from Google Drive URL or return as-is if already an ID
     */
    extractFolderId(urlOrId: string): string {
        if (/^[a-zA-Z0-9_-]+$/.test(urlOrId) && urlOrId.length > 20) {
            return urlOrId;
        }
        const folderMatch = urlOrId.match(/folders\/([a-zA-Z0-9_-]+)/);
        if (folderMatch) {
            return folderMatch[1];
        }
        const openMatch = urlOrId.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (openMatch) {
            return openMatch[1];
        }
        return urlOrId;
    }

    /**
     * List all image files in a Google Drive folder with metadata for sorting
     */
    async listFiles(folderId: string): Promise<DriveFile[]> {
        const extractedId = this.extractFolderId(folderId);
        const redisKey = `drive:files:${extractedId}`;

        if (this.redisService?.isEnabled()) {
            const cached = await this.redisService.get<DriveFile[]>(redisKey);
            if (cached) {
                this.startFolderPrewarm(extractedId, cached);
                return cached;
            }
        }

        const query = `'${extractedId}' in parents and mimeType contains 'image/' and trashed = false`;
        const fields = 'files(id,name,mimeType,thumbnailLink,webContentLink,modifiedTime,createdTime)';
        const url = `${this.baseUrl}/files?q=${encodeURIComponent(query)}&fields=${fields}&key=${this.apiKey}&pageSize=1000&orderBy=modifiedTime desc`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const message = await this.readDriveError(response, 'Failed to list files');
                this.logger.error(`Google Drive API error: ${message}`);
                throw new Error(message);
            }

            const data = await response.json();
            const files: DriveFile[] = data.files || [];

            if (this.redisService?.isEnabled()) {
                await this.redisService.set(redisKey, files, this.fileListCacheTtlSeconds);
            }

            this.startFolderPrewarm(extractedId, files);
            return files;
        } catch (error) {
            this.logger.error(`Error listing files: ${error}`);
            throw error;
        }
    }

    /**
     * Get file metadata
     */
    async getFileMetadata(fileId: string): Promise<DriveFile> {
        const fields = 'id,name,mimeType,thumbnailLink,webContentLink,modifiedTime,createdTime';
        const url = `${this.baseUrl}/files/${fileId}?fields=${fields}&key=${this.apiKey}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new NotFoundException(`File with ID "${fileId}" not found`);
                }
                throw new Error(await this.readDriveError(response, 'Failed to get file metadata'));
            }

            return response.json();
        } catch (error) {
            this.logger.error(`Error getting file metadata: ${error}`);
            throw error;
        }
    }

    /**
     * Get file content as stream (for proxy to bypass CORS)
     */
    async getFileStream(fileId: string, context: DriveFileStreamContext = {}): Promise<{
        stream: Readable;
        mimeType: string;
        fileName: string;
    }> {
        try {
            const metadata = await this.resolveMetadata(fileId, context);
            const cacheKey = await this.getCacheKey(fileId, metadata, context);

            if (cacheKey && this.imageCacheService?.isEnabled()) {
                const cachedImage = await this.imageCacheService.getCachedImage(cacheKey);
                if (cachedImage) {
                    return {
                        stream: cachedImage.stream,
                        mimeType: cachedImage.mimeType || metadata.mimeType,
                        fileName: cachedImage.fileName || metadata.name,
                    };
                }

                const stream = await this.getGoogleMediaStream(fileId);
                return {
                    stream: this.uploadWhileStreaming(stream, cacheKey, metadata.mimeType, metadata.name),
                    mimeType: metadata.mimeType,
                    fileName: metadata.name,
                };
            }

            return {
                stream: await this.getGoogleMediaStream(fileId),
                mimeType: metadata.mimeType,
                fileName: metadata.name,
            };
        } catch (error) {
            this.logger.error(`Error downloading file: ${error}`);
            throw error;
        }
    }

    async getCachedFileUrl(
        fileId: string,
        context: DriveFileStreamContext,
        options: DriveFileUrlOptions,
    ): Promise<DriveFileUrlResult> {
        const metadata = await this.resolveMetadata(fileId, context);
        const cacheKey = await this.getCacheKey(fileId, metadata, context);

        if (cacheKey && this.imageCacheService?.isEnabled()) {
            try {
                if (await this.imageCacheService.exists(cacheKey)) {
                    const signedUrl = await this.imageCacheService.getSignedReadUrl(cacheKey, {
                        fileName: metadata.name,
                        mimeType: metadata.mimeType,
                        download: options.download,
                    });

                    return {
                        url: signedUrl.url,
                        source: 'r2',
                        expiresAt: signedUrl.expiresAt.toISOString(),
                    };
                }
            } catch (error) {
                this.logger.warn(`R2 signed URL failed for file ${fileId}: ${error}`);
            }
        }

        return {
            url: this.getProxyUrl(fileId, options.baseUrl, context, options.download),
            source: 'proxy',
        };
    }

    getThumbnailUrl(fileId: string): string {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    }

    getDirectUrl(fileId: string): string {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }

    getProxyUrl(
        fileId: string,
        baseUrl: string,
        context: DriveFileStreamContext = {},
        download?: boolean,
    ): string {
        const params = new URLSearchParams({ fileId });

        if (download) params.set('download', '1');
        if (context.folderId) params.set('folderId', context.folderId);
        if (context.folderName) params.set('folderName', context.folderName);
        if (context.fileName) params.set('fileName', context.fileName);
        if (context.mimeType) params.set('mimeType', context.mimeType);

        return `${baseUrl}/drive/proxy?${params.toString()}`;
    }

    /**
     * Get folder name from Google Drive
     */
    async getFolderName(folderId: string): Promise<string | null> {
        const extractedId = this.extractFolderId(folderId);
        if (this.folderNameCache.has(extractedId)) {
            return this.folderNameCache.get(extractedId) || null;
        }

        const url = `${this.baseUrl}/files/${extractedId}?fields=name&key=${this.apiKey}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                this.logger.warn(`Could not get folder name for ${extractedId}`);
                this.folderNameCache.set(extractedId, null);
                return null;
            }

            const data = await response.json();
            this.folderNameCache.set(extractedId, data.name || null);
            return data.name || null;
        } catch (error) {
            this.logger.error(`Error getting folder name: ${error}`);
            this.folderNameCache.set(extractedId, null);
            return null;
        }
    }

    private async resolveMetadata(
        fileId: string,
        context: DriveFileStreamContext,
    ): Promise<DriveFile> {
        if (context.fileName && context.mimeType) {
            return {
                id: fileId,
                name: context.fileName,
                mimeType: context.mimeType,
            };
        }

        return this.getFileMetadata(fileId);
    }

    private async getCacheKey(
        fileId: string,
        metadata: DriveFile,
        context: DriveFileStreamContext,
    ): Promise<string | null> {
        if (!this.imageCacheService?.isEnabled() || !context.folderId) {
            return null;
        }

        const folderName =
            context.folderName || (await this.getFolderName(context.folderId)) || context.folderId;

        return this.imageCacheService.getCacheKey({
            folderId: context.folderId,
            folderName,
            fileId,
            fileName: metadata.name,
        });
    }

    private async getGoogleMediaStream(fileId: string): Promise<Readable> {
        const url = `${this.baseUrl}/files/${fileId}?alt=media&key=${this.apiKey}`;
        const response = await fetch(url);

        if (!response.ok || this.isHtmlResponse(response)) {
            if (response.status === 404) {
                throw new NotFoundException(`File with ID "${fileId}" not found`);
            }
            const apiErrorMessage = await this.readDriveError(
                response,
                'Google Drive download failed',
            );
            this.logger.warn(`${apiErrorMessage}; trying direct Google Drive download fallback`);
            return this.getDirectDownloadStream(fileId, apiErrorMessage);
        }

        return this.createNodeStream(response.body);
    }

    private uploadWhileStreaming(
        source: Readable,
        cacheKey: string,
        mimeType: string,
        fileName: string,
    ): Readable {
        const responseStream = new PassThrough();
        const cacheStream = new PassThrough();

        source.on('error', (error) => {
            responseStream.destroy(error);
            cacheStream.destroy(error);
        });

        source.pipe(responseStream);
        source.pipe(cacheStream);

        void this.imageCacheService?.uploadStream(cacheKey, cacheStream, mimeType, fileName).catch(() => {
            this.logger.warn(`R2 cache upload failed for key ${cacheKey}`);
        });

        return responseStream;
    }

    private startFolderPrewarm(folderId: string, files: DriveFile[]): void {
        if (!this.imageCacheService?.isEnabled()) return;
        if (this.prewarmInFlight.has(folderId)) return;

        this.prewarmInFlight.add(folderId);
        void this.prewarmFolderCache(folderId, files)
            .catch((error) => {
                this.logger.warn(`R2 folder prewarm failed for folder ${folderId}: ${error}`);
            })
            .finally(() => {
                this.prewarmInFlight.delete(folderId);
            });
    }

    private async prewarmFolderCache(folderId: string, files: DriveFile[]): Promise<void> {
        const imageFiles = files.filter((file) => file.mimeType?.startsWith('image/'));
        if (imageFiles.length === 0 || !this.imageCacheService?.isEnabled()) return;

        const folderName = (await this.getFolderName(folderId)) || folderId;
        let nextIndex = 0;
        const workerCount = Math.min(2, imageFiles.length);

        await Promise.all(
            Array.from({ length: workerCount }, async () => {
                while (nextIndex < imageFiles.length) {
                    const file = imageFiles[nextIndex++];
                    await this.prewarmFileCache(folderId, folderName, file);
                }
            }),
        );
    }

    private async prewarmFileCache(
        folderId: string,
        folderName: string,
        file: DriveFile,
    ): Promise<void> {
        if (!this.imageCacheService?.isEnabled()) return;

        const cacheKey = this.imageCacheService.getCacheKey({
            folderId,
            folderName,
            fileId: file.id,
            fileName: file.name,
        });

        if (await this.imageCacheService.exists(cacheKey)) return;

        try {
            const stream = await this.getGoogleMediaStream(file.id);
            await this.imageCacheService.uploadStream(cacheKey, stream, file.mimeType, file.name);
        } catch (error) {
            this.logger.warn(`R2 prewarm skipped file ${file.id}: ${error}`);
        }
    }
}
