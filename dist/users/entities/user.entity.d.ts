import { UserRole } from '../../common/enums/user-role.enum';
import { Album } from '../../albums/entities/album.entity';
export declare class User {
    id: string;
    email: string;
    username: string;
    password: string;
    role: UserRole;
    createdAt: Date;
    albums: Album[];
}
