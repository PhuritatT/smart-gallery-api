// Update Album DTO - Created: 2026-01-02
import { PartialType } from '@nestjs/swagger';
import { CreateAlbumDto } from './create-album.dto';

export class UpdateAlbumDto extends PartialType(CreateAlbumDto) { }
