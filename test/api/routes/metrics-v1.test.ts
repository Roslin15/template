import { postMetricsV1 } from '../../../src/api/routes/metrics-v1';
import { Request, Response } from 'express';
import { UploadService } from '../../../src/services/uploads';
import { StatusCodes } from 'http-status-codes';
import { StorageError } from '@symposium/usage-common';

jest.mock('../../../src/loaders/feature-flags-loader', () => ({
  featureFlags: { isEnabled: jest.fn(() => true) },
}));

jest.mock('../../../src/services/uploads');
const MockedUploadService = UploadService as jest.MockedClass<typeof UploadService>;
const mockReq = {} as Request;

beforeEach(() => {
  MockedUploadService.mockClear();
  mockReq.headers = {
    rhmAccountId: 'acct1',
  };
});

describe('handle postMetricsV1', () => {
  const status = jest.fn();
  const json = jest.fn();
  const mockRes = () => {
    const res = {} as Response;
    res.status = status.mockReturnValue(res);
    res.json = json;
    return res;
  };

  mockReq.body = {
    data: [
      {
        eventId: '97d038b0-e6b8-4e0c-8841-857b5ca1348c',
        start: 1645784764000,
        end: 1645784864000,
        additionalAttributes: {
          productName: 'IBM Cloud Pak for Integration',
          productType: 'cloudPak',
          source: 'LS',
        },
        measuredUsage: [
          {
            metricId: 'VIRTUAL_PROCESSOR_CORE',
            value: 20,
            additionalAttributes: {},
          },
        ],
      },
    ],
  };
  const saveUserResponseReturnedMock = jest.fn();
  const processV1UploadMock = jest.fn();
  MockedUploadService.mockImplementation(() => {
    return {
      gzipV1Data: jest.fn(),
      processV1Upload: processV1UploadMock,
      saveUserResponseReturned: saveUserResponseReturnedMock,
    } as unknown as UploadService;
  });

  test('handle postMetricsV1 - returns 202, saves that we sent the user response', async () => {
    processV1UploadMock.mockReturnValueOnce({ httpCode: 202 });
    await postMetricsV1(mockReq, mockRes());
    expect(MockedUploadService).toBeCalled();
    expect(processV1UploadMock).toBeCalled();
    expect(status).toBeCalledWith(StatusCodes.ACCEPTED);
    expect(saveUserResponseReturnedMock).toBeCalled();
  });

  test('handle postMetricsV1 - failed with Invalid Request Error', async () => {
    processV1UploadMock.mockRejectedValueOnce(new StorageError('mock error'));
    await postMetricsV1(mockReq, mockRes());
    expect(MockedUploadService).toBeCalled();
    expect(json).toBeCalledWith({
      errorCode: 'storage_error',
      message: 'mock error',
      status: 'failed',
    });
  });

  test('handle postMetricsV1 - failed with Unknown Error', async () => {
    processV1UploadMock.mockRejectedValueOnce(new Error('mock error 2'));
    await postMetricsV1(mockReq, mockRes());
    expect(MockedUploadService).toBeCalled();
    expect(json).toBeCalledWith({
      errorCode: 'unknown_error_code',
      message: 'mock error 2',
      status: 'failed',
    });
  });

  test('handle postMetricsV1 - failed with GenericUserError', async () => {
    mockReq.body = {};
    await postMetricsV1(mockReq, mockRes());
    expect(MockedUploadService).toBeCalled();
    expect(json).toBeCalledWith({
      errorCode: 'invalid_format',
      message: 'Data array must be present in request body',
      status: 'failed',
    });
  });
});
