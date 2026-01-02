import { ConfigService } from '@nestjs/config';
export declare class UploadsController {
    private configService;
    private r2Client;
    constructor(configService: ConfigService);
    uploadImage(file: Express.Multer.File): Promise<{
        success: boolean;
        filename: string;
        originalName: string;
        size: number;
        url: string;
    }>;
}
