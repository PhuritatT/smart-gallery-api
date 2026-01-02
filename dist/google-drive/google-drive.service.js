"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var GoogleDriveService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDriveService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const stream_1 = require("stream");
let GoogleDriveService = GoogleDriveService_1 = class GoogleDriveService {
    configService;
    logger = new common_1.Logger(GoogleDriveService_1.name);
    apiKey;
    baseUrl = 'https://www.googleapis.com/drive/v3';
    constructor(configService) {
        this.configService = configService;
        this.apiKey = this.configService.get('GOOGLE_API_KEY') || '';
        if (!this.apiKey) {
            this.logger.warn('GOOGLE_API_KEY is not configured');
        }
    }
    extractFolderId(urlOrId) {
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
    async listFiles(folderId) {
        const extractedId = this.extractFolderId(folderId);
        const query = `'${extractedId}' in parents and mimeType contains 'image/' and trashed = false`;
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
        }
        catch (error) {
            this.logger.error(`Error listing files: ${error}`);
            throw error;
        }
    }
    async getFileMetadata(fileId) {
        const fields = 'id,name,mimeType,thumbnailLink,webContentLink,modifiedTime,createdTime';
        const url = `${this.baseUrl}/files/${fileId}?fields=${fields}&key=${this.apiKey}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new common_1.NotFoundException(`File with ID "${fileId}" not found`);
                }
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to get file metadata');
            }
            return response.json();
        }
        catch (error) {
            this.logger.error(`Error getting file metadata: ${error}`);
            throw error;
        }
    }
    async getFileStream(fileId) {
        const metadata = await this.getFileMetadata(fileId);
        const url = `${this.baseUrl}/files/${fileId}?alt=media&key=${this.apiKey}`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    throw new common_1.NotFoundException(`File with ID "${fileId}" not found`);
                }
                const error = await response.json();
                throw new Error(error.error?.message || 'Failed to download file');
            }
            const webStream = response.body;
            if (!webStream) {
                throw new Error('No response body');
            }
            const reader = webStream.getReader();
            const nodeStream = new stream_1.Readable({
                async read() {
                    const { done, value } = await reader.read();
                    if (done) {
                        this.push(null);
                    }
                    else {
                        this.push(Buffer.from(value));
                    }
                },
            });
            return {
                stream: nodeStream,
                mimeType: metadata.mimeType,
                fileName: metadata.name,
            };
        }
        catch (error) {
            this.logger.error(`Error downloading file: ${error}`);
            throw error;
        }
    }
    getThumbnailUrl(fileId) {
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    }
    getDirectUrl(fileId) {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    getProxyUrl(fileId, baseUrl) {
        return `${baseUrl}/drive/proxy?fileId=${fileId}`;
    }
    async getFolderName(folderId) {
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
        }
        catch (error) {
            this.logger.error(`Error getting folder name: ${error}`);
            return null;
        }
    }
};
exports.GoogleDriveService = GoogleDriveService;
exports.GoogleDriveService = GoogleDriveService = GoogleDriveService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GoogleDriveService);
//# sourceMappingURL=google-drive.service.js.map