import { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
import { receiveUpload } from '../../../src/api/middlewares/multer-upload';
import { UploadTooLargeError, InvalidRequestError } from '@symposium/usage-common';

const multer = require('multer');
jest.mock('multer');

describe('Receive upload middleware', () => {
  const anyFn = jest.fn();
  const mockReq = {} as Request;
  mockReq.headers = { rhmAccountId: 'accountId' };
  mockReq.originalUrl = 'originalUrl';
  const mockRes = { locals: {} } as Response;
  const mockNext = jest.fn();

  beforeEach(() => {
    multer.mockImplementationOnce(() => {
      return {
        any() {
          return anyFn;
        },
      };
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    jest.restoreAllMocks();
  });

  test('Happy path', () => {
    anyFn.mockImplementationOnce((req: Request, res: Response, next: NextFunction) => {
      // eslint-disable-next-line no-undef
      req.files = [{ originalname: 'mockfilename' } as Express.Multer.File];
      return next();
    });
    receiveUpload(mockReq, mockRes, mockNext);
    expect(mockNext).toBeCalledWith();
  });

  test('Multer file size limit error becomes UploadTooLargeError', () => {
    const mockErr = new MulterError('LIMIT_FILE_SIZE');
    mockErr.code = 'LIMIT_FILE_SIZE';
    anyFn.mockImplementationOnce((req: Request, res: Response, next: NextFunction) => {
      return next(mockErr);
    });
    receiveUpload(mockReq, mockRes, mockNext);
    expect(mockNext).toBeCalledWith(expect.any(UploadTooLargeError));
  });

  test('Multer file count limit error becomes InvalidRequestError', () => {
    const mockErr = new MulterError('LIMIT_FILE_COUNT');
    mockErr.code = 'LIMIT_FILE_COUNT';
    anyFn.mockImplementationOnce((req: Request, res: Response, next: NextFunction) => {
      return next(mockErr);
    });
    receiveUpload(mockReq, mockRes, mockNext);
    expect(mockNext).toBeCalledWith(expect.any(InvalidRequestError));
  });

  test('Other MulterError becomes InvalidRequestError', () => {
    anyFn.mockImplementationOnce((req: Request, res: Response, next: NextFunction) => {
      return next(new multer.MulterError('test multer error'));
    });
    receiveUpload(mockReq, mockRes, mockNext);
    expect(mockNext).toBeCalledWith(expect.any(InvalidRequestError));
  });

  test('Passes other error on to next middleware', () => {
    anyFn.mockImplementationOnce((req: Request, res: Response, next: NextFunction) => {
      return next('mock error');
    });
    receiveUpload(mockReq, mockRes, mockNext);
    expect(mockNext).toBeCalledWith('mock error');
  });

  test('Bigger file size limit for IASP request', () => {
    mockReq.originalUrl = '/report/iasp';
    const mockErr = new MulterError('LIMIT_FILE_SIZE');
    mockErr.code = 'LIMIT_FILE_SIZE';
    anyFn.mockImplementationOnce((req: Request, res: Response, next: NextFunction) => {
      return next(mockErr);
    });
    receiveUpload(mockReq, mockRes, mockNext);
    expect(mockNext).toBeCalledWith(new UploadTooLargeError(`Max upload size is 5MiB`));
  });
});
