import { NextFunction, Request, Response } from 'express';
import { logger } from '@symposium/usage-common';
import { StatusCodes } from 'http-status-codes';
import { usageEventHandlerInstance } from '../../loaders/usage-event-loader';

// Return UsageEvent only for Superuser
export const getUsageEvent = async (req: Request, res: Response, next: NextFunction) => {
  const searchParams = req.body;
  logger.verbose(`usage-events getUsageEvent getting usage event`, searchParams);

  if (!usageEventHandlerInstance.isFindUsageEventParams(searchParams)) {
    logger.warn(`usage-events getUsageEvent invalid search params`, searchParams);
    return res
      .status(StatusCodes.BAD_REQUEST)
      .json({ errorCode: StatusCodes.BAD_REQUEST, message: `Invalid search params ${JSON.stringify(searchParams)}` });
  }

  const accountOrPrefix = req.body.accountOrPrefix || null;

  try {
    const usageEvent = await usageEventHandlerInstance.get(searchParams, accountOrPrefix);
    return usageEvent ? res.status(StatusCodes.OK).json(usageEvent) : res.status(StatusCodes.NOT_FOUND);
  } catch (err) {
    logger.error(`usage-events getUsageEvent Error getting usage event ${JSON.stringify(searchParams)}`, err);
    return next(err);
  }
};
