import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { DriveFile } from './interfaces/drive-file.interface';
export declare class GoogleDriveService {
    private readonly configService;
    private readonly logger;
    private readonly apiKey;
    private readonly baseUrl;
    constructor(configService: ConfigService);
    extractFolderId(urlOrId: string): string;
    listFiles(folderId: string): Promise<DriveFile[]>;
    getFileMetadata(fileId: string): Promise<DriveFile>;
    getFileStream(fileId: string): Promise<{
        stream: Readable;
        mimeType: string;
        fileName: string;
    }>;
    getThumbnailUrl(fileId: string): string;
    getDirectUrl(fileId: string): string;
    getProxyUrl(fileId: string, baseUrl: string): string;
    getFolderName(folderId: string): Promise<string | null>;
}
