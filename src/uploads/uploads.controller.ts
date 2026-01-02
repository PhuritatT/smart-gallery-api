// Uploads Controller - Updated: 2026-01-02 - Fixed R2 client initialization
import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

@ApiTags('Uploads')
@Controller('uploads')
export class UploadsController {
    private r2Client: S3Client;

    constructor(private configService: ConfigService) {
        // Initialize R2 Client with ConfigService to ensure env is loaded
        const endpoint = this.configService.get<string>('R2_ENDPOINT');
        const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');

        console.log('R2 Config:', { endpoint, accessKeyId: accessKeyId ? 'SET' : 'NOT SET' });

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

    @Post('image')
    @ApiOperation({ summary: 'Upload an image file to R2' })
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

                console.log('Upload file info:', {
                    originalname: file.originalname,
                    mimetype: file.mimetype,
                });

                if (allowedMimeTypes.includes(file.mimetype)) {
                    callback(null, true);
                } else {
                    console.log('Rejected file type:', file.mimetype);
                    callback(new BadRequestException(`Invalid file type: ${file.mimetype}`), false);
                }
            },
            limits: {
                fileSize: 10 * 1024 * 1024, // 10MB max
            },
        }),
    )
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
        console.log('uploadImage called, file:', file ? 'received' : 'null');

        if (!file) {
            throw new BadRequestException('No file uploaded.');
        }

        if (!file.buffer) {
            throw new BadRequestException('File buffer is empty.');
        }

        const bucketName = this.configService.get<string>('R2_BUCKET_NAME');
        const publicUrl = this.configService.get<string>('R2_PUBLIC_URL');

        // Generate unique filename
        const ext = extname(file.originalname).toLowerCase() || '.jpg';
        const filename = `covers/${uuidv4()}${ext}`;

        console.log('Uploading to R2:', { bucketName, filename, size: file.size });

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
            console.log('Upload successful:', url);

            return {
                success: true,
                filename,
                originalName: file.originalname,
                size: file.size,
                url,
            };
        } catch (error) {
            console.error('R2 Upload Error:', error);
            throw new BadRequestException(`Failed to upload to R2: ${error.message}`);
        }
    }
}
