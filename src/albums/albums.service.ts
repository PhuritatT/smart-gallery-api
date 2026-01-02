// Albums Service - Updated: 2026-01-02 - Fetch folder name from Google Drive
import {
    Injectable,
    NotFoundException,
    ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Album } from './entities/album.entity';
import { CreateAlbumDto, UpdateAlbumDto } from './dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { GoogleDriveService } from '../google-drive/google-drive.service';

@Injectable()
export class AlbumsService {
    constructor(
        @InjectRepository(Album)
        private readonly albumsRepository: Repository<Album>,
        private readonly googleDriveService: GoogleDriveService,
    ) { }

    /**
     * Create a new album - fetches folder name from Google Drive
     */
    async create(createAlbumDto: CreateAlbumDto, user: User): Promise<Album> {
        // Fetch folder name from Google Drive
        const folderName = await this.googleDriveService.getFolderName(createAlbumDto.driveFolderId);

        const album = this.albumsRepository.create({
            ...createAlbumDto,
            userId: user.id,
            driveFolderName: folderName,
        });
        return this.albumsRepository.save(album);
    }

    /**
     * Find all albums (public - includes soft-deleted for admin)
     */
    async findAll(user?: User): Promise<Album[]> {
        if (user?.role === UserRole.ADMIN) {
            return this.albumsRepository.find({
                withDeleted: true,
                order: { createdAt: 'DESC' },
            });
        }
        return this.albumsRepository.find({
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Find albums by user
     */
    async findByUser(userId: string): Promise<Album[]> {
        return this.albumsRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }

    /**
     * Find one album by ID (public access)
     */
    async findOne(id: string): Promise<Album> {
        const album = await this.albumsRepository.findOne({ where: { id } });
        if (!album) {
            throw new NotFoundException(`Album with ID "${id}" not found`);
        }
        return album;
    }

    /**
     * Update an album (owner or admin only)
     */
    async update(
        id: string,
        updateAlbumDto: UpdateAlbumDto,
        user: User,
    ): Promise<Album> {
        const album = await this.findOne(id);
        this.checkOwnership(album, user);

        // If folder ID changed, update folder name too
        if (updateAlbumDto.driveFolderId && updateAlbumDto.driveFolderId !== album.driveFolderId) {
            const folderName = await this.googleDriveService.getFolderName(updateAlbumDto.driveFolderId);
            album.driveFolderName = folderName;
        }

        Object.assign(album, updateAlbumDto);
        return this.albumsRepository.save(album);
    }

    /**
     * Soft delete an album (owner or admin only)
     */
    async softDelete(id: string, user: User): Promise<void> {
        const album = await this.findOne(id);
        this.checkOwnership(album, user);

        await this.albumsRepository.softDelete(id);
    }

    /**
     * Restore a soft-deleted album (admin only)
     */
    async restore(id: string): Promise<Album> {
        const result = await this.albumsRepository.restore(id);
        if (result.affected === 0) {
            throw new NotFoundException(`Album with ID "${id}" not found`);
        }
        return this.findOne(id);
    }

    /**
     * Hard delete an album (admin only)
     */
    async hardDelete(id: string): Promise<void> {
        const result = await this.albumsRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException(`Album with ID "${id}" not found`);
        }
    }

    /**
     * Check if user is owner or admin
     */
    private checkOwnership(album: Album, user: User): void {
        if (user.role !== UserRole.ADMIN && album.userId !== user.id) {
            throw new ForbiddenException('You do not have permission to modify this album');
        }
    }
}
