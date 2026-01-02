// Google Drive Service - Updated: 2026-01-02
// Added modifiedTime to file listing for sorting
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { DriveFile } from './interfaces/drive-file.interface';

@Injectable()
export class GoogleDriveService {
    private readonly logger = new Logger(GoogleDriveService.name);
    private readonly apiKey: string;
    private readonly baseUrl = 'https://www.googleapis.com/drive/v3';

    constructor(private readonly configService: ConfigService) {
        this.apiKey = this.configService.get<string>('GOOGLE_API_KEY') || '';
        if (!this.apiKey) {
            this.logger.warn('GOOGLE_API_KEY is not configured');
        }
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

        const query = `'${extractedId}' in parents and mimeType contains 'image/' and trashed = false`;
        // Added modifiedTime for sorting
        const fields = 'files(id,name,mimeType,thumbnailLink,webContentLink,modifiedTime,createdTime)';

        const url = `${this.baseUrl}/files?q=${encodeURIComponent(query)}&fields=${fields}&key=${this.apiKey}&pageSize=1000&orderBy=modifiedTime desc`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                const error = await response.json();
                this.logger.error(`Google Drive API error: ${JSON.stringify(error)}`);
                throw new Error(error.error?.message || 'Failed to list files');
            }

            const data = await response.json();
            return data.files || [];
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
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to get file metadata');
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
    async getFileStream(fileId: string): Promise<{
        stream: Readable;
        mimeType: string;
        fileName: string;
    }> {
        const metadata = await this.getFileMetadata(fileId);
        const url = `${this.baseUrl}/files/${fileId}?alt=media&key=${this.apiKey}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new NotFoundException(`File with ID "${fileId}" not found`);
                }
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to download file');
            }

            const webStream = response.body;
            if (!webStream) {
                throw new Error('No response body');
            }

            const reader = webStream.getReader();
            const nodeStream = new Readable({
                async read() {
                    const { done, value } = await reader.read();
                    if (done) {
                        this.push(null);
                    } else {
                        this.push(Buffer.from(value));
                    }
                },
            });

            return {
                stream: nodeStream,
                mimeType: metadata.mimeType,
                fileName: metadata.name,
            };
        } catch (error) {
            this.logger.error(`Error downloading file: ${error}`);
            throw error;
        }
    }

    getThumbnailUrl(fileId: string): string {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    }

    getDirectUrl(fileId: string): string {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }

    getProxyUrl(fileId: string, baseUrl: string): string {
        return `${baseUrl}/drive/proxy?fileId=${fileId}`;
    }

    /**
     * Get folder name from Google Drive
     */
    async getFolderName(folderId: string): Promise<string | null> {
        const extractedId = this.extractFolderId(folderId);
        const url = `${this.baseUrl}/files/${extractedId}?fields=name&key=${this.apiKey}`;

        try {
            const response = await fetch(url);
            if (!response.ok) {
                this.logger.warn(`Could not get folder name for ${extractedId}`);
                return null;
            }

            const data = await response.json();
            return data.name || null;
        } catch (error) {
            this.logger.error(`Error getting folder name: ${error}`);
            return null;
        }
    }
}
