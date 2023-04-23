import { Request, Response } from 'express';
import { StatusCodes, ReasonPhrases } from 'http-status-codes';

export const getLivenessStatus = (_req: Request, res: Response) => {
  res.status(StatusCodes.OK).send(ReasonPhrases.OK);
};
