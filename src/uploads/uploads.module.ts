// Uploads Module - Updated: 2026-01-02 - Added ConfigModule
import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule } from '@nestjs/config';
import { memoryStorage } from 'multer';

@Module({
    imports: [
        ConfigModule,
        MulterModule.register({
            storage: memoryStorage(),
        }),
    ],
    controllers: [UploadsController],
})
export class UploadsModule { }
