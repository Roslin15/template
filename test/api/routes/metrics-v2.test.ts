import { InternalError } from '@symposium/usage-common';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { postMetrics, postMetricsV2 } from '../../../src/api/routes/metrics-v2';
import { UploadService } from '../../../src/services/uploads';

jest.mock('../../../src/api/middlewares/multer-upload');

jest.mock('../../../src/services/uploads');
const MockedUploadService = UploadService as jest.MockedClass<typeof UploadService>;

describe('handle postMetrics V2 Gzip', () => {
  const mockReq = {} as Request;
  const mockRes = {} as Response;
  const mockNext = jest.fn();

  const happyResponse = {
    requestId: 'test-req-1',
    correlationId: 'test-correlation-1',
  };

  beforeEach(() => {
    mockReq.headers = {};
    mockRes.locals = {};

    MockedUploadService.mockImplementation(() => {
      return {
        verifyGzip: jest.fn(),
        processV2Upload: jest.fn().mockResolvedValue(happyResponse),
        saveUserResponseReturned: jest.fn().mockRejectedValue(true),
      } as unknown as UploadService;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.restoreAllMocks();
  });

  test('Post metrics', () => {
    expect(postMetrics instanceof Array).toBe(true);
  });

  test('Missing rhmAccountId in header and tokenIamId in local', async () => {
    await postMetricsV2(mockReq, mockRes, mockNext);
    expect(mockNext).toBeCalledWith(expect.any(InternalError));
  });

  test('Missing rhmAccountId in header but has tokenIamId in local', async () => {
    const status = jest.fn();
    const json = jest.fn();

    const getMockResp = () => {
      const res = {} as Response;
      res.locals = { tokenIamId: 'iamId1' };
      res.status = status.mockReturnValue(res);
      res.json = json;
      return res;
    };

    const mockResp = getMockResp();

    await postMetricsV2(mockReq, mockResp, mockNext);
    expect(status).toBeCalledWith(StatusCodes.ACCEPTED);
    expect(json).toBeCalledWith(happyResponse);
  });
});
