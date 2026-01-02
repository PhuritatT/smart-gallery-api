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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleDriveController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const google_drive_service_1 = require("./google-drive.service");
const public_decorator_1 = require("../common/decorators/public.decorator");
let GoogleDriveController = class GoogleDriveController {
    googleDriveService;
    constructor(googleDriveService) {
        this.googleDriveService = googleDriveService;
    }
    async listFiles(folderId) {
        if (!folderId) {
            throw new common_1.BadRequestException('folderId is required');
        }
        const files = await this.googleDriveService.listFiles(folderId);
        return { files };
    }
    async proxyFile(fileId, res) {
        if (!fileId) {
            throw new common_1.BadRequestException('fileId is required');
        }
        const { stream, mimeType, fileName } = await this.googleDriveService.getFileStream(fileId);
        res.set({
            'Content-Type': mimeType,
            'Content-Disposition': `inline; filename="${fileName}"`,
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
        });
        stream.pipe(res);
    }
    async getMetadata(fileId) {
        if (!fileId) {
            throw new common_1.BadRequestException('fileId is required');
        }
        return this.googleDriveService.getFileMetadata(fileId);
    }
};
exports.GoogleDriveController = GoogleDriveController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('files'),
    (0, swagger_1.ApiOperation)({ summary: 'List images in a Google Drive folder' }),
    (0, swagger_1.ApiQuery)({ name: 'folderId', required: true, description: 'Google Drive folder ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns list of image files' }),
    __param(0, (0, common_1.Query)('folderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GoogleDriveController.prototype, "listFiles", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('proxy'),
    (0, swagger_1.ApiOperation)({
        summary: 'Proxy endpoint to fetch image from Google Drive',
        description: 'This endpoint streams image data to bypass CORS restrictions for Face Search'
    }),
    (0, swagger_1.ApiQuery)({ name: 'fileId', required: true, description: 'Google Drive file ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns image binary stream' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'File not found' }),
    __param(0, (0, common_1.Query)('fileId')),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], GoogleDriveController.prototype, "proxyFile", null);
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Get)('metadata'),
    (0, swagger_1.ApiOperation)({ summary: 'Get file metadata from Google Drive' }),
    (0, swagger_1.ApiQuery)({ name: 'fileId', required: true, description: 'Google Drive file ID' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Returns file metadata' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'File not found' }),
    __param(0, (0, common_1.Query)('fileId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], GoogleDriveController.prototype, "getMetadata", null);
exports.GoogleDriveController = GoogleDriveController = __decorate([
    (0, swagger_1.ApiTags)('Google Drive'),
    (0, common_1.Controller)('drive'),
    __metadata("design:paramtypes", [google_drive_service_1.GoogleDriveService])
], GoogleDriveController);
//# sourceMappingURL=google-drive.controller.js.map