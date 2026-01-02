"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlbumsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const album_entity_1 = require("./entities/album.entity");
const user_role_enum_1 = require("../common/enums/user-role.enum");
const google_drive_service_1 = require("../google-drive/google-drive.service");
let AlbumsService = class AlbumsService {
    albumsRepository;
    googleDriveService;
    constructor(albumsRepository, googleDriveService) {
        this.albumsRepository = albumsRepository;
        this.googleDriveService = googleDriveService;
    }
    async create(createAlbumDto, user) {
        const folderName = await this.googleDriveService.getFolderName(createAlbumDto.driveFolderId);
        const album = this.albumsRepository.create({
            ...createAlbumDto,
            userId: user.id,
            driveFolderName: folderName,
        });
        return this.albumsRepository.save(album);
    }
    async findAll(user) {
        if (user?.role === user_role_enum_1.UserRole.ADMIN) {
            return this.albumsRepository.find({
                withDeleted: true,
                order: { createdAt: 'DESC' },
            });
        }
        return this.albumsRepository.find({
            order: { createdAt: 'DESC' },
        });
    }
    async findByUser(userId) {
        return this.albumsRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
        });
    }
    async findOne(id) {
        const album = await this.albumsRepository.findOne({ where: { id } });
        if (!album) {
            throw new common_1.NotFoundException(`Album with ID "${id}" not found`);
        }
        return album;
    }
    async update(id, updateAlbumDto, user) {
        const album = await this.findOne(id);
        this.checkOwnership(album, user);
        if (updateAlbumDto.driveFolderId && updateAlbumDto.driveFolderId !== album.driveFolderId) {
            const folderName = await this.googleDriveService.getFolderName(updateAlbumDto.driveFolderId);
            album.driveFolderName = folderName;
        }
        Object.assign(album, updateAlbumDto);
        return this.albumsRepository.save(album);
    }
    async softDelete(id, user) {
        const album = await this.findOne(id);
        this.checkOwnership(album, user);
        await this.albumsRepository.softDelete(id);
    }
    async restore(id) {
        const result = await this.albumsRepository.restore(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`Album with ID "${id}" not found`);
        }
        return this.findOne(id);
    }
    async hardDelete(id) {
        const result = await this.albumsRepository.delete(id);
        if (result.affected === 0) {
            throw new common_1.NotFoundException(`Album with ID "${id}" not found`);
        }
    }
    checkOwnership(album, user) {
        if (user.role !== user_role_enum_1.UserRole.ADMIN && album.userId !== user.id) {
            throw new common_1.ForbiddenException('You do not have permission to modify this album');
        }
    }
};
exports.AlbumsService = AlbumsService;
exports.AlbumsService = AlbumsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(album_entity_1.Album)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        google_drive_service_1.GoogleDriveService])
], AlbumsService);
//# sourceMappingURL=albums.service.js.map