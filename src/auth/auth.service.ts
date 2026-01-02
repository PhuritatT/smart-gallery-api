// Auth Service - Updated: 2026-01-02 - Admin creation with username only
import {
    Injectable,
    UnauthorizedException,
    ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';

export interface JwtPayload {
    sub: string;
    email: string;
    username: string;
    role: string;
}

export interface AuthResponse {
    access_token: string;
    user: {
        id: string;
        email: string;
        username: string;
        role: string;
    };
}

@Injectable()
export class AuthService {
    constructor(
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
    ) { }

    /**
     * Register a new user with hashed password
     */
    async register(registerDto: RegisterDto): Promise<AuthResponse> {
        // Check if email already exists
        const existingEmail = await this.usersService.findByEmail(registerDto.email);
        if (existingEmail) {
            throw new ConflictException('Email already registered');
        }

        // Check if username already exists
        const existingUsername = await this.usersService.findByUsername(registerDto.username);
        if (existingUsername) {
            throw new ConflictException('Username already taken');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(registerDto.password, 10);

        // Create user
        const user = await this.usersService.create({
            email: registerDto.email,
            username: registerDto.username,
            password: hashedPassword,
        });

        return this.generateAuthResponse(user);
    }

    /**
     * Login with email or username
     */
    async login(loginDto: LoginDto): Promise<AuthResponse> {
        const user = await this.validateUser(loginDto.identifier, loginDto.password);
        return this.generateAuthResponse(user);
    }

    /**
     * Validate user credentials (supports email or username)
     */
    async validateUser(identifier: string, password: string): Promise<User> {
        const user = await this.usersService.findByEmailOrUsername(identifier);
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return user;
    }

    /**
     * Validate JWT payload and return user
     */
    async validateJwtPayload(payload: JwtPayload): Promise<User> {
        const user = await this.usersService.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        return user;
    }

    /**
     * Generate JWT token and auth response
     */
    private generateAuthResponse(user: User): AuthResponse {
        const payload: JwtPayload = {
            sub: user.id,
            email: user.email || '',
            username: user.username || '',
            role: user.role,
        };

        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email || '',
                username: user.username || '',
                role: user.role,
            },
        };
    }

    /**
     * Create an admin account (username + password only)
     */
    async createAdmin(
        username: string,
        password: string,
        secretKey: string,
    ): Promise<AuthResponse> {
        const adminSecretKey = process.env.JWT_SECRET || 'your-secret-key';
        if (secretKey !== adminSecretKey) {
            throw new UnauthorizedException('Invalid secret key');
        }

        // Check if username already exists
        const existingUser = await this.usersService.findByUsername(username);
        if (existingUser) {
            // Update existing user to ADMIN
            existingUser.role = UserRole.ADMIN;
            await this.usersService.update(existingUser.id, { role: UserRole.ADMIN });
            return this.generateAuthResponse(existingUser);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create admin user (no email, just username)
        const user = await this.usersService.createAdmin({
            email: `${username}@admin.local`, // Auto-generate email
            username,
            password: hashedPassword,
        });

        return this.generateAuthResponse(user);
    }
}
