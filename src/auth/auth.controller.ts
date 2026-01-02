// Auth Controller - Updated: 2026-01-02 - Admin creation with username only
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiProperty } from '@nestjs/swagger';
import { AuthService, AuthResponse } from './auth.service';
import { RegisterDto, LoginDto } from './dto';
import { Public } from '../common/decorators/public.decorator';
import { IsString, MinLength, Matches } from 'class-validator';

// DTO for creating admin (username + password only)
class CreateAdminDto {
    @ApiProperty({ example: 'admin', description: 'Admin username' })
    @IsString()
    @MinLength(3)
    @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
    username: string;

    @ApiProperty({ example: 'adminpassword123', description: 'Admin password' })
    @IsString()
    @MinLength(6)
    password: string;

    @ApiProperty({ example: 'your-jwt-secret-key', description: 'JWT_SECRET from .env' })
    @IsString()
    secretKey: string;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Public()
    @Post('register')
    @ApiOperation({ summary: 'Register a new user' })
    @ApiResponse({ status: 201, description: 'User registered successfully' })
    @ApiResponse({ status: 409, description: 'Email or username already taken' })
    async register(@Body() registerDto: RegisterDto): Promise<AuthResponse> {
        return this.authService.register(registerDto);
    }

    @Public()
    @Post('login')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Login with email or username' })
    @ApiResponse({ status: 200, description: 'Login successful' })
    @ApiResponse({ status: 401, description: 'Invalid credentials' })
    async login(@Body() loginDto: LoginDto): Promise<AuthResponse> {
        return this.authService.login(loginDto);
    }

    @Public()
    @Post('create-admin')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create an admin account (requires JWT_SECRET)' })
    @ApiResponse({ status: 201, description: 'Admin created successfully' })
    @ApiResponse({ status: 401, description: 'Invalid secret key' })
    async createAdmin(@Body() createAdminDto: CreateAdminDto): Promise<AuthResponse> {
        return this.authService.createAdmin(
            createAdminDto.username,
            createAdminDto.password,
            createAdminDto.secretKey,
        );
    }
}
