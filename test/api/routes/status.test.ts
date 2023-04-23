import {
  canViewStatus,
  getUploadStatus,
  getV1MetricsService,
  getStatusServiceByCorrelationId,
  getStatusServiceByRequestId,
  getStatusServiceByUsageEventId,
  getAbortedStatus,
  censorStatus,
} from '../../../src/api/routes/status';
import { statusHandlerInstance } from '../../../src/loaders/status-loader';
import { Request, Response } from 'express';
import {
  InternalError,
  InvalidRequestError,
  logger,
  NotFound,
  RequestTypes,
  Status,
  StatusActions,
  StatusStates,
  UsageEvent,
} from '@symposium/usage-common';
import { StatusCodes } from 'http-status-codes';
import { StatusService, V1Response } from '../../../src/services/status-service';
import { ActualStatus, StatusRequestResponse, UsageEventResponse } from '../../../src/services/actual-status';

jest.mock('../../../src/services/status-service');
const MockedStatusServices = StatusService as jest.MockedClass<typeof StatusService>;

jest.mock('../../../src/services/actual-status');
const MockedActualStatus = ActualStatus as jest.MockedClass<typeof ActualStatus>;

describe('status', () => {
  const status = jest.fn();
  const json = jest.fn();

  const mockReq = {} as Request;
  const mockResBuilder = () => {
    const res = {} as Response;
    res.status = status.mockReturnValue(res);
    res.json = json;
    res.locals = {};
    return res;
  };
  const mockRes = mockResBuilder();
  const mockNext = jest.fn();

  describe('Get upload status', () => {
    let getRequestStatusByCorrelationIdOrRequestIdMocked = jest.fn();
    let correlationIdMocked: string;
    let requestIdMocked: string;

    beforeEach(() => {
      mockReq.params = {
        id: 'mock-id',
      };
      mockReq.headers = {
        rhmAccountId: 'acct1',
      };
      mockReq.query = {};
      MockedStatusServices.mockClear();
      MockedStatusServices.mockImplementation(() => {
        return {
          getRequestStatusByCorrelationIdOrRequestId: getRequestStatusByCorrelationIdOrRequestIdMocked,
          accountId: 'acct1',
          correlationId: correlationIdMocked,
          requestId: requestIdMocked,
        } as unknown as StatusService;
      });
    });
    afterAll(() => {
      jest.clearAllMocks();
    });

    test('Happy path for upload status', async () => {
      getRequestStatusByCorrelationIdOrRequestIdMocked = jest
        .fn()
        .mockReturnValue({ finalResult: StatusStates.SUCCESS, accountId: 'acct1' });
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(expect.objectContaining({ status: 'success', message: 'success' }));
    });

    test('Happy path for upload status with detailed obj', async () => {
      mockReq.query.detailed = 'true';
      mockReq.headers['is-super-user'] = 'true';
      requestIdMocked = 'mock-id';
      const mockConsolidatedStatus = { finalResult: StatusStates.SUCCESS, statusSteps: [], accountId: 'acct1' };
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockResolvedValue(mockConsolidatedStatus);
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(
        expect.objectContaining({ status: 'success', message: 'success', detailed: mockConsolidatedStatus })
      );
    });

    test('Non-super-user cannot see detailed obj', async () => {
      mockReq.query.detailed = 'true';
      mockReq.headers['is-super-user'] = 'false';
      requestIdMocked = 'mock-id';
      const mockConsolidatedStatus = { finalResult: StatusStates.SUCCESS, statusSteps: [], accountId: 'acct1' };
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockResolvedValue(mockConsolidatedStatus);
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(expect.objectContaining({ status: 'success', message: 'success' }));
    });

    test('set accountId from token', async () => {
      mockReq.headers['is-super-user'] = undefined;
      mockReq.headers.rhmAccountId = 'acct1';
      mockReq.params.accountOrPrefix = 'acct2';
      getRequestStatusByCorrelationIdOrRequestIdMocked = jest
        .fn()
        .mockReturnValue({ finalResult: StatusStates.SUCCESS });
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(getRequestStatusByCorrelationIdOrRequestIdMocked).toBeCalled();
    });

    test('SuperUser sets accountId from query param', async () => {
      mockReq.headers['is-super-user'] = 'true';
      mockReq.headers.rhmAccountId = 'acct1';
      mockReq.query.accountOrPrefix = 'acct2';
      getRequestStatusByCorrelationIdOrRequestIdMocked = jest
        .fn()
        .mockReturnValue({ finalResult: StatusStates.SUCCESS });
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(expect.objectContaining({ status: 'success', message: 'success' }));
    });

    test('Vendor uses tokenIamId and no accountId ', async () => {
      mockReq.headers['is-super-user'] = undefined;
      mockRes.locals.tokenIamId = 'iamId1';
      mockReq.headers.rhmAccountId = undefined;
      getRequestStatusByCorrelationIdOrRequestIdMocked = jest
        .fn()
        .mockReturnValue({ finalResult: StatusStates.SUCCESS });
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(getRequestStatusByCorrelationIdOrRequestIdMocked).toBeCalled();
    });

    test('Superuser but doesnt set accountOrPrefix', async () => {
      mockReq.headers['is-super-user'] = 'true';
      mockReq.headers.rhmAccountId = undefined;
      mockReq.query.accountOrPrefix = undefined;
      mockRes.locals.tokenIamId = 'superuser';
      getRequestStatusByCorrelationIdOrRequestIdMocked = jest
        .fn()
        .mockReturnValue({ finalResult: StatusStates.SUCCESS });
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(expect.objectContaining({ status: 'success', message: 'success' }));
    });

    test('returns upload status inprogress for no finalResult', async () => {
      getRequestStatusByCorrelationIdOrRequestIdMocked = jest.fn().mockResolvedValue({ accountId: 'acct1' });
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(expect.objectContaining({ status: 'inprogress', message: 'inprogress' }));
    });

    test('returns upload status inprogress for aborted', async () => {
      getRequestStatusByCorrelationIdOrRequestIdMocked = jest
        .fn()
        .mockResolvedValue({ finalResult: StatusStates.ABORTED, accountId: 'acct1' });
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(expect.objectContaining({ status: 'inprogress', message: 'inprogress' }));
    });

    test('returns upload status inprogress for system error', async () => {
      getRequestStatusByCorrelationIdOrRequestIdMocked = jest
        .fn()
        .mockResolvedValue({ finalResult: StatusStates.SYSTEM_ERROR, accountId: 'acct1' });
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(expect.objectContaining({ status: 'inprogress', message: 'inprogress' }));
    });

    test('returns upload status failed for user error', async () => {
      const result = {
        finalResult: StatusStates.USER_ERROR,
        errorResponseMessage: 'mock error',
        errorCode: 'invalid_request',
        accountId: 'acct1',
      };
      getRequestStatusByCorrelationIdOrRequestIdMocked = jest.fn().mockResolvedValue(result);
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(
        expect.objectContaining({
          status: 'failed',
          message: `${result.finalResult}: ${result.errorResponseMessage}`,
          errorCode: result.errorCode,
        })
      );
    });

    test('returns upload status failed for user error with no errorResponseMessage', async () => {
      const result = {
        finalResult: StatusStates.USER_ERROR,
        errorCode: 'invalid_request',
        accountId: 'acct1',
      };
      getRequestStatusByCorrelationIdOrRequestIdMocked = jest.fn().mockResolvedValue(result);
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(
        expect.objectContaining({
          status: 'failed',
          message: `${result.finalResult}`,
          errorCode: result.errorCode,
        })
      );
    });

    test('calls next middleware with NotFound error when requester accountId does not match status accountId', async () => {
      const warnSpy = jest.spyOn(logger, 'warn');
      getRequestStatusByCorrelationIdOrRequestIdMocked = jest.fn().mockResolvedValue({ accountId: 'mock status id' });
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(warnSpy).toBeCalled();
      expect(mockNext).toBeCalledWith(expect.any(NotFound));
    });

    test('calls next middleware with error when getRequestStatusByCorrelationIdOrRequestId throws an error', async () => {
      getRequestStatusByCorrelationIdOrRequestIdMocked = jest.fn().mockRejectedValue(new Error('mock status error'));
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(mockNext).toBeCalledWith(Error('mock status error'));
    });

    test('calls next middleware with InternalError when rhmAccountId is not set in header', async () => {
      delete mockReq.headers.isSuperUser;
      delete mockRes.locals.tokenIamId;
      delete mockReq.headers.rhmAccountId;
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(mockNext).toBeCalledWith(expect.any(InternalError));
    });

    test('Redacts iamIDs in the status', async () => {
      mockReq.query.detailed = 'true';
      mockReq.headers['is-super-user'] = 'true';
      correlationIdMocked = 'mock-id';
      const mockConsolidatedStatus = {
        finalResult: StatusStates.SUCCESS,
        iamId: 'mockIamId',
        statusSteps: [],
        accountId: 'acct1',
      };
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockResolvedValue(mockConsolidatedStatus);
      await getUploadStatus(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(
        expect.objectContaining({
          status: 'success',
          message: 'success',
          detailed: { ...mockConsolidatedStatus, iamId: '***' },
        })
      );
    });
  });

  describe('Get V1 Metrics Service', () => {
    let testUsageEvent: Array<UsageEvent['usage']>;
    let v1Response: V1Response;
    let commonMetricResponseMock = jest.fn();
    let getUsageEventsFromCosMock = jest.fn();

    beforeEach(() => {
      mockReq.params = {
        id: '00575a954160901776457cee785a4bcecc1506ffefcef5388a61827e22f8c0d1',
      };
      mockReq.headers = {
        rhmAccountId: 'acct1',
      };
      mockReq.query = {};

      testUsageEvent = [
        {
          eventId: 'eventId1',
          accountId: 'acct1',
          start: 0,
          end: 1,
          measuredUsage: [{ metricId: '1', value: 1 }],
        },
        {
          eventId: 'eventId2',
          accountId: 'acct1',
          start: 0,
          end: 1,
          measuredUsage: [{ metricId: '2', value: 2 }],
        },
      ];

      v1Response = {
        data: [
          {
            batchId: '123e4567-e89b-12d3-a456-556642440000',
            payload: {
              eventId: 'eventId1',
              accountId: 'acct1',
              start: 0,
              end: 1,
              measuredUsage: [{ metricId: '1', value: 1 }],
            },
            status: 'inprogress',
          },
          {
            batchId: '123e4567-e89b-12d3-a456-556642440000',
            payload: {
              eventId: 'eventId2',
              accountId: 'acct1',
              start: 0,
              end: 1,
              measuredUsage: [{ metricId: '2', value: 2 }],
            },
            status: 'inprogress',
          },
        ],
        message: 'One or more events are in progress or failed to process.',
        status: 'inprogress',
      };

      MockedStatusServices.mockClear();
      MockedStatusServices.mockImplementation(() => {
        return {
          getUsageEventsFromCos: getUsageEventsFromCosMock,
          commonMetricResponse: commonMetricResponseMock,
        } as unknown as StatusService;
      });
    });

    afterAll(() => {
      jest.clearAllMocks();
    });

    test('Get V1 Metrics happy path when SuperUser is set', async () => {
      mockReq.headers['is-super-user'] = 'true';
      mockReq.headers.rhmAccountId = 'acct1';
      mockReq.query.accountOrPrefix = 'acct2';
      getUsageEventsFromCosMock = jest.fn().mockReturnValue(testUsageEvent);
      commonMetricResponseMock = jest.fn().mockResolvedValue(v1Response);
      await getV1MetricsService(mockReq, mockRes);
      expect(status).toBeCalledWith(StatusCodes.ACCEPTED);
    });

    test('Get V1 Metrics happy path when SuperUser is not set', async () => {
      mockReq.headers['is-super-user'] = undefined;
      mockReq.headers.rhmAccountId = 'acct1';
      getUsageEventsFromCosMock = jest.fn().mockReturnValue(testUsageEvent);
      commonMetricResponseMock = jest.fn().mockResolvedValue(v1Response);
      MockedStatusServices.mockImplementation(() => {
        return {
          requestStatus: {
            accountId: 'acct1',
          },
          getUsageEventsFromCos: getUsageEventsFromCosMock,
          commonMetricResponse: commonMetricResponseMock,
        } as unknown as StatusService;
      });
      await getV1MetricsService(mockReq, mockRes);
      expect(status).toBeCalledWith(StatusCodes.ACCEPTED);
    });

    test('Get V1 Metrics vendor who does not have permission', async () => {
      getUsageEventsFromCosMock = jest.fn().mockReturnValue(testUsageEvent);
      MockedStatusServices.mockImplementation(() => {
        return {
          requestStatus: {
            iamId: 'vendor1',
          },
          getUsageEventsFromCos: getUsageEventsFromCosMock,
        } as unknown as StatusService;
      });
      await getV1MetricsService(mockReq, mockRes);
      expect(status).toBeCalledWith(404);
    });

    test('calls commonMetricResponse with failed status when getUsageEventsFromCos results in Notfound error', async () => {
      getUsageEventsFromCosMock = jest.fn().mockRejectedValue(new NotFound('cos bucket mock error'));
      await getV1MetricsService(mockReq, mockRes);
      expect(json).toBeCalledWith({
        errorCode: 'not_found',
        message: 'cos bucket mock error',
        status: 'failed',
      });
    });

    test('calls commonMetricResponse with failed status when getUsageEventsFromCos results in an unknown error', async () => {
      getUsageEventsFromCosMock = jest.fn().mockRejectedValue(new Error('unknown mock error'));
      await getV1MetricsService(mockReq, mockRes);
      expect(json).toBeCalledWith({
        errorCode: 'unknown_error_code',
        message: 'unknown mock error',
        status: 'failed',
      });
    });
  });

  describe('Test can view status', () => {
    it('Can view if superuser', () => {
      const status = {} as unknown as Status;
      const request = { headers: { 'is-super-user': 'true' } } as unknown as Request;
      const response = { locals: {} } as unknown as Response;
      expect(canViewStatus(request, response, status)).toBe(true);
    });

    it('Can view if a normal user with a matching account id', () => {
      const status = { accountId: 'acct1' } as unknown as Status;
      const request = { headers: { rhmAccountId: 'acct1' } } as unknown as Request;
      const response = { locals: {} } as unknown as Response;
      expect(canViewStatus(request, response, status)).toBe(true);
    });

    it('Cannot view if a normal user with a different account id', () => {
      const status = { accountId: 'acct1' } as unknown as Status;
      const request = { headers: { rhmAccountId: 'acct2' } } as unknown as Request;
      const response = { locals: {} } as unknown as Response;
      expect(canViewStatus(request, response, status)).toBe(false);
    });

    it('Can view if a access token with matching iamId', () => {
      const status = { iamId: 'iamId1' } as Status;
      const request = { headers: {} } as unknown as Request;
      const response = { locals: { tokenIamId: 'iamId1', authMethod: 'accessToken' } } as unknown as Response;
      expect(canViewStatus(request, response, status)).toBe(true);
    });

    it('Cannot view if a access token with a different iamId', () => {
      const status = { iamId: 'iamId1' } as Status;
      const request = { headers: {} } as unknown as Request;
      const response = { locals: { iamTokenId: 'iamId2', authMethod: 'accessToken' } } as unknown as Response;
      expect(canViewStatus(request, response, status)).toBe(false);
    });

    it('Defaults to cannot view', () => {
      const status = {} as unknown as Status;
      const request = { headers: {} } as unknown as Request;
      const response = { locals: {} } as unknown as Response;
      expect(canViewStatus(request, response, status)).toBe(false);
    });
  });

  describe('getStatusServiceByCorrelationId', () => {
    let testRequestWithoutDetailedResponse: StatusRequestResponse;
    let getStatusByCorrelationIdMock = jest.fn();

    beforeEach(() => {
      mockReq.params = {
        correlationId: 'correlationId',
      };
      mockReq.headers = {
        rhmAccountId: 'acct1',
      };
      mockReq.query = {};
      testRequestWithoutDetailedResponse = {
        status: {
          requestId: 'request_id',
          requestType: RequestTypes.V1_METRICS,
          inputFileName: 'sample_v2.tar.gz',
          startTime: 0,
          replayAttempt: 0,
          accountId: 'acct1',
          correlationId: 'correlation_id',
          userResponseReturned: true,
          eventId: null,
          id: '6242e15e9e6246a876c9738d',
          finalResult: StatusStates.SUCCESS,
        },
        eventStatus: [
          {
            eventId: 'event_id1',
            status: 'inprogress',
          },
          {
            eventId: 'event_id2',
            status: 'success',
          },
        ],
      };
      MockedActualStatus.mockClear();
      MockedActualStatus.mockImplementation(() => {
        return {
          getStatusByRequestAndCorrelationId: getStatusByCorrelationIdMock,
        } as unknown as ActualStatus;
      });
      getStatusByCorrelationIdMock = jest.fn().mockReturnValue(testRequestWithoutDetailedResponse);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Happy path getting status using correlationId with Status 207', async () => {
      await getStatusServiceByCorrelationId(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(testRequestWithoutDetailedResponse);
    });

    test('Happy path getting status using correlationId with Status 200', async () => {
      testRequestWithoutDetailedResponse.eventStatus[0].status = 'success';
      await getStatusServiceByCorrelationId(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(testRequestWithoutDetailedResponse);
    });

    test('takes accountOrPrefix from headers when request authorized by super user', async () => {
      mockReq.headers['is-super-user'] = 'true';
      mockReq.query.accountOrPrefix = 'acct-prefix';
      mockReq.query.accountId = 'acct2';
      await getStatusServiceByCorrelationId(mockReq, mockRes, mockNext);
      expect(MockedActualStatus).toHaveBeenCalledTimes(1);
      expect(MockedActualStatus).toHaveBeenCalledWith(
        { accountId: 'acct1', correlationId: 'correlationId' },
        'acct-prefix',
        false
      );
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(testRequestWithoutDetailedResponse);
    });

    test('set accountId from query param', async () => {
      delete mockReq.headers.rhmAccountId;
      mockReq.headers['is-super-user'] = 'true';
      mockReq.query.accountId = 'acct1';
      await getStatusServiceByCorrelationId(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(testRequestWithoutDetailedResponse);
    });

    test('calls next middleware with failed error when getStatusByCorrelationIdMock results in an unknown error', async () => {
      getStatusByCorrelationIdMock = jest.fn().mockRejectedValue(new Error('mock error'));
      await getStatusServiceByCorrelationId(mockReq, mockRes, mockNext);
      expect(mockNext).toBeCalledWith(Error('mock error'));
    });

    test('super-user can request detailed', async () => {
      mockReq.headers['is-super-user'] = 'true';
      delete mockReq.headers.rhmAccountId;
      mockReq.query.accountOrPrefix = 'acct-prefix';
      mockReq.query.accountId = 'acct2';
      mockReq.query.detailed = 'true';
      testRequestWithoutDetailedResponse.status.iamId = 'iam';
      const expectedResult: StatusRequestResponse = JSON.parse(JSON.stringify(testRequestWithoutDetailedResponse));
      expectedResult.status.iamId = '***';
      await getStatusServiceByCorrelationId(mockReq, mockRes, mockNext);
      expect(getStatusByCorrelationIdMock).toHaveBeenCalledTimes(1);
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(expectedResult);
    });

    test('iamId matches (can view)', async () => {
      mockReq.headers['is-super-user'] = undefined;
      delete mockReq.headers.rhmAccountId;
      mockRes.locals = { tokenIamId: 'iam', authMethod: 'accessToken' };
      mockReq.query.accountOrPrefix = 'acct-prefix';
      mockReq.query.accountId = 'acct2';
      testRequestWithoutDetailedResponse.status.iamId = 'iam';
      await getStatusServiceByCorrelationId(mockReq, mockRes, mockNext);
      expect(getStatusByCorrelationIdMock).toHaveBeenCalledTimes(1);
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(testRequestWithoutDetailedResponse);
    });

    test('iamId does not match (cannot view)', async () => {
      mockReq.headers['is-super-user'] = undefined;
      delete mockReq.headers.rhmAccountId;
      mockRes.locals = { tokenIamId: 'iam', authMethod: 'accessToken' };
      mockReq.query.accountOrPrefix = 'acct-prefix';
      mockReq.query.accountId = 'acct2';
      testRequestWithoutDetailedResponse.status.iamId = 'otherIam';
      await getStatusServiceByCorrelationId(mockReq, mockRes, mockNext);
      expect(status).not.toBeCalled();
      expect(mockNext).toBeCalledWith(new NotFound('Not found'));
    });
  });

  describe('getStatusServiceByRequestId', () => {
    let testRequestWithoutDetailedResponse: StatusRequestResponse;
    let getStatusByRequestIdMock = jest.fn();

    beforeEach(() => {
      mockReq.params = {
        requestId: 'requestId',
      };
      mockReq.headers = {
        rhmAccountId: 'acct1',
      };
      mockReq.query = {};

      testRequestWithoutDetailedResponse = {
        status: {
          requestId: 'request_id',
          requestType: RequestTypes.V1_METRICS,
          inputFileName: 'sample_v2.tar.gz',
          startTime: 0,
          replayAttempt: 0,
          accountId: 'acct1',
          correlationId: 'correlation_id',
          userResponseReturned: true,
          eventId: null,
          id: '6242e15e9e6246a876c9738d',
          finalResult: StatusStates.SUCCESS,
        },
        eventStatus: [
          {
            eventId: 'event_id1',
            status: 'inprogress',
          },
          {
            eventId: 'event_id2',
            status: 'success',
          },
        ],
      };
      MockedActualStatus.mockClear();
      MockedActualStatus.mockImplementation(() => {
        return {
          getStatusByRequestAndCorrelationId: getStatusByRequestIdMock,
        } as unknown as ActualStatus;
      });
      getStatusByRequestIdMock = jest.fn().mockReturnValue(testRequestWithoutDetailedResponse);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Happy path getting status using requestId with status code 207', async () => {
      await getStatusServiceByRequestId(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(testRequestWithoutDetailedResponse);
    });

    test('Happy path getting status using requestId with status code 200', async () => {
      testRequestWithoutDetailedResponse.eventStatus[0].status = 'success';
      await getStatusServiceByRequestId(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(testRequestWithoutDetailedResponse);
    });

    test('set accountId from token', async () => {
      mockReq.headers['is-super-user'] = undefined;
      mockReq.query.accountId = 'acct2';
      await getStatusServiceByRequestId(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(testRequestWithoutDetailedResponse);
    });

    test('set accountId from query param', async () => {
      delete mockReq.headers.rhmAccountId;
      mockReq.headers['is-super-user'] = 'true';
      mockReq.query.accountId = 'acct1';
      await getStatusServiceByRequestId(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(testRequestWithoutDetailedResponse);
    });

    test('takes accountOrPrefix from headers when request is done by super user', async () => {
      mockReq.headers['is-super-user'] = 'true';
      delete mockReq.headers.rhmAccountId;
      mockReq.query.accountOrPrefix = 'acct-prefix';
      mockReq.query.accountId = 'acct1';
      await getStatusServiceByRequestId(mockReq, mockRes, mockNext);
      expect(MockedActualStatus).toHaveBeenCalledTimes(1);
      expect(MockedActualStatus).toHaveBeenCalledWith(
        { accountId: 'acct1', requestId: 'requestId' },
        'acct-prefix',
        false
      );
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(testRequestWithoutDetailedResponse);
    });

    test('calls next middleware with failed error when getStatusByRequestIdMock results in an unknown error', async () => {
      getStatusByRequestIdMock = jest.fn().mockRejectedValue(new Error('mock error'));
      await getStatusServiceByRequestId(mockReq, mockRes, mockNext);
      expect(mockNext).toBeCalledWith(Error('mock error'));
    });

    test('super-user can request detailed', async () => {
      mockReq.headers['is-super-user'] = 'true';
      delete mockReq.headers.rhmAccountId;
      mockReq.query.accountOrPrefix = 'acct-prefix';
      mockReq.query.accountId = 'acct2';
      mockReq.query.detailed = 'true';
      testRequestWithoutDetailedResponse.status.iamId = 'iam';
      const expectedResult: StatusRequestResponse = JSON.parse(JSON.stringify(testRequestWithoutDetailedResponse));
      expectedResult.status.iamId = '***';
      await getStatusServiceByRequestId(mockReq, mockRes, mockNext);
      expect(getStatusByRequestIdMock).toHaveBeenCalledTimes(1);
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(expectedResult);
    });

    test('iamId matches (can view)', async () => {
      mockReq.headers['is-super-user'] = undefined;
      delete mockReq.headers.rhmAccountId;
      mockRes.locals = { tokenIamId: 'iam', authMethod: 'accessToken' };
      mockReq.query.accountOrPrefix = 'acct-prefix';
      mockReq.query.accountId = 'acct2';
      testRequestWithoutDetailedResponse.status.iamId = 'iam';
      await getStatusServiceByRequestId(mockReq, mockRes, mockNext);
      expect(getStatusByRequestIdMock).toHaveBeenCalledTimes(1);
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(testRequestWithoutDetailedResponse);
    });

    test('iamId does not match (cannot view)', async () => {
      mockReq.headers['is-super-user'] = undefined;
      delete mockReq.headers.rhmAccountId;
      mockRes.locals = { tokenIamId: 'iam', authMethod: 'accessToken' };
      mockReq.query.accountOrPrefix = 'acct-prefix';
      mockReq.query.accountId = 'acct2';
      testRequestWithoutDetailedResponse.status.iamId = 'otherIam';
      await getStatusServiceByRequestId(mockReq, mockRes, mockNext);
      expect(status).not.toBeCalled();
      expect(mockNext).toBeCalledWith(new NotFound('Not found'));
    });
  });

  describe('getStatusServiceByUsageEventId', () => {
    let testUsageEventWithoutDetailedResponse: Array<UsageEventResponse>;
    let testUsageEventWithDetailedResponse: Array<UsageEventResponse>;
    let getStatusByUsageEventIdMock = jest.fn();

    beforeEach(() => {
      mockReq.params = {
        usageEventId: 'eventId',
      };
      mockReq.headers = {
        rhmAccountId: 'acct1',
      };
      mockReq.query = {};

      testUsageEventWithDetailedResponse = [
        {
          status: {
            correlationId: 'correlationId',
            requestId: 'requestId',
            accountId: 'acct1',
            accountOrPrefix: 'acct1',
            requestType: RequestTypes.V1_METRICS,
            inputFileName: 'sample_v2.tar.gz',
            startTime: 0,
            replayAttempt: 0,
            iamId: 'iam',
          },
          statusStep: [
            {
              statusId: 'status-123',
              action: StatusActions.PUT_IN_INCOMING_BUCKET,
              startTime: 0,
              attempt: 0,
              replayAttempt: 0,
              state: StatusStates.SUCCESS,
            },
          ],
          usageEvent: {
            usage: {
              eventId: 'eventId',
              accountId: 'acct1',
              start: 0,
              end: 1,
              measuredUsage: [{ metricId: '1', value: 1 }],
            },
            enrichment: {
              usageContainerSubscriptionId: 'enrich-123',
            },
            metrics: [
              {
                iterator: 0,
                metricId: '1',
                value: 1,
              },
            ],
          },
          usageContainerSubscription: {
            productId: 'product123',
            accountId: 'acct1',
            metricId: 'VIRTUAL_PROCESSOR_CORE',
            id: 'enrich-123',
            parentEventId: 'pEId',
          },
        },
      ];

      testUsageEventWithoutDetailedResponse = [
        {
          status: {
            correlationId: 'correlationId',
            requestId: 'requestId',
            accountId: 'acct1',
            accountOrPrefix: 'acct1',
            requestType: RequestTypes.V1_METRICS,
            inputFileName: 'sample_v2.tar.gz',
            startTime: 0,
            replayAttempt: 0,
          },
          usageEvent: {
            usage: {
              eventId: 'eventId',
              accountId: 'acct1',
              start: 0,
              end: 1,
              measuredUsage: [{ metricId: '1', value: 1 }],
            },
          },
        },
      ];

      MockedActualStatus.mockClear();
      MockedActualStatus.mockImplementation(() => {
        return {
          getStatusByUsageEventId: getStatusByUsageEventIdMock,
        } as unknown as ActualStatus;
      });
      getStatusByUsageEventIdMock = jest.fn().mockReturnValue(testUsageEventWithoutDetailedResponse);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('Happy path getting status using usageEventId with status code 207', async () => {
      await getStatusServiceByUsageEventId(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(testUsageEventWithoutDetailedResponse);
    });

    test('Happy path getting status using usageEventId with status code 200', async () => {
      testUsageEventWithoutDetailedResponse[0].status.finalResult = StatusStates.SUCCESS;
      await getStatusServiceByUsageEventId(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith(testUsageEventWithoutDetailedResponse);
    });

    test('Happy path getting status using usageEventId with detailed=true', async () => {
      mockReq.headers['is-super-user'] = 'true';
      mockReq.query.accountId = 'acct1';
      mockReq.query.detailed = 'true';
      delete mockReq.headers.rhmAccountId;
      getStatusByUsageEventIdMock = jest.fn().mockReturnValue(testUsageEventWithDetailedResponse);
      const expectedResult: StatusRequestResponse[] = JSON.parse(JSON.stringify(testUsageEventWithDetailedResponse));
      expectedResult[0].status.iamId = '***';
      await getStatusServiceByUsageEventId(mockReq, mockRes, mockNext);
      expect(MockedActualStatus).toHaveBeenCalledTimes(1);
      expect(MockedActualStatus).toHaveBeenCalledWith({ accountId: 'acct1', usageEventId: 'eventId' }, null, true);
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(expectedResult);
    });

    test('throws error when accountId is missing', async () => {
      mockReq.headers['is-super-user'] = undefined;
      mockReq.headers.rhmAccountId = undefined;
      mockReq.query.accountId = undefined;
      mockRes.locals = { tokenIamId: 'vendor-iamid' };
      await getStatusServiceByUsageEventId(mockReq, mockRes, mockNext);
      expect(mockNext).toBeCalledTimes(1);
      expect(mockNext).toBeCalledWith(new InvalidRequestError('accountId must be specified as query param'));
      expect(status).toBeCalledTimes(0);
    });

    test('set accountId from token (vendor)', async () => {
      mockReq.headers['is-super-user'] = undefined;
      mockRes.locals = { tokenIamId: 'iam', authMethod: 'accessToken' };
      delete mockReq.headers.rhmAccountId;
      mockReq.query.accountId = 'acct1';
      testUsageEventWithoutDetailedResponse[0].status.iamId = 'iam';
      await getStatusServiceByUsageEventId(mockReq, mockRes, mockNext);
      expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
      expect(json).toBeCalledWith(testUsageEventWithoutDetailedResponse);
    });

    test('considers undefined value for accountOrPrefix and accountId when not specified in request', async () => {
      mockReq.headers.rhmAccountId = undefined;
      mockReq.query.accountOrPrefix = undefined;
      mockReq.query.accountId = 'xyz';
      await getStatusServiceByUsageEventId(mockReq, mockRes, mockNext);
      expect(MockedActualStatus).toHaveBeenCalledTimes(1);
      expect(MockedActualStatus).toHaveBeenCalledWith({ accountId: 'xyz', usageEventId: 'eventId' }, null, false);
    });

    test('calls next middleware with failed error when getStatusServiceByUsageEventId results in an unknown error', async () => {
      getStatusByUsageEventIdMock = jest.fn().mockRejectedValue(new Error('mock error'));
      await getStatusServiceByUsageEventId(mockReq, mockRes, mockNext);
      expect(mockNext).toBeCalledWith(Error('mock error'));
    });
  });

  describe('getAbortedStatus', () => {
    test('Happy path with no query params', async () => {
      statusHandlerInstance.getManyStatuses = jest.fn().mockResolvedValue([{ id: 'mock-aborted-status-1' }]);
      await getAbortedStatus(mockReq, mockRes);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith({ count: 1, data: [{ id: 'mock-aborted-status-1' }] });
      expect(statusHandlerInstance.getManyStatuses).toBeCalledTimes(1);
      expect(statusHandlerInstance.getManyStatuses).toBeCalledWith({ finalResult: 'aborted' }, null);
    });

    test('Happy path with query params', async () => {
      statusHandlerInstance.getManyStatuses = jest.fn().mockResolvedValue([]);
      mockReq.query = { eventIdPresent: 'true', tenant: 'mock-tenant' };
      await getAbortedStatus(mockReq, mockRes);
      expect(status).toBeCalledWith(StatusCodes.OK);
      expect(json).toBeCalledWith({ count: 0, data: [] });
      expect(statusHandlerInstance.getManyStatuses).toBeCalledTimes(1);
      expect(statusHandlerInstance.getManyStatuses).toBeCalledWith(
        { finalResult: 'aborted', eventId: { $exists: true } },
        'mock-tenant'
      );
    });
  });

  describe('censorStatus', () => {
    it('redacts properties for detailed', () => {
      expect(censorStatus({ requestId: 'requestId', iamId: 'c', iui: 'd', email: 'e' }, true)).toEqual({
        requestId: 'requestId',
        iamId: '***',
        iui: '***',
        email: '***',
      });
    });
  });

  it('removes properties for not detailed', () => {
    expect(censorStatus({ requestId: 'requestId', iamId: 'c', iui: 'd', email: 'e' })).toEqual({
      requestId: 'requestId',
    });
  });
});
