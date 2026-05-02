// Google Drive Controller - Created: 2026-01-02
import {
    Controller,
    Get,
    Query,
    Res,
    BadRequestException,
    ForbiddenException,
    Headers,
    Inject,
    forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { DriveFileStreamContext, GoogleDriveService } from './google-drive.service';
import { AlbumsService } from '../albums/albums.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Google Drive')
@Controller('drive')
export class GoogleDriveController {
    constructor(
        private readonly googleDriveService: GoogleDriveService,
        @Inject(forwardRef(() => AlbumsService))
        private readonly albumsService: AlbumsService,
    ) { }

    private async assertFolderRegistered(folderId: string): Promise<void> {
        const registered = await this.albumsService.isFolderIdRegistered(folderId);
        if (!registered) {
            throw new ForbiddenException('Access to this folder is not permitted');
        }
    }

    private sanitizeFilename(fileName: string): string {
        return fileName.replace(/[\r\n"]/g, '').trim() || 'download';
    }

    private shouldDownload(download?: string): boolean {
        if (!download) return false;

        return ['1', 'true', 'yes'].includes(download.toLowerCase());
    }

    private getHeaderValue(value: string | string[] | undefined): string | undefined {
        return Array.isArray(value) ? value[0] : value;
    }

    private getRequestBaseUrl(headers: Record<string, string | string[] | undefined>): string {
        const host = this.getHeaderValue(headers['x-forwarded-host']) || this.getHeaderValue(headers.host);
        const protocol = this.getHeaderValue(headers['x-forwarded-proto']) || 'https';

        return host ? `${protocol}://${host}` : '';
    }

    private buildStreamContext(
        folderId?: string,
        folderName?: string,
        fileName?: string,
        mimeType?: string,
    ): DriveFileStreamContext {
        const context: DriveFileStreamContext = {};
        if (folderId) context.folderId = folderId;
        if (folderName) context.folderName = folderName;
        if (fileName) context.fileName = fileName;
        if (mimeType) context.mimeType = mimeType;
        return context;
    }

    @Public()
    @Get('files')
    @ApiOperation({ summary: 'List images in a Google Drive folder' })
    @ApiQuery({ name: 'folderId', required: true, description: 'Google Drive folder ID' })
    @ApiResponse({ status: 200, description: 'Returns list of image files' })
    async listFiles(@Query('folderId') folderId: string) {
        if (!folderId) {
            throw new BadRequestException('folderId is required');
        }

        await this.assertFolderRegistered(folderId);

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
    @ApiQuery({
        name: 'download',
        required: false,
        description: 'When set, returns attachment headers for file download',
    })
    @ApiQuery({ name: 'folderId', required: false, description: 'Google Drive folder ID for R2 cache lookup' })
    @ApiQuery({ name: 'folderName', required: false, description: 'Google Drive folder name for R2 cache key' })
    @ApiQuery({ name: 'fileName', required: false, description: 'Image filename for R2 cache key' })
    @ApiQuery({ name: 'mimeType', required: false, description: 'Image MIME type for cached responses' })
    @ApiResponse({ status: 200, description: 'Returns image binary stream' })
    @ApiResponse({ status: 404, description: 'File not found' })
    async proxyFile(
        @Query('fileId') fileId: string,
        @Res() res: Response,
        @Query('download') download?: string,
        @Query('folderId') folderId?: string,
        @Query('folderName') folderName?: string,
        @Query('fileName') fileName?: string,
        @Query('mimeType') mimeType?: string,
    ) {
        if (!fileId) {
            throw new BadRequestException('fileId is required');
        }

        if (folderId) {
            await this.assertFolderRegistered(folderId);
        }

        const { stream, mimeType: responseMimeType, fileName: responseFileName } =
            await this.googleDriveService.getFileStream(
                fileId,
                this.buildStreamContext(folderId, folderName, fileName, mimeType),
            );
        const sanitizedFileName = this.sanitizeFilename(responseFileName);
        const dispositionType = this.shouldDownload(download) ? 'attachment' : 'inline';

        res.set({
            'Content-Type': responseMimeType,
            'Content-Disposition': `${dispositionType}; filename="${sanitizedFileName}"; filename*=UTF-8''${encodeURIComponent(sanitizedFileName)}`,
            'Cache-Control': 'public, max-age=86400',
        });

        stream.pipe(res);
    }

    @Public()
    @Get('cache-url')
    @ApiOperation({
        summary: 'Get direct cached image URL when available',
        description: 'Returns a short-lived R2 signed URL on cache hit, or proxy fallback URL on cache miss.',
    })
    @ApiQuery({ name: 'fileId', required: true, description: 'Google Drive file ID' })
    @ApiQuery({ name: 'download', required: false, description: 'When set, URL should download the image' })
    @ApiQuery({ name: 'folderId', required: false, description: 'Google Drive folder ID for R2 cache lookup' })
    @ApiQuery({ name: 'folderName', required: false, description: 'Google Drive folder name for R2 cache key' })
    @ApiQuery({ name: 'fileName', required: false, description: 'Image filename for R2 cache key' })
    @ApiQuery({ name: 'mimeType', required: false, description: 'Image MIME type for cached responses' })
    async getCachedFileUrl(
        @Query('fileId') fileId: string,
        @Query('download') download: string | undefined,
        @Query('folderId') folderId: string | undefined,
        @Query('folderName') folderName: string | undefined,
        @Query('fileName') fileName: string | undefined,
        @Query('mimeType') mimeType: string | undefined,
        @Headers() headers: Record<string, string | string[] | undefined>,
        @Res({ passthrough: true }) res: Response,
    ) {
        if (!fileId) {
            throw new BadRequestException('fileId is required');
        }

        if (folderId) {
            await this.assertFolderRegistered(folderId);
        }

        res.set({
            'Cache-Control': 'private, max-age=60',
            Vary: 'Origin',
        });

        return this.googleDriveService.getCachedFileUrl(
            fileId,
            this.buildStreamContext(folderId, folderName, fileName, mimeType),
            {
                baseUrl: this.getRequestBaseUrl(headers),
                download: this.shouldDownload(download),
            },
        );
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
