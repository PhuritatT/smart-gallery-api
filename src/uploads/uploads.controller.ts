// Uploads Controller - Updated: 2026-01-02 - Fixed R2 client initialization
import {
    Controller,
    Post,
    UseInterceptors,
    UseGuards,
    UploadedFile,
    BadRequestException,
    Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
    private readonly logger = new Logger(UploadsController.name);
    private r2Client: S3Client;

    constructor(private configService: ConfigService) {
        // Initialize R2 Client with ConfigService to ensure env is loaded
        const endpoint = this.configService.get<string>('R2_ENDPOINT');
        const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');

        this.logger.log(`R2 Config: endpoint=${endpoint ? 'SET' : 'NOT SET'} accessKeyId=${accessKeyId ? 'SET' : 'NOT SET'}`);

        this.r2Client = new S3Client({
            region: 'auto',
            endpoint: endpoint,
            credentials: {
                accessKeyId: accessKeyId || '',
                secretAccessKey: secretAccessKey || '',
            },
            forcePathStyle: true, // Required for R2
        });
    }

    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @Post('image')
    @ApiOperation({ summary: 'Upload an image file to R2 (requires authentication)' })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: {
                    type: 'string',
                    format: 'binary',
                },
            },
        },
    })
    @ApiResponse({ status: 201, description: 'Image uploaded successfully' })
    @ApiResponse({ status: 400, description: 'Invalid file type' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @UseInterceptors(
        FileInterceptor('file', {
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

                if (allowedMimeTypes.includes(file.mimetype)) {
                    callback(null, true);
                } else {
                    callback(new BadRequestException(`Invalid file type: ${file.mimetype}`), false);
                }
            },
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB max
            },
        }),
    )
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new BadRequestException('No file uploaded.');
        }

        if (!file.buffer) {
            throw new BadRequestException('File buffer is empty.');
        }

        const bucketName = this.configService.get<string>('R2_BUCKET_NAME');
        const publicUrl = this.configService.get<string>('R2_PUBLIC_URL');

        const ext = extname(file.originalname).toLowerCase() || '.jpg';
        const filename = `covers/${uuidv4()}${ext}`;

        this.logger.log(`Uploading file to R2: size=${file.size} type=${file.mimetype}`);

        try {
            await this.r2Client.send(
                new PutObjectCommand({
                    Bucket: bucketName,
                    Key: filename,
                    Body: file.buffer,
                    ContentType: file.mimetype,
                }),
            );

            const url = `${publicUrl}/${filename}`;
            this.logger.log('R2 upload successful');

            return {
                success: true,
                filename,
                originalName: file.originalname,
                size: file.size,
                url,
            };
        } catch (error) {
            this.logger.error(`R2 upload failed: ${error.message}`);
            throw new BadRequestException(`Failed to upload to R2: ${error.message}`);
        }
    }
}
