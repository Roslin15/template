import { Request, Response } from 'express';
import { UsageEvent } from '@symposium/usage-common';
import { getUsageEvent } from '../../../src/api/routes/usage-events';
import { usageEventHandlerInstance } from '../../../src/loaders/usage-event-loader';
import { StatusCodes } from 'http-status-codes';

describe('UsageEvent', () => {
  const status = jest.fn();
  const json = jest.fn();
  const mockReq = {} as Request;
  const mockResBuilder = () => {
    const res = {} as Response;
    res.status = status.mockReturnValue(res);
    res.json = json;
    return res;
  };
  const mockRes = mockResBuilder();
  const mockNext = jest.fn();
  let testUsageEvent: UsageEvent;

  beforeEach(() => {
    mockReq.headers = {};
    mockReq.body = {};
    testUsageEvent = {
      id: '61faf1e68c947bccaef4ca07',
      statusId: 'statusId',
      usage: { eventId: 'eventId', accountId: 'accountId', start: 0, end: 1, measuredUsage: [] },
      enrichment: { isAmendment: true },
      metrics: [
        {
          iterator: 0,
          metricId: 'metricToMeasureSomething',
          value: 10,
        },
      ],
    };
    mockReq.headers['is-super-user'] = 'true';
    mockReq.body.id = '1234';
  });
  afterAll(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('gets a UsageEvent Happy Path', async () => {
    const usageEventResult = [{ usageevent: testUsageEvent }];
    usageEventHandlerInstance.get = jest.fn().mockResolvedValue(usageEventResult);
    await getUsageEvent(mockReq, mockRes, mockNext);
    expect(json).toBeCalledWith(usageEventResult);
  });

  it('returns NOT_FOUND if no usage-event returned', async () => {
    usageEventHandlerInstance.get = jest.fn().mockResolvedValue(undefined);
    await getUsageEvent(mockReq, mockRes, mockNext);
    expect(status).toBeCalledWith(StatusCodes.NOT_FOUND);
  });

  it('returns BAD_REQUEST if no search params included on body', async () => {
    mockReq.body = {};
    await getUsageEvent(mockReq, mockRes, mockNext);
    expect(status).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
  });

  it('handles exception and calls next function', async () => {
    usageEventHandlerInstance.get = jest.fn().mockRejectedValue('failed');
    await getUsageEvent(mockReq, mockRes, mockNext);
    expect(mockNext).toBeCalledWith('failed');
  });
});
