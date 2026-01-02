// Google Drive Controller - Created: 2026-01-02
import {
    Controller,
    Get,
    Query,
    Res,
    BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { GoogleDriveService } from './google-drive.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Google Drive')
@Controller('drive')
export class GoogleDriveController {
    constructor(private readonly googleDriveService: GoogleDriveService) { }

    @Public()
    @Get('files')
    @ApiOperation({ summary: 'List images in a Google Drive folder' })
    @ApiQuery({ name: 'folderId', required: true, description: 'Google Drive folder ID' })
    @ApiResponse({ status: 200, description: 'Returns list of image files' })
    async listFiles(@Query('folderId') folderId: string) {
        if (!folderId) {
            throw new BadRequestException('folderId is required');
        }

        const files = await this.googleDriveService.listFiles(folderId);
        return { files };
    }

    @Public()
    @Get('proxy')
    @ApiOperation({
        summary: 'Proxy endpoint to fetch image from Google Drive',
        description: 'This endpoint streams image data to bypass CORS restrictions for Face Search'
    })
    @ApiQuery({ name: 'fileId', required: true, description: 'Google Drive file ID' })
    @ApiResponse({ status: 200, description: 'Returns image binary stream' })
    @ApiResponse({ status: 404, description: 'File not found' })
    async proxyFile(
        @Query('fileId') fileId: string,
        @Res() res: Response,
    ) {
        if (!fileId) {
            throw new BadRequestException('fileId is required');
        }

        const { stream, mimeType, fileName } = await this.googleDriveService.getFileStream(fileId);

        // Set headers for image response
        res.set({
            'Content-Type': mimeType,
            'Content-Disposition': `inline; filename="${fileName}"`,
            'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            'Access-Control-Allow-Origin': '*', // Allow CORS for face-api.js
        });

        // Pipe the stream to response
        stream.pipe(res);
    }

    @Public()
    @Get('metadata')
    @ApiOperation({ summary: 'Get file metadata from Google Drive' })
    @ApiQuery({ name: 'fileId', required: true, description: 'Google Drive file ID' })
    @ApiResponse({ status: 200, description: 'Returns file metadata' })
    @ApiResponse({ status: 404, description: 'File not found' })
    async getMetadata(@Query('fileId') fileId: string) {
        if (!fileId) {
            throw new BadRequestException('fileId is required');
        }

        return this.googleDriveService.getFileMetadata(fileId);
    }
}
