import { encodeBase64, InvalidFormatError, logger } from '@symposium/usage-common';
import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ReplayService, ReplayRequest } from '../../services/replay-service';

/**
 * Middleware that takes the body of a POST /replay (an array of replay requests) and invokes the ReplayService for each item. Waits for all replays to complete before returning the status of every request as an array.
 *
 * TODO some kind of batching so we don't have separate db requests per replay?
 */
export const handleReplayArray = async (req: Request, res: Response, next: NextFunction) => {
  const responses = [];
  const replayRequestItems = req.body as ReplayRequest[];
  const { tokenIamId, email } = res.locals;

  for (const item of replayRequestItems) {
    item.superUserIamId = encodeBase64(tokenIamId);
    item.email = encodeBase64(email);
    responses.push(new ReplayService(item).publishReplay());
  }

  try {
    const resolvedResponses = await Promise.all(responses);

    const failedReplay = resolvedResponses.find(
      (resolvedResponse) => StatusCodes.ACCEPTED !== resolvedResponse.httpCode
    );
    res.status(failedReplay ? StatusCodes.MULTI_STATUS : StatusCodes.ACCEPTED).json(resolvedResponses);
  } catch (err) {
    return next(err);
  }
};

export const handleReplayBatch = async (req: Request, res: Response, next: NextFunction) => {
  logger.info('replay handleReplayBatch: received requestBody', req.body);

  try {
    if (!req.body.accountId && req.body.isAborted === undefined) {
      throw new InvalidFormatError('Must either have accountId or isAborted set in request payload');
    }
    const { tokenIamId, email } = res.locals;
    const response = await new ReplayService({
      batch: req.body,
      superUserIamId: encodeBase64(tokenIamId),
      email: encodeBase64(email),
    }).publishReplay();

    res.status(response.httpCode).json(response);
  } catch (err) {
    return next(err);
  }
};
