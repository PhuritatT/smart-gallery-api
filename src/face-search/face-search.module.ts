// Face Search Module - Proxies requests to the face-search microservice
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FaceSearchController } from './face-search.controller';
import { FaceSearchService } from './face-search.service';

@Module({
  imports: [ConfigModule],
  controllers: [FaceSearchController],
  providers: [FaceSearchService],
  exports: [FaceSearchService],
})
export class FaceSearchModule {}
