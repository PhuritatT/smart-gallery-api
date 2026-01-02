// Create Album DTO - Created: 2026-01-02
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAlbumDto {
    @ApiProperty({ example: '1234567890abcdef', description: 'Google Drive folder ID' })
    @IsNotEmpty()
    @IsString()
    driveFolderId: string;

    @ApiProperty({ example: 'My Wedding Album', description: 'Album title' })
    @IsNotEmpty()
    @IsString()
    title: string;

    @ApiPropertyOptional({ example: 'https://...', description: 'Cover image URL' })
    @IsOptional()
    @IsString()
    coverImageUrl?: string;
}
