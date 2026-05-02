import { ConfigService } from '@nestjs/config';
import { DriveImageCacheService } from './drive-image-cache.service';

describe('DriveImageCacheService', () => {
  const createService = (env: Record<string, string | undefined> = {}) =>
    new DriveImageCacheService({
      get: jest.fn((key: string) => env[key]),
    } as unknown as ConfigService);

  it('is disabled when R2 config is incomplete', () => {
    const service = createService({
      R2_ENDPOINT: 'https://example.r2.cloudflarestorage.com',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_BUCKET_NAME: 'bucket',
    });

    expect(service.isEnabled()).toBe(false);
  });

  it('builds sanitized cache keys under images-cache', () => {
    const service = createService();

    expect(
      service.getCacheKey({
        folderId: 'folder_123',
        folderName: 'Summer Album / 2026',
        fileId: 'file-123',
        fileName: 'bad"\r\nname photo.jpg',
      }),
    ).toBe('images-cache/summer-album-2026-folder_123/file-123-badname-photo.jpg');
  });
});
