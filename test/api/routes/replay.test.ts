import { handleReplayArray, handleReplayBatch } from '../../../src/api/routes/replay';
import { NextFunction, Request, Response } from 'express';
import { ReplayService } from '../../../src/services/replay-service';
import { StatusCodes } from 'http-status-codes';
import { InvalidFormatError } from '@symposium/usage-common';

jest.mock('../../../src/services/replay-service');
const MockedReplayService = ReplayService as jest.MockedClass<typeof ReplayService>;
beforeEach(() => {
  MockedReplayService.mockClear();
});

let publishReplayMock = jest.fn();
MockedReplayService.mockImplementation(() => {
  return {
    publishReplay: publishReplayMock,
  } as unknown as ReplayService;
});

describe('handle replay array', () => {
  const mockNext = jest.fn();
  const status = jest.fn();
  const json = jest.fn();
  const mockRes = () => {
    const res = {
      locals: {
        tokenIamId: 'tokenIamId',
        email: 'test@ibm.com',
      },
    } as unknown as Response;
    res.status = status.mockReturnValue(res);
    res.json = json;
    return res;
  };
  const request = {
    body: [
      {
        requestId: 'requestId1',
        accountOrPrefix: 'tenant1',
      },
      {
        requestId: 'requestId2',
        accountOrPrefix: 'tenant2',
      },
    ],
  } as Request;

  test('handle replay array - return 202', async () => {
    const expectedResBody = [
      {
        requestId: 'requestId1',
        accountOrPrefix: 'tenant1',
        httpCode: 202,
      },
      {
        requestId: 'requestId2',
        accountOrPrefix: 'tenant2',
        httpCode: 202,
      },
    ];
    publishReplayMock = jest.fn().mockReturnValueOnce(expectedResBody[0]).mockReturnValueOnce(expectedResBody[1]);

    await handleReplayArray(request, mockRes(), mockNext);

    expect(MockedReplayService).toBeCalledWith({
      requestId: 'requestId1',
      accountOrPrefix: 'tenant1',
      email: 'dGVzdEBpYm0uY29t',
      superUserIamId: 'dG9rZW5JYW1JZA==',
    });
    expect(MockedReplayService).toBeCalledWith({
      requestId: 'requestId2',
      accountOrPrefix: 'tenant2',
      email: 'dGVzdEBpYm0uY29t',
      superUserIamId: 'dG9rZW5JYW1JZA==',
    });
    expect(status).toBeCalledWith(StatusCodes.ACCEPTED);
    expect(json).toBeCalledWith(expectedResBody);
  });

  test('handle replay array - return 207', async () => {
    const expectedResBody = [
      {
        requestId: 'requestId1',
        accountOrPrefix: 'tenant1',
        httpCode: 202,
      },
      {
        requestId: 'requestId2',
        accountOrPrefix: 'tenant2',
        httpCode: 422,
      },
    ];
    publishReplayMock = jest.fn().mockReturnValueOnce(expectedResBody[0]).mockReturnValueOnce(expectedResBody[1]);

    await handleReplayArray(request, mockRes(), mockNext);

    expect(MockedReplayService).toHaveBeenNthCalledWith(1, {
      requestId: 'requestId1',
      accountOrPrefix: 'tenant1',
      email: 'dGVzdEBpYm0uY29t',
      superUserIamId: 'dG9rZW5JYW1JZA==',
    });
    expect(MockedReplayService).toHaveBeenNthCalledWith(2, {
      requestId: 'requestId2',
      accountOrPrefix: 'tenant2',
      email: 'dGVzdEBpYm0uY29t',
      superUserIamId: 'dG9rZW5JYW1JZA==',
    });
    expect(status).toBeCalledWith(StatusCodes.MULTI_STATUS);
    expect(json).toBeCalledWith(expectedResBody);
  });

  test('Error scenario', async () => {
    publishReplayMock = jest.fn().mockRejectedValueOnce('mock error');

    await handleReplayArray(request, mockRes(), mockNext);

    expect(MockedReplayService).toBeCalledWith({
      requestId: 'requestId1',
      accountOrPrefix: 'tenant1',
      email: 'dGVzdEBpYm0uY29t',
      superUserIamId: 'dG9rZW5JYW1JZA==',
    });
    expect(MockedReplayService).toBeCalledWith({
      requestId: 'requestId2',
      accountOrPrefix: 'tenant2',
      email: 'dGVzdEBpYm0uY29t',
      superUserIamId: 'dG9rZW5JYW1JZA==',
    });
    expect(mockNext).toBeCalledWith('mock error');
  });
});

describe('handleReplayBatch', () => {
  const mockReq = {} as Request;
  const status = jest.fn();
  const json = jest.fn();
  let mockNext: jest.MockedFunction<NextFunction>;

  const mockRes = () => {
    const res = {
      locals: {
        tokenIamId: 'tokenIamId',
        email: 'test@ibm.com',
      },
    } as unknown as Response;
    res.status = status.mockReturnValue(res);
    res.json = json;
    return res;
  };

  beforeEach(() => {
    mockReq.body = {
      start: 1485907200001,
      end: 1660135139467,
      limit: 25,
      isAborted: true,
    };
    mockNext = jest.fn();
  });

  test('happy path', async () => {
    const responseBody = { httpCode: StatusCodes.ACCEPTED };
    publishReplayMock = jest.fn().mockResolvedValue(responseBody);
    await handleReplayBatch(mockReq, mockRes(), jest.fn());
    expect(status).toBeCalledWith(StatusCodes.ACCEPTED);
    expect(json).toBeCalledWith(responseBody);
  });

  test('error scenario', async () => {
    publishReplayMock = jest.fn().mockRejectedValueOnce('mock error');
    await handleReplayBatch(mockReq, mockRes(), mockNext);
    expect(mockNext).toBeCalledWith('mock error');
  });

  test('throws error when both accountId and isAborted missing from payload', async () => {
    delete mockReq.body.isAborted;
    await handleReplayBatch(mockReq, mockRes(), mockNext);
    expect(mockNext).toBeCalledWith(
      new InvalidFormatError('Must either have accountId or isAborted set in request payload')
    );
  });
});
