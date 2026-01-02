import { UserRole } from '../../common/enums/user-role.enum';
export declare class CreateUserDto {
    email: string;
    username: string;
    password: string;
    role?: UserRole;
}
