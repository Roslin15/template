import {
  UsageEvent,
  Status,
  RequestTypes,
  StatusActions,
  StatusStates,
  UsageContainerSubscription,
  ConsolidatedStatus,
  NotFound,
  UsageErrorHelper,
  UsageErrorClass,
  StatusStep,
  logger,
} from '@symposium/usage-common';
import { statusHandlerInstance } from '../../src/loaders/status-loader';
import { usageEventHandlerInstance } from '../../src/loaders/usage-event-loader';
import {
  ActualStatus,
  GetStatusRequestParams,
  StatusRequestResponse,
  UsageEventResponse,
} from '../../src/services/actual-status';

jest.mock('../../src/loaders/status-loader');
const statusHandlerInstanceMocked = statusHandlerInstance as jest.MockedObject<typeof statusHandlerInstance>;
jest.mock('../../src/loaders/usage-event-loader');
const usageEventHandlerInstanceMocked = usageEventHandlerInstance as jest.MockedObject<
  typeof usageEventHandlerInstance
>;
let getUsageContainer = jest.fn();
jest.mock('@symposium/usage-common', () => ({
  ...jest.requireActual('@symposium/usage-common'),
  UsageContainerSubscriptionCollection: jest.fn(() => ({ getUsageContainer })),
}));

describe('ActualStatus', () => {
  let actualStatus: ActualStatus;
  let testStatus: Status;
  let testStatusForRequest: Array<Status>;
  let testUsage: UsageEvent['usage'];
  let testStatusSteps: ConsolidatedStatus['statusSteps'];
  let testUsageEvent: UsageEvent;
  let testUsageEventWithoutDetailedResponse: UsageEventResponse[];
  let testUsageEventWithDetailedResponse: UsageEventResponse[];
  let testUsageContainerSubscription: UsageContainerSubscription;
  let statusParams: GetStatusRequestParams;
  let statusStep: Array<StatusStep>;
  let testStatusRequestResponse: StatusRequestResponse;

  beforeEach(() => {
    statusParams = {
      accountId: '62161382f6f66d0014610d7d',
    };
    actualStatus = new ActualStatus(statusParams, null, true);
    testStatusForRequest = [
      {
        requestId: 'fe81f18d6ba58cf916d1f74ebf95f4cbff7ead39f7a3761b117207d618c59fe6',
        requestType: RequestTypes.V1_METRICS,
        inputFileName: 'sample_v2.tar.gz',
        startTime: 0,
        replayAttempt: 0,
        accountId: '62161382f6f66d0014610d7d',
        correlationId: '56b3b57a-15d0-5488-93ab-fc36e6ed2341',
        userResponseReturned: true,
        iamId: 'iamId',
        id: '6242e15e9e6246a876c9732d',
        authMethod: 'superUser',
      },
      {
        requestId: 'fe81f18d6ba58cf916d1f74ebf95f4cbff7ead39f7a3761b117207d618c59fe6',
        requestType: RequestTypes.V1_METRICS,
        inputFileName: 'sample_v2.tar.gz',
        startTime: 0,
        replayAttempt: 0,
        accountId: '62161382f6f66d0014610d7d',
        correlationId: '56b3b57a-15d0-5488-93ab-fc36e6ed2341',
        userResponseReturned: true,
        eventId: '6242e15e9e6246a876c9779d',
        finalResult: StatusStates.SUCCESS,
        id: '6242e15e9e6246a876c9739c',
        authMethod: 'rhmAccount',
      },
      {
        requestId: 'fe81f18d6ba58cf916d1f74ebf95f4cbff7ead39f7a3761b117207d618c59fe6',
        requestType: RequestTypes.V1_METRICS,
        inputFileName: 'sample_v2.tar.gz',
        startTime: 0,
        replayAttempt: 0,
        accountId: '62161382f6f66d0014610d7d',
        correlationId: '56b3b57a-15d0-5488-93ab-fc36e6ed2341',
        userResponseReturned: true,
        eventId: '6242e15e9e6246a876c9799d',
        id: '6242e15e9e6246a876c9739b',
        authMethod: 'rhmAccount',
      },
      {
        requestId: 'fe81f18d6ba58cf916d1f74ebf95f4cbff7ead39f7a3761b117207d618c59fe6',
        requestType: RequestTypes.V1_METRICS,
        inputFileName: 'sample_v2.tar.gz',
        startTime: 0,
        replayAttempt: 0,
        accountId: '62161382f6f66d0014610d7d',
        correlationId: '56b3b57a-15d0-5488-93ab-fc36e6ed2341',
        userResponseReturned: true,
        eventId: '6242e15e9e6246a876c97993',
        finalResult: StatusStates.USER_ERROR,
        id: '6242e15e9e6246a876c97397',
        authMethod: 'rhmAccount',
      },
    ];

    testStatusRequestResponse = {
      status: testStatusForRequest[0],
      eventStatus: [
        {
          eventId: '6242e15e9e6246a876c9779d',
          status: 'success',
        },
        {
          eventId: '6242e15e9e6246a876c9799d',
          status: 'inprogress',
        },
        {
          eventId: '6242e15e9e6246a876c97993',
          status: 'failed',
        },
      ],
    };

    statusStep = [
      {
        action: StatusActions.PUT_IN_INCOMING_BUCKET,
        attempt: 1,
        endTime: 1645694840970,
        replayAttempt: 0,
        startTime: 1645694417009,
        state: StatusStates.SUCCESS,
        statusId: '6243f7f0b8584d95e0af542e',
        id: '62174dd4776e5a51f32f0163',
      },
    ];

    testUsage = {
      eventId: 'eventId-123',
      accountId: 'acct-1',
      start: 0,
      end: 1,
      measuredUsage: [{ metricId: '1', value: 1 }],
    };

    testUsageContainerSubscription = {
      productId: 'product123',
      accountId: 'acct-1',
      metricId: 'VIRTUAL_PROCESSOR_CORE',
      id: 'ucs-12345',
      parentEventId: 'pEId',
    };

    testUsageEvent = {
      id: 'usageEventId-123',
      accountOrPrefix: 'acct-1',
      statusId: 'statusId-123',
      usage: testUsage,
      enrichment: {
        usageContainerSubscriptionId: 'ucs-123',
      },
    };

    testUsageEventWithoutDetailedResponse = [
      {
        status: testStatus,
        usageEvent: {
          usage: testUsage,
        },
      },
    ];

    testUsageEventWithDetailedResponse = [
      {
        status: testStatus,
        statusStep: testStatusSteps,
        usageEvent: {
          usage: testUsage,
          enrichment: testUsageEvent.enrichment,
          metrics: [],
        },
        usageContainerSubscription: testUsageContainerSubscription,
      },
    ];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getStatusByUsageEventId', () => {
    beforeEach(() => {
      statusParams = { usageEventId: 'usageEventId-123', accountId: 'acct-1' };
      actualStatus = new ActualStatus(statusParams, 'prefix');

      testStatus = {
        id: 'id',
        correlationId: 'correlationId-123',
        requestId: 'requestId-123',
        accountId: 'acct-1',
        accountOrPrefix: 'acct-1',
        requestType: RequestTypes.V1_METRICS,
        inputFileName: 'sample_v2.tar.gz',
        startTime: 0,
        replayAttempt: 0,
        iamId: 'iam123',
        authMethod: 'accessToken',
      };

      testStatusSteps = [
        {
          statusId: 'status-123',
          action: StatusActions.PUT_IN_INCOMING_BUCKET,
          startTime: 0,
          attempt: 0,
          replayAttempt: 0,
          state: StatusStates.SUCCESS,
        },
      ];

      testUsage = {
        eventId: 'eventId-123',
        accountId: 'acct-1',
        start: 0,
        end: 1,
        measuredUsage: [{ metricId: '1', value: 1 }],
      };

      testUsageContainerSubscription = {
        productId: 'product123',
        accountId: 'acct-1',
        metricId: 'VIRTUAL_PROCESSOR_CORE',
        id: 'ucs-12345',
        parentEventId: 'pEId',
      };

      testUsageEvent = {
        id: 'usageEventId-123',
        accountOrPrefix: 'acct-1',
        statusId: 'statusId-123',
        usage: testUsage,
        enrichment: {
          usageContainerSubscriptionId: 'ucs-123',
        },
        metrics: [
          {
            iterator: 0,
            metricId: '1',
            value: 1,
          },
        ],
      };

      testUsageEventWithoutDetailedResponse = [
        {
          status: testStatus,
          usageEvent: {
            usage: testUsage,
          },
        },
      ];

      testUsageEventWithDetailedResponse = [
        {
          status: testStatus,
          statusStep: testStatusSteps,
          usageEvent: {
            usage: testUsage,
            enrichment: testUsageEvent.enrichment,
            metrics: testUsageEvent.metrics,
          },
          usageContainerSubscription: testUsageContainerSubscription,
        },
      ];

      usageEventHandlerInstanceMocked.getByEventAndAccountId = jest.fn().mockReturnValue([testUsageEvent]);
      statusHandlerInstanceMocked.getStatus = jest.fn().mockReturnValue(testStatus);
      getUsageContainer = jest.fn().mockReturnValue(testUsageContainerSubscription);
    });

    test('get status by usageEventId (without detailed) happy path', async () => {
      await expect(actualStatus.getStatusByUsageEventId()).resolves.toMatchObject(
        testUsageEventWithoutDetailedResponse
      );
      expect(usageEventHandlerInstanceMocked.getByEventAndAccountId).toHaveBeenCalledWith(
        'usageEventId-123',
        'acct-1',
        'prefix'
      );
      expect(statusHandlerInstanceMocked.getStatus).toHaveBeenCalledWith(
        {
          id: 'statusId-123',
        },
        'prefix'
      );
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    test('get status by usageEventId (with detailed) happy path', async () => {
      const detailedActualStatus = new ActualStatus(statusParams, null, true);
      statusHandlerInstanceMocked.getConsolidatedStatus = jest.fn().mockReturnValue({
        ...testStatus,
        statusSteps: testStatusSteps,
      });

      await expect(detailedActualStatus.getStatusByUsageEventId()).resolves.toMatchObject(
        testUsageEventWithDetailedResponse
      );
      expect(usageEventHandlerInstanceMocked.getByEventAndAccountId).toHaveBeenCalledWith(
        'usageEventId-123',
        'acct-1',
        null
      );
      expect(statusHandlerInstanceMocked.getConsolidatedStatus).toHaveBeenCalledWith(
        {
          id: 'statusId-123',
        },
        null
      );
      expect(getUsageContainer).toBeCalledWith({ id: 'ucs-123' });
    });

    test('calls next middleware when error when getByEventAndAccountId throws an unknown error', async () => {
      usageEventHandlerInstanceMocked.getByEventAndAccountId = jest.fn().mockRejectedValue(new Error('mock error'));
      await expect(actualStatus.getStatusByUsageEventId()).rejects.toBeInstanceOf(UsageErrorHelper);
    });

    test('calls next middleware with error when getByEventAndAccountId throws a notfound error', async () => {
      usageEventHandlerInstanceMocked.getByEventAndAccountId = jest.fn().mockRejectedValue(new NotFound('mock error'));
      await expect(actualStatus.getStatusByUsageEventId()).rejects.toBeInstanceOf(UsageErrorClass);
    });

    test('calls next middleware with error when getStatus throws an error', async () => {
      statusHandlerInstanceMocked.getStatus = jest.fn().mockRejectedValue(new Error('mock error'));
      await expect(actualStatus.getStatusByUsageEventId()).rejects.toThrowError(Error('mock error'));
    });

    test('calls next middleware with error when getConsolidatedStatus throws an error', async () => {
      const detailedActualStatus = new ActualStatus(statusParams, null, true);
      statusHandlerInstanceMocked.getConsolidatedStatus = jest.fn().mockRejectedValue(new Error('mock error'));
      await expect(detailedActualStatus.getStatusByUsageEventId()).rejects.toThrowError(Error('mock error'));
    });

    test('get status by usageEventId when detailed = true and UsageContainerSubscriptionCollection NotFound', async () => {
      statusHandlerInstanceMocked.getConsolidatedStatus = jest.fn().mockReturnValue({
        ...testStatus,
        statusSteps: testStatusSteps,
      });
      getUsageContainer = jest.fn().mockRejectedValue(new NotFound('mock error'));
      const detailedActualStatus = new ActualStatus(statusParams, null, true);
      testUsageEventWithDetailedResponse[0].usageContainerSubscription = 'not found';
      await expect(detailedActualStatus.getStatusByUsageEventId()).resolves.toMatchObject(
        testUsageEventWithDetailedResponse
      );
      expect(usageEventHandlerInstanceMocked.getByEventAndAccountId).toHaveBeenCalledWith(
        'usageEventId-123',
        'acct-1',
        null
      );
      expect(statusHandlerInstanceMocked.getConsolidatedStatus).toHaveBeenCalledWith(
        {
          id: 'statusId-123',
        },
        null
      );
      expect(getUsageContainer).toBeCalledWith({ id: 'ucs-123' });
    });

    test('calls next middleware with error when getUsageContainer throws an error', async () => {
      testUsageEventWithDetailedResponse = [];
      getUsageContainer = jest.fn().mockRejectedValue(new Error('mock error'));
      const detailedActualStatus = new ActualStatus(statusParams, null, true);
      await expect(detailedActualStatus.getStatusByUsageEventId()).rejects.toThrowError(Error);
      expect(usageEventHandlerInstanceMocked.getByEventAndAccountId).toBeCalledTimes(1);
      expect(detailedActualStatus.statusParams).toBeDefined();
    });

    test('Throws NotFound error when events are not found', async () => {
      testUsageEventWithDetailedResponse = [];
      usageEventHandlerInstanceMocked.getByEventAndAccountId = jest
        .fn()
        .mockReturnValue(testUsageEventWithDetailedResponse);
      const detailedActualStatus = new ActualStatus(statusParams, null, true);
      await expect(detailedActualStatus.getStatusByUsageEventId()).rejects.toThrowError(
        new NotFound('usageEvents are not found')
      );
      expect(usageEventHandlerInstanceMocked.getByEventAndAccountId).toBeCalledTimes(1);
      expect(detailedActualStatus.statusParams).toBeDefined();
    });
  });

  describe('getStatusByRequestAndCorrelationId', () => {
    test('Get status by RequestId when details false', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      statusParams.requestId = 'fe81f18d6ba58cf916d1f74ebf95f4cbff7ead39f7a3761b117207d618c59fe6';
      statusHandlerInstance.getManyStatuses = jest.fn().mockReturnValue(testStatusForRequest);
      statusHandlerInstance.getByRequestId = jest.fn().mockReturnValue(false);
      actualStatus = new ActualStatus(statusParams, null, false);
      const getStatus = await actualStatus.getStatusByRequestAndCorrelationId();
      expect(statusHandlerInstance.getManyStatuses).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(actualStatus.statusParams).toBeDefined();
      delete testStatusRequestResponse.statusStep;
      delete testStatusRequestResponse.status.id;
      expect(getStatus).toMatchObject(testStatusRequestResponse);
    });

    test('Get status by RequestId when details true', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      statusParams.requestId = 'fe81f18d6ba58cf916d1f74ebf95f4cbff7ead39f7a3761b117207d618c59fe6';
      testStatusRequestResponse.eventStatus[2].status = 'userError';
      statusHandlerInstance.getManyStatuses = jest.fn().mockReturnValue(testStatusForRequest);
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockReturnValue(statusStep);
      actualStatus = new ActualStatus(statusParams, null, true);
      statusHandlerInstance.getByRequestId = jest.fn().mockReturnValue(false);
      const getStatus = await actualStatus.getStatusByRequestAndCorrelationId();
      expect(statusHandlerInstance.getManyStatuses).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(actualStatus.statusParams).toBeDefined();
      expect(getStatus).toMatchObject(testStatusRequestResponse);
    });

    test('Get status by CorrelationId when details false', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      statusParams.correlationId = '56b3b57a-15d0-5488-93ab-fc36e6ed2341';
      statusHandlerInstance.getManyStatuses = jest.fn().mockReturnValue(testStatusForRequest);
      statusHandlerInstance.getByRequestId = jest.fn().mockReturnValue(false);
      actualStatus = new ActualStatus(statusParams, null, false);
      const getStatus = await actualStatus.getStatusByRequestAndCorrelationId();
      expect(statusHandlerInstance.getManyStatuses).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(actualStatus.statusParams).toBeDefined();
      delete testStatusRequestResponse.statusStep;
      delete testStatusRequestResponse.status.id;
      expect(getStatus).toMatchObject(testStatusRequestResponse);
    });

    test('Get status by CorrelationId when details true', async () => {
      const infoSpy = jest.spyOn(logger, 'info');
      statusParams.requestId = '56b3b57a-15d0-5488-93ab-fc36e6ed2341';
      testStatusRequestResponse.eventStatus[2].status = 'userError';
      statusHandlerInstance.getManyStatuses = jest.fn().mockReturnValue(testStatusForRequest);
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockReturnValue(statusStep);
      actualStatus = new ActualStatus(statusParams, null, true);
      statusHandlerInstance.getByRequestId = jest.fn().mockReturnValue(false);
      const getStatus = await actualStatus.getStatusByRequestAndCorrelationId();
      expect(statusHandlerInstance.getManyStatuses).toHaveBeenCalled();
      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(actualStatus.statusParams).toBeDefined();
      expect(getStatus).toMatchObject(testStatusRequestResponse);
    });

    test('overall status set to inprogress for aborted', async () => {
      statusHandlerInstance.getManyStatuses = jest.fn().mockReturnValue([
        {
          finalResult: StatusStates.ABORTED,
        },
      ]);
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockReturnValue({ statusSteps: [] });
      actualStatus = new ActualStatus(statusParams, null, false);
      const getStatus = await actualStatus.getStatusByRequestAndCorrelationId();
      expect(getStatus.status.status).toBe('inprogress');
    });

    test('overall status set to inprogress for system error', async () => {
      statusHandlerInstance.getManyStatuses = jest.fn().mockReturnValue([
        {
          finalResult: StatusStates.SYSTEM_ERROR,
        },
      ]);
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockReturnValue({ statusSteps: [] });
      actualStatus = new ActualStatus(statusParams, null, false);
      const getStatus = await actualStatus.getStatusByRequestAndCorrelationId();
      expect(getStatus.status.status).toBe('inprogress');
    });

    test('overall status set to failed for user error', async () => {
      statusHandlerInstance.getManyStatuses = jest.fn().mockReturnValue([
        {
          finalResult: StatusStates.USER_ERROR,
        },
      ]);
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockReturnValue({ statusSteps: [] });
      actualStatus = new ActualStatus(statusParams, null, false);
      const getStatus = await actualStatus.getStatusByRequestAndCorrelationId();
      expect(getStatus.status.status).toBe('failed');
    });

    test('overall status set to aborted for aborted when detailed=true', async () => {
      statusHandlerInstance.getManyStatuses = jest.fn().mockReturnValue([
        {
          finalResult: StatusStates.ABORTED,
        },
      ]);
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockReturnValue({ statusSteps: [] });
      actualStatus = new ActualStatus(statusParams, null, true);
      const getStatus = await actualStatus.getStatusByRequestAndCorrelationId();
      expect(getStatus.status.status).toBe('aborted');
    });

    test('overall status set to system error for systemError when detailed=true', async () => {
      statusHandlerInstance.getManyStatuses = jest.fn().mockReturnValue([
        {
          finalResult: StatusStates.SYSTEM_ERROR,
        },
      ]);
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockReturnValue({ statusSteps: [] });
      actualStatus = new ActualStatus(statusParams, null, true);
      const getStatus = await actualStatus.getStatusByRequestAndCorrelationId();
      expect(getStatus.status.status).toBe('systemError');
    });

    test('overall status set to userError for user error when detailed=true', async () => {
      statusHandlerInstance.getManyStatuses = jest.fn().mockReturnValue([
        {
          finalResult: StatusStates.USER_ERROR,
        },
      ]);
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockReturnValue({ statusSteps: [] });
      actualStatus = new ActualStatus(statusParams, null, true);
      const getStatus = await actualStatus.getStatusByRequestAndCorrelationId();
      expect(getStatus.status.status).toBe('userError');
    });

    test('Throws NotFound error when statuses are not found', async () => {
      testStatusForRequest = [];
      statusHandlerInstance.getManyStatuses = jest.fn().mockReturnValue(testStatusForRequest);
      statusHandlerInstance.getByRequestId = jest.fn().mockReturnValue(false);
      actualStatus = new ActualStatus(statusParams, null, false);
      await expect(actualStatus.getStatusByRequestAndCorrelationId()).rejects.toThrowError(
        new NotFound('statuses are not found')
      );
      expect(statusHandlerInstance.getManyStatuses).toBeCalledTimes(1);
      expect(actualStatus.statusParams).toBeDefined();
    });

    test('Throws Unknown error while fetching status', async () => {
      statusHandlerInstance.getManyStatuses = jest.fn().mockRejectedValue(new Error('mock error 1'));
      await expect(actualStatus.getStatusByRequestAndCorrelationId()).rejects.toBeInstanceOf(Error);
      expect(statusHandlerInstance.getManyStatuses).toBeCalledTimes(1);
    });

    test('Throws Usage error while fetching status', async () => {
      statusHandlerInstance.getManyStatuses = jest.fn().mockRejectedValue(new UsageErrorHelper('mock error 2'));
      await expect(actualStatus.getStatusByRequestAndCorrelationId()).rejects.toBeInstanceOf(UsageErrorClass);
      expect(statusHandlerInstance.getManyStatuses).toBeCalledTimes(1);
    });
  });
});
