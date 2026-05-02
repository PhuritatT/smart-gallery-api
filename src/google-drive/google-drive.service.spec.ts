import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { DriveImageCacheService } from './drive-image-cache.service';
import { GoogleDriveService } from './google-drive.service';

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;
  let fetchMock: jest.Mock;
  let cacheService: {
    isEnabled: jest.Mock;
    getCacheKey: jest.Mock;
    getCachedImage: jest.Mock;
    exists: jest.Mock;
    uploadStream: jest.Mock;
  };

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    cacheService = {
      isEnabled: jest.fn().mockReturnValue(false),
      getCacheKey: jest.fn().mockReturnValue('images-cache/summer-album-folder-123/file-123-photo.jpg'),
      getCachedImage: jest.fn(),
      exists: jest.fn(),
      uploadStream: jest.fn().mockResolvedValue(undefined),
    };

    service = new GoogleDriveService({
      get: jest.fn().mockReturnValue('test-api-key'),
    } as unknown as ConfigService, cacheService as unknown as DriveImageCacheService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws a readable download error when Google returns non-JSON HTML', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'file-123',
            name: 'photo.jpg',
            mimeType: 'image/jpeg',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response('<html><head><title>Forbidden</title></head></html>', {
          status: 403,
          headers: { 'Content-Type': 'text/html' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('<html><head><title>Forbidden</title></head></html>', {
          status: 403,
          headers: { 'Content-Type': 'text/html' },
        }),
      );

    await expect(service.getFileStream('file-123')).rejects.toThrow(
      'Google Drive download failed (403)',
    );
  });

  it('falls back to direct Google download when Drive API media returns HTML', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'file-123',
            name: 'photo.jpg',
            mimeType: 'image/jpeg',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response('<html><head><title>Forbidden</title></head></html>', {
          status: 403,
          headers: { 'Content-Type': 'text/html' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('image-bytes', {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        }),
      );

    const result = await service.getFileStream('file-123');

    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://drive.google.com/uc?export=download&id=file-123',
    );
    expect(result.fileName).toBe('photo.jpg');
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('uses cached R2 image when cache context is available', async () => {
    const cachedStream = Readable.from(['cached-image']);
    cacheService.isEnabled.mockReturnValue(true);
    cacheService.getCachedImage.mockResolvedValue({
      stream: cachedStream,
      mimeType: 'image/jpeg',
      fileName: 'photo.jpg',
    });

    const result = await service.getFileStream('file-123', {
      folderId: 'folder-123',
      folderName: 'Summer Album',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(cacheService.getCacheKey).toHaveBeenCalledWith({
      folderId: 'folder-123',
      folderName: 'Summer Album',
      fileId: 'file-123',
      fileName: 'photo.jpg',
    });
    expect(cacheService.getCachedImage).toHaveBeenCalledWith(
      'images-cache/summer-album-folder-123/file-123-photo.jpg',
    );
    expect(result.stream).toBe(cachedStream);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.fileName).toBe('photo.jpg');
  });

  it('falls back to Google Drive when R2 cache is disabled', async () => {
    cacheService.isEnabled.mockReturnValue(false);
    fetchMock.mockResolvedValueOnce(
      new Response('image-bytes', {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      }),
    );

    const result = await service.getFileStream('file-123', {
      folderId: 'folder-123',
      folderName: 'Summer Album',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
    });

    expect(cacheService.getCachedImage).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://www.googleapis.com/drive/v3/files/file-123?alt=media&key=test-api-key',
    );
    expect(result.fileName).toBe('photo.jpg');
    expect(result.mimeType).toBe('image/jpeg');
  });

  it('uploads Google Drive media to R2 when cache misses', async () => {
    cacheService.isEnabled.mockReturnValue(true);
    cacheService.getCachedImage.mockResolvedValue(null);
    fetchMock.mockResolvedValueOnce(
      new Response('image-bytes', {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg' },
      }),
    );

    const result = await service.getFileStream('file-123', {
      folderId: 'folder-123',
      folderName: 'Summer Album',
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
    });

    expect(result.fileName).toBe('photo.jpg');
    expect(cacheService.uploadStream).toHaveBeenCalledWith(
      'images-cache/summer-album-folder-123/file-123-photo.jpg',
      expect.any(Readable),
      'image/jpeg',
      'photo.jpg',
    );
  });

  it('starts background R2 prewarm after listing files', async () => {
    cacheService.isEnabled.mockReturnValue(true);
    cacheService.exists.mockResolvedValue(false);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            files: [
              {
                id: 'file-123',
                name: 'photo.jpg',
                mimeType: 'image/jpeg',
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ name: 'Summer Album' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response('image-bytes', {
          status: 200,
          headers: { 'Content-Type': 'image/jpeg' },
        }),
      );

    const result = await service.listFiles('folder-123');
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(result).toEqual([
      {
        id: 'file-123',
        name: 'photo.jpg',
        mimeType: 'image/jpeg',
      },
    ]);
    expect(cacheService.exists).toHaveBeenCalledWith(
      'images-cache/summer-album-folder-123/file-123-photo.jpg',
    );
    expect(cacheService.uploadStream).toHaveBeenCalledWith(
      'images-cache/summer-album-folder-123/file-123-photo.jpg',
      expect.any(Readable),
      'image/jpeg',
      'photo.jpg',
    );
  });
});
