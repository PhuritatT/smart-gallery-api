// Album Entity - Updated: 2026-01-02 - Fixed driveFolderName type
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('albums')
export class Album {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ name: 'user_id' })
    userId: string;

    @Column({ name: 'drive_folder_id' })
    driveFolderId: string;

    @Column({ name: 'drive_folder_name', type: 'varchar', nullable: true })
    driveFolderName: string | null;

    @Column()
    title: string;

    @Column({ name: 'cover_image_url', type: 'varchar', nullable: true })
    coverImageUrl: string | null;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @DeleteDateColumn({ name: 'deleted_at' })
    deletedAt: Date | null; // Soft Delete

    @ManyToOne(() => User, (user) => user.albums)
    @JoinColumn({ name: 'user_id' })
    user: User;
}
