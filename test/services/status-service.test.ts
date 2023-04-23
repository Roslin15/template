import { StatusService, V1Response, V1RequestStatus } from '../../src/services/status-service';
import { UsageEvent, Status, RequestTypes, logger, StatusStates } from '@symposium/usage-common';
import { statusHandlerInstance } from '../../src/loaders/status-loader';
import fs from 'fs';
import path from 'path';
import * as testConfig from '../../src/config/config';
const validFile = fs.readFileSync(path.join(__dirname, '../mocks', '/sample_data.tar.gz'));
const mockDownloadFile = jest.fn().mockResolvedValue(validFile);
jest.mock('../../src/services/cos-service', () => ({
  CosService: jest.fn(() => ({ uploadFile: jest.fn(), downloadFile: mockDownloadFile })),
}));

describe('Status Service', () => {
  let statusService: StatusService;
  let testUsage: UsageEvent['usage'];
  let testStatus: Status;
  let v1PostResponse: V1Response;

  const fakeEnv = {
    ARCHIVE_BUCKET: 'archive_bucket',
    INCOMING_MESSAGE_QUEUE_BUCKET: 'incoming_mq_bucket',
  } as testConfig.ConfigSettings;

  jest.mock('../../src/loaders/cos-loader');

  jest.spyOn(testConfig, 'getConfig').mockReturnValue(fakeEnv);

  beforeEach(() => {
    statusService = new StatusService('123e4567-e89b-12d3-a456-556642440000', 'account-1');

    testStatus = {
      id: 'mockId',
      correlationId: '123e4567-e89b-12d3-a456-556642440000',
      requestId: '00575a954160901776457cee785a4bcecc1506ffefcef5388a61827e22f8c0d1',
      accountId: 'account-1',
      accountOrPrefix: 'account-1',
      requestType: RequestTypes.V1_METRICS,
      inputFileName: 'sample_data.tar.gz',
      startTime: 0,
      replayAttempt: 0,
      authMethod: 'rhmAccount',
    };

    testUsage = {
      eventId: 'eventId',
      accountId: 'accountId',
      start: 0,
      end: 1,
      measuredUsage: [{ metricId: '1', value: 1 }],
    };

    v1PostResponse = {
      data: [
        {
          batchId: '123e4567-e89b-12d3-a456-556642440000',
          payload: testUsage,
          status: 'inprogress',
        },
      ],
      message: 'One or more events are in progress or failed to process.',
      status: 'inprogress',
    };
  });

  afterAll(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.restoreAllMocks();
  });

  describe('StatusService getRequestStatusByCorrelationIdOrRequestId', () => {
    test('Get Status by CorrelationI Id happy path', async () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      statusHandlerInstance.getByCorrelationId = jest.fn().mockReturnValue(testStatus);
      statusHandlerInstance.getByRequestId = jest.fn().mockReturnValue(false);
      statusService = new StatusService('123e4567-e89b-12d3-a456-556642440000');
      await statusService.getRequestStatusByCorrelationIdOrRequestId();
      expect(statusHandlerInstance.getByCorrelationId).toHaveBeenCalled();
      expect(statusHandlerInstance.getByRequestId).not.toHaveBeenCalled();
      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(debugSpy).toBeCalledWith(
        `StatusService getRequestStatusByCorrelationIdOrRequestId getting status by Correlation Id ${testStatus.correlationId}`
      );
      expect(statusService.correlationId).toBeDefined();
      expect(statusService?.requestId).toEqual(testStatus.requestId);
    });

    test('Get Status by Request Id happy path', async () => {
      const debugSpy = jest.spyOn(logger, 'debug');
      statusHandlerInstance.getByRequestId = jest.fn().mockReturnValue(testStatus);
      statusService = new StatusService('00575a954160901776457cee785a4bcecc1506ffefcef5388a61827e22f8c0d1');
      await statusService.getRequestStatusByCorrelationIdOrRequestId();
      expect(statusHandlerInstance.getByCorrelationId).not.toHaveBeenCalled();
      expect(statusHandlerInstance.getByRequestId).toHaveBeenCalled();
      expect(debugSpy).toHaveBeenCalledTimes(1);
      expect(debugSpy).toBeCalledWith(
        `StatusService getRequestStatusByCorrelationIdOrRequestId getting status by Request Id ${testStatus.requestId}`
      );
      expect(statusService.requestId).toBeDefined();
      expect(statusService?.correlationId).toEqual(testStatus.correlationId);
    });

    test('calls next middleware with error when getUsageEventsByRequestId throws an error', async () => {
      const errorSpy = jest.spyOn(logger, 'error');
      statusHandlerInstance.getByCorrelationId = jest.fn().mockRejectedValueOnce(new Error('mock error'));
      await expect(statusService.getRequestStatusByCorrelationIdOrRequestId()).rejects.toBeInstanceOf(Error);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toBeCalledWith(
        `StatusService getRequestStatusByCorrelationIdOrRequestId failed ${new Error('mock error')}`
      );
    });
  });

  describe('StatusService getUsageEventsFromCos', () => {
    test('call returns usageEvents happy path', async () => {
      statusService.getRequestStatusByCorrelationIdOrRequestId = jest.fn().mockResolvedValue(testStatus);
      await expect(statusService.getUsageEventsFromCos()).resolves.toBeDefined();
      expect(mockDownloadFile).toBeCalledTimes(1);
      expect(mockDownloadFile).toBeCalledWith('archive_bucket', 'incoming_mq_bucket');
    });

    test('call returns usageEvents happy path (no acountOrPrefix)', async () => {
      statusService.accountOrPrefix = undefined;
      statusService.getRequestStatusByCorrelationIdOrRequestId = jest.fn().mockResolvedValue(testStatus);
      await expect(statusService.getUsageEventsFromCos()).resolves.toBeDefined();
      expect(mockDownloadFile).toBeCalledTimes(1);
    });

    test('calls next middleware with error when getRequestStatusByCorrelationIdOrRequestId throws an Error', async () => {
      statusService.getRequestStatusByCorrelationIdOrRequestId = jest.fn().mockRejectedValue(new Error('mock error'));
      await expect(statusService.getUsageEventsFromCos()).rejects.toBeInstanceOf(Error);
    });

    test('calls next middleware with error when getfileFromCosBucket throws an Error', async () => {
      mockDownloadFile.mockRejectedValue(new Error('mock error'));
      statusService.getRequestStatusByCorrelationIdOrRequestId = jest.fn().mockResolvedValue(testStatus);
      await expect(statusService.getUsageEventsFromCos()).rejects.toBeInstanceOf(Error);
    });
  });

  describe('StatusService commonMetricResponse', () => {
    test('sets finalStatus as accepted when request status is success', async () => {
      v1PostResponse.status = V1RequestStatus.ACCEPTED;
      testStatus.finalResult = StatusStates.SUCCESS;
      statusService.requestStatus = testStatus;
      expect(statusService.commonMetricResponse([testUsage])).toEqual(v1PostResponse);
    });

    test('sets the provided status as provided value when function is called with specific finalStatus', async () => {
      v1PostResponse.status = V1RequestStatus.FAILED;
      expect(statusService.commonMetricResponse([testUsage], V1RequestStatus.FAILED)).toEqual(v1PostResponse);
    });

    test('sets finalStatus to inprogress as default with correlationId', async () => {
      expect(statusService.commonMetricResponse([testUsage])).toEqual(v1PostResponse);
    });

    test('sets finalStatus to inprogress without correlationId', async () => {
      statusService = new StatusService('', 'account-1');
      v1PostResponse.data[0].batchId = '';
      expect(statusService.commonMetricResponse([testUsage])).toEqual(v1PostResponse);
    });

    test('sets finalStatus as failed when request status is userError', async () => {
      v1PostResponse.status = V1RequestStatus.FAILED;
      testStatus.finalResult = StatusStates.USER_ERROR;
      statusService.requestStatus = testStatus;
      expect(statusService.commonMetricResponse([testUsage])).toEqual(v1PostResponse);
    });

    test('sets the final status as failed when usage-event array is empty', async () => {
      v1PostResponse.status = V1RequestStatus.FAILED;
      expect(statusService.commonMetricResponse([], V1RequestStatus.FAILED)).toEqual({
        data: [],
        message: 'One or more events are in progress or failed to process.',
        status: 'failed',
      });
    });

    test('sets the final status as failed when usage-event is undefined', async () => {
      v1PostResponse.status = V1RequestStatus.FAILED;
      expect(statusService.commonMetricResponse(undefined, V1RequestStatus.FAILED)).toEqual({
        data: [],
        message: 'One or more events are in progress or failed to process.',
        status: 'failed',
      });
    });
  });
});
