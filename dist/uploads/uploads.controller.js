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
exports.UploadsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const config_1 = require("@nestjs/config");
const client_s3_1 = require("@aws-sdk/client-s3");
const uuid_1 = require("uuid");
const path_1 = require("path");
let UploadsController = class UploadsController {
    configService;
    r2Client;
    constructor(configService) {
        this.configService = configService;
        const endpoint = this.configService.get('R2_ENDPOINT');
        const accessKeyId = this.configService.get('R2_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get('R2_SECRET_ACCESS_KEY');
        console.log('R2 Config:', { endpoint, accessKeyId: accessKeyId ? 'SET' : 'NOT SET' });
        this.r2Client = new client_s3_1.S3Client({
            region: 'auto',
            endpoint: endpoint,
            credentials: {
                accessKeyId: accessKeyId || '',
                secretAccessKey: secretAccessKey || '',
            },
            forcePathStyle: true,
        });
    }
    async uploadImage(file) {
        console.log('uploadImage called, file:', file ? 'received' : 'null');
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded.');
        }
        if (!file.buffer) {
            throw new common_1.BadRequestException('File buffer is empty.');
        }
        const bucketName = this.configService.get('R2_BUCKET_NAME');
        const publicUrl = this.configService.get('R2_PUBLIC_URL');
        const ext = (0, path_1.extname)(file.originalname).toLowerCase() || '.jpg';
        const filename = `covers/${(0, uuid_1.v4)()}${ext}`;
        console.log('Uploading to R2:', { bucketName, filename, size: file.size });
        try {
            await this.r2Client.send(new client_s3_1.PutObjectCommand({
                Bucket: bucketName,
                Key: filename,
                Body: file.buffer,
                ContentType: file.mimetype,
            }));
            const url = `${publicUrl}/${filename}`;
            console.log('Upload successful:', url);
            return {
                success: true,
                filename,
                originalName: file.originalname,
                size: file.size,
                url,
            };
        }
        catch (error) {
            console.error('R2 Upload Error:', error);
            throw new common_1.BadRequestException(`Failed to upload to R2: ${error.message}`);
        }
    }
};
exports.UploadsController = UploadsController;
__decorate([
    (0, common_1.Post)('image'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload an image file to R2' }),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiBody)({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Image uploaded successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid file type' }),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        fileFilter: (req, file, callback) => {
            const allowedMimeTypes = [
                'image/jpeg',
                'image/jpg',
                'image/png',
                'image/gif',
                'image/webp',
                'image/bmp',
                'image/tiff',
            ];
            console.log('Upload file info:', {
                originalname: file.originalname,
                mimetype: file.mimetype,
            });
            if (allowedMimeTypes.includes(file.mimetype)) {
                callback(null, true);
            }
            else {
                console.log('Rejected file type:', file.mimetype);
                callback(new common_1.BadRequestException(`Invalid file type: ${file.mimetype}`), false);
            }
        },
        limits: {
            fileSize: 10 * 1024 * 1024,
        },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UploadsController.prototype, "uploadImage", null);
exports.UploadsController = UploadsController = __decorate([
    (0, swagger_1.ApiTags)('Uploads'),
    (0, common_1.Controller)('uploads'),
    __metadata("design:paramtypes", [config_1.ConfigService])
], UploadsController);
//# sourceMappingURL=uploads.controller.js.map