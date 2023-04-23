import { Request, Response } from 'express';
import { NotFound, errorMiddleware } from '@symposium/usage-common';
import { notFound } from '../../../src/api/middlewares/not-found';

jest.mock('@symposium/usage-common');

test('Not found', () => {
  notFound({} as Request, {} as Response);
  expect(errorMiddleware).toBeCalledWith(
    new NotFound('Requested endpoint not found or does not support the given action'),
    {},
    {}
  );
});
