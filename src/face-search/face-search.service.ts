// Face Search Service - HTTP client for the face-search microservice
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FaceSearchService {
  private readonly logger = new Logger(FaceSearchService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('FACE_SEARCH_URL', '');
    this.apiKey = this.configService.get<string>('FACE_SEARCH_API_KEY', '');

    if (this.baseUrl) {
      this.logger.log(`Face Search service configured: ${this.baseUrl}`);
    } else {
      this.logger.warn('FACE_SEARCH_URL not set — face search feature disabled');
    }
  }

  get isEnabled(): boolean {
    return !!this.baseUrl;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  /**
   * Index faces in a single photo
   */
  async indexPhoto(
    imageBuffer: Buffer,
    fileId: string,
    fileName: string = '',
    folderId: string = '',
  ): Promise<any> {
    if (!this.isEnabled) {
      throw new Error('Face search service is not configured');
    }

    // Use multipart form data
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' });
    formData.append('file', blob, `${fileId}.jpg`);
    formData.append('file_id', fileId);
    formData.append('file_name', fileName);
    formData.append('folder_id', folderId);

    const response = await fetch(`${this.baseUrl}/api/v1/index`, {
      method: 'POST',
      headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Index failed (${response.status}): ${text}`);
      throw new Error(`Face search index failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Search for matching faces in indexed photos
   */
  async searchByFace(imageBuffer: Buffer, threshold?: number): Promise<any> {
    if (!this.isEnabled) {
      throw new Error('Face search service is not configured');
    }

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/jpeg' });
    formData.append('file', blob, 'search.jpg');
    if (threshold !== undefined) {
      formData.append('threshold', String(threshold));
    }

    const response = await fetch(`${this.baseUrl}/api/v1/search`, {
      method: 'POST',
      headers: this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      this.logger.error(`Search failed (${response.status}): ${text}`);
      throw new Error(`Face search failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get face search statistics
   */
  async getStats(): Promise<any> {
    if (!this.isEnabled) {
      return { enabled: false, message: 'Face search not configured' };
    }

    const response = await fetch(`${this.baseUrl}/api/v1/stats`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get face search stats: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Delete a file's face data
   */
  async deleteFile(fileId: string): Promise<any> {
    if (!this.isEnabled) return { status: 'skipped', reason: 'not configured' };

    const response = await fetch(`${this.baseUrl}/api/v1/files/${fileId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete face data: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<any> {
    if (!this.isEnabled) {
      return { status: 'disabled', message: 'Face search not configured' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) return { status: 'unhealthy' };
      return response.json();
    } catch {
      return { status: 'unreachable' };
    }
  }
}
