import { v1ErrorMiddleware } from '../../../src/api/middlewares/v1-error-middleware';
import { UsageErrorHelper } from '@symposium/usage-common';
import { Request, Response } from 'express';
import createHttpError from 'http-errors';

describe('Error handler middleware', () => {
  const status = jest.fn();
  const json = jest.fn();
  let mockReq: Request;
  let mockMalformedReq: Request;
  const mockRes = () => {
    const res = {} as Response;
    res.status = status.mockReturnValue(res);
    res.json = json;
    return res;
  };
  const mockFinalResponse = {
    data: [],
    errorDetails: ['mock error message'],
    message: 'One or more events are failed with some validation or other errors: mock error message',
    status: 'failed',
  };
  const mockNext = jest.fn();

  beforeEach(() => {
    mockReq = {
      originalUrl: '/api/v1/metrics',
      body: {
        data: [],
      },
    } as Request;

    mockMalformedReq = {
      originalUrl: '/api/v1/metrics',
      body: {},
    } as Request;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should call next error when v2 request url', () => {
    mockReq.originalUrl = '/v2';
    const mockErr = new Error();
    v1ErrorMiddleware(mockErr, mockReq, mockRes(), mockNext);
    expect(mockNext).toBeCalled();
  });

  it('should return response with request body and error details when express error 400', () => {
    const mockErr = createHttpError(400, 'mock malformed data received');
    v1ErrorMiddleware(mockErr, mockMalformedReq, mockRes(), mockNext);
    expect(mockNext).not.toBeCalled();
    expect(status).toBeCalledWith(mockErr.statusCode);
    expect(json).toBeCalledWith({
      data: [],
      errorDetails: ['mock malformed data received'],
      message: 'One or more events are failed with some validation or other errors: mock malformed data received',
      status: 'failed',
    });
  });

  it('should return response with title unauthorized when express error 401', () => {
    const mockErr = createHttpError(401, 'invalid bearer token');
    v1ErrorMiddleware(mockErr, mockReq, mockRes(), mockNext);
    expect(status).toBeCalledWith(mockErr.statusCode);
    expect(mockNext).not.toBeCalled();
    expect(json).toBeCalledWith({
      status: 401,
      title: 'Unauthorized',
      detail: 'Missing Authorization header or invalid bearer token specified',
    });
  });
  it('should return response with request body and error details when unknown error', () => {
    const mockErr = 'mock error message';
    const expectedErr = new UsageErrorHelper(mockErr);
    v1ErrorMiddleware(mockErr, mockReq, mockRes(), mockNext);
    expect(status).toBeCalledWith(expectedErr.statusCode);
    expect(mockNext).not.toBeCalled();
    expect(json).toBeCalledWith(mockFinalResponse);
  });
});
