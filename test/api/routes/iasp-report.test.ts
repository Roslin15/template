import { getIaspReport, receiveIaspReport } from '../../../src/api/routes/iasp-report';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { featureFlags } from '../../../src/loaders/feature-flags-loader';
import { UploadService } from '../../../src/services/uploads';
import { InvalidRequestError, NotFound } from '@symposium/usage-common';
import { DownloadService } from '../../../src/services/download-service';

jest.mock('../../../src/api/middlewares/multer-upload');

jest.mock('../../../src/services/uploads');
const MockedUploadService = UploadService as jest.MockedClass<typeof UploadService>;

jest.mock('../../../src/services/download-service');
const MockedDownloadService = DownloadService as jest.MockedClass<typeof DownloadService>;

jest.mock('../../../src/loaders/feature-flags-loader', () => ({
  featureFlags: { isEnabled: jest.fn(() => true) },
}));

const mockIsEnabled = jest.fn().mockResolvedValue(true);
featureFlags.isEnabled = mockIsEnabled;

describe('test metrics iasp route', () => {
  let mockReq: Request;
  let mockRes: Response;
  const mockNext = jest.fn();
  const mockReceiveIaspReport = jest.fn();
  const mockGetIaspFromCos = jest.fn();

  const happyResponse = {
    requestId: 'test-req-1',
    correlationId: 'test-correlation-1',
  };

  beforeEach(() => {
    mockReq = {
      query: {
        accountId: 'account',
      },
      params: {
        reportUrn: '10',
      },
    } as unknown as Request;
    mockRes = {} as Response;

    MockedUploadService.mockImplementation(() => {
      return {
        verifyXlxs: jest.fn(),
        processIaspUpload: mockReceiveIaspReport.mockResolvedValue(happyResponse),
        saveUserResponseReturned: jest.fn().mockRejectedValue(true),
      } as unknown as UploadService;
    });

    MockedDownloadService.mockImplementation(() => {
      return {
        getIaspFromCos: mockGetIaspFromCos.mockResolvedValue(Buffer.from('mockIasp')),
      } as unknown as DownloadService;
    });
  });

  describe('getIaspReport', () => {
    test('Happy path', async () => {
      const mockSend = jest.fn();
      mockRes.status = jest.fn().mockReturnValue({ send: mockSend });
      await getIaspReport(mockReq, mockRes, mockNext);
      expect(MockedDownloadService).toBeCalledWith(10, 'account');
      expect(mockGetIaspFromCos).toBeCalled();
      expect(mockRes.status).toBeCalledWith(StatusCodes.OK);
      expect(mockSend).toBeCalledWith(Buffer.from('mockIasp'));
    });

    test('Error path', async () => {
      const mockError = new NotFound('mockError');
      mockGetIaspFromCos.mockRejectedValueOnce(mockError);
      await getIaspReport(mockReq, mockRes, mockNext);
      expect(MockedDownloadService).toBeCalledWith(10, 'account');
      expect(mockGetIaspFromCos).toBeCalled();
      expect(mockNext).toBeCalledWith(mockError);
    });

    test('Error path - when non numeric report urn is passed', async () => {
      const mockError = new InvalidRequestError('reportUrn must be numeric value');
      mockReq.params['reportUrn'] = 'sample-invalid';
      await getIaspReport(mockReq, mockRes, mockNext);
      expect(MockedDownloadService).not.toBeCalled();
      expect(mockNext).toBeCalledWith(mockError);
    });

    test('Error path - accountId must be present when reportUrn is other than template', async () => {
      const mockError = new InvalidRequestError('accountId must be passed as queryParam');
      mockReq.query.accountId = undefined;
      mockReq.params['reportUrn'] = '10';
      await getIaspReport(mockReq, mockRes, mockNext);
      expect(MockedDownloadService).not.toBeCalled();
      expect(mockNext).toBeCalledWith(mockError);
    });
  });

  describe('post', () => {
    test('Post report IASP', async () => {
      const mockJson = jest.fn();
      const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
      mockRes = {
        status: mockStatus,
      } as unknown as Response;
      await receiveIaspReport(mockReq, mockRes, mockNext);
      expect(mockStatus).toBeCalledWith(StatusCodes.ACCEPTED);
      expect(mockJson).toBeCalledWith(happyResponse);
    });

    test('Post report IASP gets error', async () => {
      const mockStatus = jest.fn();
      mockRes = {
        status: mockStatus,
      } as unknown as Response;
      mockReceiveIaspReport.mockRejectedValueOnce(new Error());
      await receiveIaspReport(mockReq, mockRes, mockNext);
      expect(mockStatus).not.toBeCalled();
      expect(mockNext).toBeCalled();
    });
  });
});
