import { Request, Response } from 'express';
import { MethodNotAllowed } from '@symposium/usage-common';
import { notImplemented } from '../../../src/api/middlewares/not-implemented';

test('Not implemented', () => {
  const nextFunction = (input: string) => {
    return input;
  };
  expect(notImplemented({} as Request, {} as Response, nextFunction)).toEqual(new MethodNotAllowed('Not implemented'));
});
