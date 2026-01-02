// Users Service - Updated: 2026-01-02 - Added username support
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) { }

    async create(createUserDto: CreateUserDto): Promise<User> {
        const user = this.usersRepository.create(createUserDto);
        return this.usersRepository.save(user);
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { email } });
    }

    async findByUsername(username: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { username } });
    }

    async findByEmailOrUsername(identifier: string): Promise<User | null> {
        // Check if it's an email (contains @)
        if (identifier.includes('@')) {
            return this.findByEmail(identifier);
        }
        return this.findByUsername(identifier);
    }

    async findById(id: string): Promise<User | null> {
        return this.usersRepository.findOne({ where: { id } });
    }

    async findAll(): Promise<User[]> {
        return this.usersRepository.find();
    }

    async update(id: string, updateData: Partial<User>): Promise<User> {
        await this.usersRepository.update(id, updateData);
        return this.findById(id) as Promise<User>;
    }

    async createAdmin(createUserDto: CreateUserDto): Promise<User> {
        const user = this.usersRepository.create({
            ...createUserDto,
            role: UserRole.ADMIN,
        });
        return this.usersRepository.save(user);
    }

    async remove(id: string): Promise<void> {
        await this.usersRepository.delete(id);
    }

    async isEmailTaken(email: string): Promise<boolean> {
        const user = await this.findByEmail(email);
        return !!user;
    }

    async isUsernameTaken(username: string): Promise<boolean> {
        const user = await this.findByUsername(username);
        return !!user;
    }
}
