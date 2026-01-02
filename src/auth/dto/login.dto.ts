// Login DTO - Updated: 2026-01-02 - Support email OR username login
import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
    @ApiProperty({ example: 'user@example.com or johndoe', description: 'Email or Username' })
    @IsString()
    @IsNotEmpty()
    identifier: string; // Can be email or username

    @ApiProperty({ example: 'password123', description: 'User password' })
    @IsNotEmpty()
    password: string;
}
