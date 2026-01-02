"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const users_service_1 = require("../users/users.service");
const user_role_enum_1 = require("../common/enums/user-role.enum");
let AuthService = class AuthService {
    usersService;
    jwtService;
    constructor(usersService, jwtService) {
        this.usersService = usersService;
        this.jwtService = jwtService;
    }
    async register(registerDto) {
        const existingEmail = await this.usersService.findByEmail(registerDto.email);
        if (existingEmail) {
            throw new common_1.ConflictException('Email already registered');
        }
        const existingUsername = await this.usersService.findByUsername(registerDto.username);
        if (existingUsername) {
            throw new common_1.ConflictException('Username already taken');
        }
        const hashedPassword = await bcrypt.hash(registerDto.password, 10);
        const user = await this.usersService.create({
            email: registerDto.email,
            username: registerDto.username,
            password: hashedPassword,
        });
        return this.generateAuthResponse(user);
    }
    async login(loginDto) {
        const user = await this.validateUser(loginDto.identifier, loginDto.password);
        return this.generateAuthResponse(user);
    }
    async validateUser(identifier, password) {
        const user = await this.usersService.findByEmailOrUsername(identifier);
        if (!user) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        return user;
    }
    async validateJwtPayload(payload) {
        const user = await this.usersService.findById(payload.sub);
        if (!user) {
            throw new common_1.UnauthorizedException('User not found');
        }
        return user;
    }
    generateAuthResponse(user) {
        const payload = {
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
    async createAdmin(username, password, secretKey) {
        const adminSecretKey = process.env.JWT_SECRET || 'your-secret-key';
        if (secretKey !== adminSecretKey) {
            throw new common_1.UnauthorizedException('Invalid secret key');
        }
        const existingUser = await this.usersService.findByUsername(username);
        if (existingUser) {
            existingUser.role = user_role_enum_1.UserRole.ADMIN;
            await this.usersService.update(existingUser.id, { role: user_role_enum_1.UserRole.ADMIN });
            return this.generateAuthResponse(existingUser);
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await this.usersService.createAdmin({
            email: `${username}@admin.local`,
            username,
            password: hashedPassword,
        });
        return this.generateAuthResponse(user);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map