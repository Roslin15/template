import { Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { getLivenessStatus } from '../../../src/api/routes/liveness';

describe('Test liveness handler', () => {
  afterAll(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.restoreAllMocks();
  });

  test('Liveness handler sets status OK and sends OK', () => {
    const status = jest.fn();
    const send = jest.fn();
    const mockReq = {} as Request;
    const mockRes = () => {
      const res = {} as Response;
      res.status = status.mockReturnValue(res);
      res.send = send;
      return res;
    };
    getLivenessStatus(mockReq, mockRes());
    expect(status).toBeCalledWith(StatusCodes.OK);
    expect(send).toBeCalledWith(ReasonPhrases.OK);
  });
});
