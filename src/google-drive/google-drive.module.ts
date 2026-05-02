// Google Drive Module - Created: 2026-01-02
import { Module, forwardRef } from '@nestjs/common';
import { GoogleDriveService } from './google-drive.service';
import { GoogleDriveController } from './google-drive.controller';
import { DriveImageCacheService } from './drive-image-cache.service';
import { AlbumsModule } from '../albums/albums.module';

@Module({
    imports: [forwardRef(() => AlbumsModule)],
    controllers: [GoogleDriveController],
    providers: [GoogleDriveService, DriveImageCacheService],
    exports: [GoogleDriveService],
})
export class GoogleDriveModule { }
