import { User } from '../../users/entities/user.entity';
export declare class Album {
    id: string;
    userId: string;
    driveFolderId: string;
    driveFolderName: string | null;
    title: string;
    coverImageUrl: string | null;
    createdAt: Date;
    deletedAt: Date | null;
    user: User;
}
