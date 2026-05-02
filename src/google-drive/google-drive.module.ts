// Google Drive Module - Created: 2026-01-02
import { Module } from '@nestjs/common';
import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveController } from './google-drive.controller';
import { DriveImageCacheService } from './drive-image-cache.service';

@Module({
    controllers: [GoogleDriveController],
    providers: [GoogleDriveService, DriveImageCacheService],
    exports: [GoogleDriveService],
})
export class GoogleDriveModule { }
