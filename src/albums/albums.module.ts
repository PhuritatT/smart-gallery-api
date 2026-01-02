// Albums Module - Updated: 2026-01-02 - Added GoogleDriveModule
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Album } from './entities/album.entity';
import { AlbumsService } from './albums.service';
import { AlbumsController } from './albums.controller';
import { GoogleDriveModule } from '../google-drive/google-drive.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Album]),
        GoogleDriveModule,
    ],
    controllers: [AlbumsController],
    providers: [AlbumsService],
    exports: [AlbumsService],
})
export class AlbumsModule { }
