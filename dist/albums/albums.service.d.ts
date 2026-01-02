import { Repository } from 'typeorm';
import { Album } from './entities/album.entity';
import { CreateAlbumDto, UpdateAlbumDto } from './dto';
import { User } from '../users/entities/user.entity';
import { GoogleDriveService } from '../google-drive/google-drive.service';
export declare class AlbumsService {
    private readonly albumsRepository;
    private readonly googleDriveService;
    constructor(albumsRepository: Repository<Album>, googleDriveService: GoogleDriveService);
    create(createAlbumDto: CreateAlbumDto, user: User): Promise<Album>;
    findAll(user?: User): Promise<Album[]>;
    findByUser(userId: string): Promise<Album[]>;
    findOne(id: string): Promise<Album>;
    update(id: string, updateAlbumDto: UpdateAlbumDto, user: User): Promise<Album>;
    softDelete(id: string, user: User): Promise<void>;
    restore(id: string): Promise<Album>;
    hardDelete(id: string): Promise<void>;
    private checkOwnership;
}
