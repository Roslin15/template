import { getReadinessStatus } from '../../../src/api/routes/readiness';
import { accountHealthInstance } from '../../../src/loaders/account-health-loader';
import { cosHandlerInstance } from '../../../src/loaders/cos-loader';
import { esmHealthInstance } from '../../../src/loaders/esm-health-loader';
import { rabbitMQConnectionManager } from '../../../src/loaders/rabbitmq-loader';
import { mongoImpl, tenantInstance } from '@symposium/usage-common';
import { Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

jest.mock('../../../src/loaders/account-health-loader', () => ({
  accountHealthInstance: { health: jest.fn() },
}));

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
  test('Ready', async () => {
    cosHandlerInstance.health = jest.fn().mockResolvedValueOnce(true);
    mongoImpl.health = jest.fn().mockResolvedValueOnce(true);
    tenantInstance.health = jest.fn().mockResolvedValueOnce(true);
    esmHealthInstance.health = jest.fn().mockResolvedValueOnce(true);
    accountHealthInstance.health = jest.fn().mockResolvedValueOnce(true);
    rabbitMQConnectionManager.health = jest.fn().mockResolvedValueOnce(true);
    await getReadinessStatus(mockReq, mockRes());
    expect(status).toBeCalledWith(StatusCodes.OK);
    expect(send).toBeCalledWith(ReasonPhrases.OK);
  });

  test('Not ready - unhealthy', async () => {
    cosHandlerInstance.health = jest.fn().mockResolvedValueOnce(false);
    mongoImpl.health = jest.fn().mockResolvedValueOnce(false);
    tenantInstance.health = jest.fn().mockResolvedValue(false);
    esmHealthInstance.health = jest.fn().mockResolvedValueOnce(false);
    accountHealthInstance.health = jest.fn().mockResolvedValueOnce(false);
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
    esmHealthInstance.health = jest.fn().mockResolvedValueOnce(true);
    accountHealthInstance.health = jest.fn().mockResolvedValueOnce(true);
    rabbitMQConnectionManager.health = jest.fn().mockResolvedValue(true);
    await getReadinessStatus(mockReq, mockRes());
    expect(flushSpy).toHaveBeenCalled();
    expect(status).toBeCalledWith(StatusCodes.SERVICE_UNAVAILABLE);
    expect(send).toBeCalledWith('Not ready');
  });
});
