export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    thumbnailLink?: string;
    webContentLink?: string;
}
export interface DriveListResponse {
    files: DriveFile[];
    nextPageToken?: string;
}
