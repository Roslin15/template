import { Request, Response } from 'express';
import { errorMiddleware, NotFound } from '@symposium/usage-common';

export const notFound = (req: Request, res: Response) => {
  return errorMiddleware(new NotFound('Requested endpoint not found or does not support the given action'), req, res);
};
