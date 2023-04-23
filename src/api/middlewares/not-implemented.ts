import { NextFunction, Request, Response } from 'express';
import { MethodNotAllowed } from '@symposium/usage-common';

export const notImplemented = (_req: Request, _res: Response, next: NextFunction) => {
  return next(new MethodNotAllowed('Not implemented'));
};
