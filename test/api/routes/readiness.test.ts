import { getReadinessStatus } from '../../../src/api/routes/readiness';
import { Request, Response } from 'express';
import { mongoImpl, tenantInstance } from '@symposium/usage-common';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { cosHandlerInstance } from '../../../src/loaders/cos-loader';
import { rabbitMQConnectionManager } from '../../../src/loaders/rabbitmq-loader';

describe('Readiness check', () => {
  const status = jest.fn();
  const send = jest.fn();
  const mockReq = {} as Request;
  const mockRes = () => {
    const res = {} as Response;
    res.status = status.mockReturnValue(res);
    res.send = send;
    return res;
  };

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('Ready', async () => {
    cosHandlerInstance.health = jest.fn().mockResolvedValueOnce(true);
    mongoImpl.health = jest.fn().mockResolvedValueOnce(true);
    tenantInstance.health = jest.fn().mockResolvedValueOnce(true);
    rabbitMQConnectionManager.health = jest.fn().mockResolvedValueOnce(true);
    await getReadinessStatus(mockReq, mockRes());
    expect(status).toBeCalledWith(StatusCodes.OK);
    expect(send).toBeCalledWith(ReasonPhrases.OK);
  });

  test('Not ready - unhealthy', async () => {
    cosHandlerInstance.health = jest.fn().mockResolvedValueOnce(false);
    mongoImpl.health = jest.fn().mockResolvedValueOnce(false);
    tenantInstance.health = jest.fn().mockResolvedValue(false);
    rabbitMQConnectionManager.health = jest.fn().mockResolvedValueOnce(false);
    await getReadinessStatus(mockReq, mockRes());
    expect(status).toBeCalledWith(StatusCodes.SERVICE_UNAVAILABLE);
    expect(send).toBeCalledWith('Not ready');
  });

  test('Not ready - healthcheck errors', async () => {
    cosHandlerInstance.health = jest.fn().mockRejectedValueOnce('mock 1');
    await getReadinessStatus(mockReq, mockRes());
    expect(status).toBeCalledWith(StatusCodes.SERVICE_UNAVAILABLE);
    expect(send).toBeCalledWith('Not ready');
  });

  test('Mongo is not ready - Tenant cache is flushed', async () => {
    const flushSpy = jest.spyOn(tenantInstance, 'flush');

    cosHandlerInstance.health = jest.fn().mockResolvedValueOnce(true);
    mongoImpl.health = jest.fn().mockResolvedValueOnce(false);
    tenantInstance.health = jest.fn().mockResolvedValue(true);
    rabbitMQConnectionManager.health = jest.fn().mockResolvedValueOnce(true);
    await getReadinessStatus(mockReq, mockRes());
    expect(flushSpy).toHaveBeenCalled();
    expect(status).toBeCalledWith(StatusCodes.SERVICE_UNAVAILABLE);
    expect(send).toBeCalledWith('Not ready');
  });
});
