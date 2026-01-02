// Register DTO - Updated: 2026-01-02 - Added username field
import { IsEmail, IsNotEmpty, MinLength, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({ example: 'user@example.com', description: 'User email address' })
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'johndoe', description: 'Username (alphanumeric, 3-20 chars)' })
    @IsString()
    @IsNotEmpty()
    @MinLength(3)
    @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers, and underscores' })
    username: string;

    @ApiProperty({ example: 'password123', description: 'Password (min 6 characters)', minLength: 6 })
    @IsNotEmpty()
    @MinLength(6)
    password: string;
}
