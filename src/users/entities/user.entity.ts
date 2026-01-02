// User Entity - Updated: 2026-01-02 - Username nullable for migration
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToMany,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { Album } from '../../albums/entities/album.entity';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column({ unique: true, nullable: true })
    username: string;

    @Column()
    password: string; // Hashed with Bcrypt (auto-salt)

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.USER,
    })
    role: UserRole;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @OneToMany(() => Album, (album) => album.user)
    albums: Album[];
}
