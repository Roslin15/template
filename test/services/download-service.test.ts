import { NotFound, ServiceUnavailableError, TarImpl } from '@symposium/usage-common';
import { getConfig } from '../../src/config/config';
import { statusHandlerInstance } from '../../src/loaders/status-loader';
import { CosService } from '../../src/services/cos-service';
import { DownloadService } from '../../src/services/download-service';

jest.mock('../../src/services/cos-service');
const MockedCosService = CosService as jest.MockedClass<typeof CosService>;

describe('DownloadService', () => {
  let downloadService: DownloadService;

  beforeEach(() => {
    downloadService = new DownloadService(1, 'accountId');
  });
  test('constructor', () => {
    expect(downloadService).toBeInstanceOf(DownloadService);
    expect(downloadService.reportUrn).toEqual(1);
    expect(downloadService.accountId).toEqual('accountId');
    expect(downloadService.logObject).toMatchObject({ reportUrn: 1, accountId: 'accountId' });
  });

  describe('getIaspCosFileName', () => {
    test('Gets IASP COS file name from latest request status for that reportUrn and accountId', async () => {
      statusHandlerInstance.getManyStatuses = jest.fn().mockResolvedValue([
        { startTime: 2, requestId: '2' },
        { startTime: 1, requestId: '1' },
      ]);
      await expect(downloadService.getIaspCosFileName()).resolves.toEqual('2');
      expect(statusHandlerInstance.getManyStatuses).toBeCalledWith(
        { 'requestMetadata.reportUrn': 1, eventId: { $exists: false } },
        'accountId'
      );
    });

    test('Throws NotFound when no statuses found', async () => {
      statusHandlerInstance.getManyStatuses = jest.fn().mockResolvedValue([]);
      await expect(downloadService.getIaspCosFileName()).rejects.toBeInstanceOf(NotFound);
    });
  });

  describe('getIaspFromCos', () => {
    const mockDownloadFile = jest.fn();
    const mockExpandArchive = jest.fn();
    beforeEach(() => {
      TarImpl.prototype.expandArchive = mockExpandArchive;
      MockedCosService.mockImplementation(() => {
        return {
          downloadFile: mockDownloadFile,
        } as unknown as CosService;
      });
    });

    test('Uses CosService to download IASP file', async () => {
      const mockIaspFile = Buffer.from('mockIaspFile');
      mockDownloadFile.mockResolvedValueOnce(mockIaspFile);
      downloadService.getIaspCosFileName = jest.fn().mockResolvedValueOnce('mockIaspFile');
      mockExpandArchive.mockResolvedValue({ 'mockIaspFile.xlsx': mockIaspFile });
      await expect(downloadService.getIaspFromCos()).resolves.toEqual(mockIaspFile);
      expect(downloadService.getIaspCosFileName).toBeCalled();
      expect(CosService).toBeCalledWith(
        'mockIaspFile.tar.gz',
        'accountId',
        expect.objectContaining({ reportUrn: 1, accountId: 'accountId' })
      );
      expect(mockDownloadFile).toBeCalledWith(
        getConfig().IASP_ARCHIVE_BUCKET,
        getConfig().INCOMING_MESSAGE_QUEUE_BUCKET
      );
    });

    test('should use hardcoded file name when reporturn is template', async () => {
      const mockIaspFile = Buffer.from('mockIaspFile');
      mockDownloadFile.mockRejectedValueOnce(new NotFound('not found')).mockResolvedValueOnce(mockIaspFile);
      downloadService.getIaspCosFileName = jest.fn().mockResolvedValueOnce('mockIaspFile');
      mockExpandArchive.mockResolvedValue({ 'mockIaspFile.xlsx': mockIaspFile });
      downloadService.reportUrn = 'template';
      downloadService.accountId = undefined;
      await expect(downloadService.getIaspFromCos()).resolves.toEqual(mockIaspFile);
      expect(downloadService.getIaspCosFileName).not.toBeCalled();
      expect(CosService).toBeCalledWith(
        'ELP-IASP-Template-v2.1.tar.gz',
        undefined,
        expect.objectContaining({ reportUrn: 1, accountId: 'accountId' })
      );
      expect(mockDownloadFile).toBeCalledWith(
        getConfig().IASP_ARCHIVE_BUCKET,
        getConfig().INCOMING_MESSAGE_QUEUE_BUCKET
      );
    });

    test('handles error other than NotFound when searching for the tar.gz first', async () => {
      const mockError = new ServiceUnavailableError('mockError');
      downloadService.getIaspCosFileName = jest.fn().mockResolvedValue('testFile');
      mockDownloadFile.mockRejectedValueOnce(mockError);
      await expect(downloadService.getIaspFromCos()).rejects.toThrow(mockError);
    });

    test('Gets error', async () => {
      const mockError = new NotFound('mockError');
      downloadService.getIaspCosFileName = jest.fn().mockRejectedValueOnce(mockError);
      await expect(downloadService.getIaspFromCos()).rejects.toThrow(mockError);
    });
  });
});
