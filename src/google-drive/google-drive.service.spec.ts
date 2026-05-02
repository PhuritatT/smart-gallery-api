import { ConfigService } from '@nestjs/config';
import { GoogleDriveService } from './google-drive.service';

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;

    service = new GoogleDriveService({
      get: jest.fn().mockReturnValue('test-api-key'),
    } as unknown as ConfigService);
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
});
