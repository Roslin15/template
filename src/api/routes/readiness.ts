import { accountHealthInstance } from '../../loaders/account-health-loader';
import { cosHandlerInstance } from '../../loaders/cos-loader';
import { esmHealthInstance } from '../../loaders/esm-health-loader';
import { logger, mongoImpl, tenantInstance } from '@symposium/usage-common';
import { Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import { rabbitMQConnectionManager } from '../../loaders/rabbitmq-loader';
import { systemManagerInstance } from '../../loaders/system-manager-loader';

export const canInteractWithDependencies = async () => {
  const [cosHealth, mongoHealth, tenantInstanceHealth, esmHealth, omAccountHealth, rabbitConnectionHealth]: boolean[] =
    await Promise.all([
      cosHandlerInstance.health(),
      mongoImpl.health(),
      tenantInstance.health(),
      esmHealthInstance.health(),
      accountHealthInstance.health(),
      rabbitMQConnectionManager.health(),
    ]);

  if (!mongoHealth && tenantInstanceHealth) {
    logger.warn('Mongo not healthy, flushing tenant cache');
    tenantInstance.flush();
  }

  return !!(cosHealth && mongoHealth && tenantInstanceHealth && esmHealth && omAccountHealth && rabbitConnectionHealth);
};

export const getReadinessStatus = async (_req: Request, res: Response) => {
  try {
    const ready = await canInteractWithDependencies();
    if (ready) {
      await systemManagerInstance.restartIfNeeded();
      res.status(StatusCodes.OK).send(ReasonPhrases.OK);
      return;
    }
  } catch (err: unknown) {
    logger.error(`Readiness check error`, err);
  }
  logger.warn('Not ready');
  res.status(StatusCodes.SERVICE_UNAVAILABLE).send('Not ready');
};
