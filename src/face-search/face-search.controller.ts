// Face Search Controller - API endpoints for face search
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  Body,
  Query,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { FaceSearchService } from './face-search.service';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Face Search')
@Controller('face-search')
export class FaceSearchController {
  private readonly logger = new Logger(FaceSearchController.name);

  constructor(private readonly faceSearchService: FaceSearchService) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Check face search service health' })
  async healthCheck() {
    const health = await this.faceSearchService.healthCheck();
    return {
      service: 'face-search',
      ...health,
    };
  }

  @Public()
  @Get('stats')
  @ApiOperation({ summary: 'Get face search statistics' })
  async getStats() {
    return this.faceSearchService.getStats();
  }

  @Post('index')
  @ApiOperation({
    summary: 'Index faces in a photo',
    description: 'Detects faces in the uploaded image and stores embeddings for future searches',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image file (JPEG/PNG)' },
        file_id: { type: 'string', description: 'Unique file identifier' },
        file_name: { type: 'string', description: 'Original file name (optional)' },
        folder_id: { type: 'string', description: 'Album/folder ID (optional)' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async indexPhoto(
    @UploadedFile() file: Express.Multer.File,
    @Body('file_id') fileId: string,
    @Body('file_name') fileName?: string,
    @Body('folder_id') folderId?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    if (!fileId) {
      throw new BadRequestException('file_id is required');
    }

    this.logger.log(`Indexing face for file: ${fileId}`);

    return this.faceSearchService.indexPhoto(
      file.buffer,
      fileId,
      fileName || file.originalname || fileId,
      folderId || '',
    );
  }

  @Public()
  @Post('search')
  @ApiOperation({
    summary: 'Search for matching faces',
    description: 'Upload a selfie or group photo to find matching faces in indexed photos',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Selfie or group photo' },
        threshold: { type: 'number', description: 'Similarity threshold (0-1, default: 0.4)' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Returns matched photos grouped by detected faces' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, callback) => {
        if (!file.mimetype.startsWith('image/')) {
          callback(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async searchByFace(
    @UploadedFile() file: Express.Multer.File,
    @Body('threshold') threshold?: number,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    this.logger.log(`Face search request: ${file.originalname} (${file.size} bytes)`);

    const result = await this.faceSearchService.searchByFace(
      file.buffer,
      threshold ? Number(threshold) : undefined,
    );

    return result;
  }

  @Post('index-batch')
  @ApiOperation({
    summary: 'Batch index multiple photos',
    description: 'Upload multiple images and index all detected faces',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 50, {
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async indexBatch(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Process files sequentially through the face search service
    const results = [];
    for (const file of files) {
      const fileId = file.originalname.replace(/\.[^/.]+$/, '');
      try {
        const result = await this.faceSearchService.indexPhoto(
          file.buffer,
          fileId,
          file.originalname,
          '',
        );
        results.push(result);
      } catch (error) {
        results.push({ file: file.originalname, error: error.message });
      }
    }

    return { processed: results.length, results };
  }

  @Delete('files/:fileId')
  @ApiOperation({ summary: 'Delete face data for a file' })
  async deleteFile(@Param('fileId') fileId: string) {
    return this.faceSearchService.deleteFile(fileId);
  }
}
