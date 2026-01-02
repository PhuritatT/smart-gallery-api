import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto';
import { User } from '../users/entities/user.entity';
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
export declare class AuthService {
    private readonly usersService;
    private readonly jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
    register(registerDto: RegisterDto): Promise<AuthResponse>;
    login(loginDto: LoginDto): Promise<AuthResponse>;
    validateUser(identifier: string, password: string): Promise<User>;
    validateJwtPayload(payload: JwtPayload): Promise<User>;
    private generateAuthResponse;
    createAdmin(username: string, password: string, secretKey: string): Promise<AuthResponse>;
}
