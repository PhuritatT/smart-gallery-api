import { AlbumsService } from './albums.service';
import { CreateAlbumDto, UpdateAlbumDto } from './dto';
import { User } from '../users/entities/user.entity';
export declare class AlbumsController {
    private readonly albumsService;
    constructor(albumsService: AlbumsService);
    findAll(user?: User): Promise<import("./entities/album.entity").Album[]>;
    findOne(id: string): Promise<import("./entities/album.entity").Album>;
    findMyAlbums(user: User): Promise<import("./entities/album.entity").Album[]>;
    create(createAlbumDto: CreateAlbumDto, user: User): Promise<import("./entities/album.entity").Album>;
    update(id: string, updateAlbumDto: UpdateAlbumDto, user: User): Promise<import("./entities/album.entity").Album>;
    softDelete(id: string, user: User): Promise<void>;
    restore(id: string): Promise<import("./entities/album.entity").Album>;
    hardDelete(id: string): Promise<void>;
}
