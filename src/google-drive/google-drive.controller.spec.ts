import { GoogleDriveController } from './google-drive.controller';
import { GoogleDriveService } from './google-drive.service';

describe('GoogleDriveController', () => {
  let controller: GoogleDriveController;
  let googleDriveService: {
    getFileStream: jest.Mock;
    listFiles: jest.Mock;
  };

  const createResponse = () => {
    const set = jest.fn();
    const pipe = jest.fn();

    return {
      res: { set } as unknown as Parameters<GoogleDriveController['proxyFile']>[1],
      set,
      pipe,
      stream: { pipe },
    };
  };

  beforeEach(() => {
    googleDriveService = {
      getFileStream: jest.fn(),
      listFiles: jest.fn(),
    };

    controller = new GoogleDriveController(
      googleDriveService as unknown as GoogleDriveService,
    );
  });

  it('sets inline disposition for proxy responses by default', async () => {
    const { res, set, pipe, stream } = createResponse();
    googleDriveService.getFileStream.mockResolvedValue({
      stream,
      mimeType: 'image/jpeg',
      fileName: 'summer photo.jpg',
    });

    await controller.proxyFile('file-123', res);

    expect(googleDriveService.getFileStream).toHaveBeenCalledWith('file-123', {});
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Disposition':
          'inline; filename="summer photo.jpg"; filename*=UTF-8\'\'summer%20photo.jpg',
      }),
    );
    expect(pipe).toHaveBeenCalledWith(res);
  });

  it('passes cache context query params to the proxy service', async () => {
    const { res, set, stream } = createResponse();
    googleDriveService.getFileStream.mockResolvedValue({
      stream,
      mimeType: 'image/jpeg',
      fileName: 'summer photo.jpg',
    });

    await controller.proxyFile(
      'file-123',
      res,
      '1',
      'folder-123',
      'Summer Album',
      'summer photo.jpg',
      'image/jpeg',
    );

    expect(googleDriveService.getFileStream).toHaveBeenCalledWith('file-123', {
      folderId: 'folder-123',
      folderName: 'Summer Album',
      fileName: 'summer photo.jpg',
      mimeType: 'image/jpeg',
    });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Disposition':
          'attachment; filename="summer photo.jpg"; filename*=UTF-8\'\'summer%20photo.jpg',
      }),
    );
  });

  it.each(['1', 'true', 'yes'])(
    'sets attachment disposition when download mode is %s',
    async (download) => {
      const { res, set, stream } = createResponse();
      googleDriveService.getFileStream.mockResolvedValue({
        stream,
        mimeType: 'image/jpeg',
        fileName: 'summer photo.jpg',
      });

      await controller.proxyFile('file-123', res, download);

      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Disposition':
            'attachment; filename="summer photo.jpg"; filename*=UTF-8\'\'summer%20photo.jpg',
        }),
      );
    },
  );

  it.each(['0', 'false', 'random'])(
    'keeps inline disposition when download mode is %s',
    async (download) => {
      const { res, set, stream } = createResponse();
      googleDriveService.getFileStream.mockResolvedValue({
        stream,
        mimeType: 'image/jpeg',
        fileName: 'summer photo.jpg',
      });

      await controller.proxyFile('file-123', res, download);

      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Disposition':
            'inline; filename="summer photo.jpg"; filename*=UTF-8\'\'summer%20photo.jpg',
        }),
      );
    },
  );

  it('sanitizes unsafe filename characters in content disposition', async () => {
    const { res, set, stream } = createResponse();
    googleDriveService.getFileStream.mockResolvedValue({
      stream,
      mimeType: 'image/jpeg',
      fileName: 'bad"\r\nname.jpg',
    });

    await controller.proxyFile('file-123', res, '1');

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        'Content-Disposition':
          'attachment; filename="badname.jpg"; filename*=UTF-8\'\'badname.jpg',
      }),
    );
  });
});
