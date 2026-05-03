// App Module - Updated: 2026-01-02 - Added UploadsModule
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AlbumsModule } from './albums/albums.module';
import { GoogleDriveModule } from './google-drive/google-drive.module';
import { UploadsModule } from './uploads/uploads.module';
import { FaceSearchModule } from './face-search/face-search.module';
import { RedisModule } from './redis/redis.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { User } from './users/entities/user.entity';
import { Album } from './albums/entities/album.entity';

@Module({
  imports: [
    // Load environment variables
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DATABASE_HOST', 'localhost'),
        port: configService.get<number>('DATABASE_PORT', 5432),
        username: configService.get<string>('DATABASE_USER', 'postgres'),
        password: configService.get<string>('DATABASE_PASSWORD', 'postgres'),
        database: configService.get<string>('DATABASE_NAME', 'gallery_db'),
        entities: [User, Album],
        synchronize: configService.get<string>('NODE_ENV') !== 'production', // Auto-sync in dev
        logging: configService.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),

    // Rate limiting — global default: 60 req / 60s
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 60,
      },
    ]),

    // Redis (global)
    RedisModule,

    // Feature modules
    AuthModule,
    UsersModule,
    AlbumsModule,
    GoogleDriveModule,
    UploadsModule,
    FaceSearchModule,
  ],
  providers: [
    // Global Throttler Guard (rate limiting)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Global JWT Auth Guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Roles Guard
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule { }
