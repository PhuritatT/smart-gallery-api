import { Response } from 'express';
import { GoogleDriveService } from './google-drive.service';
export declare class GoogleDriveController {
    private readonly googleDriveService;
    constructor(googleDriveService: GoogleDriveService);
    listFiles(folderId: string): Promise<{
        files: import("./interfaces/drive-file.interface").DriveFile[];
    }>;
    proxyFile(fileId: string, res: Response): Promise<void>;
    getMetadata(fileId: string): Promise<import("./interfaces/drive-file.interface").DriveFile>;
}
