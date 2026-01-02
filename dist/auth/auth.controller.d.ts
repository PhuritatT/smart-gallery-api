import { AuthService, AuthResponse } from './auth.service';
import { RegisterDto, LoginDto } from './dto';
declare class CreateAdminDto {
    username: string;
    password: string;
    secretKey: string;
}
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    register(registerDto: RegisterDto): Promise<AuthResponse>;
    login(loginDto: LoginDto): Promise<AuthResponse>;
    createAdmin(createAdminDto: CreateAdminDto): Promise<AuthResponse>;
}
export {};
