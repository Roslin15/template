import { logger, mongoImpl, tenantInstance } from '@symposium/usage-common';
import { cosHandlerInstance } from '../../loaders/cos-loader';
import { rabbitMQConnectionManager } from '../../loaders/rabbitmq-loader';
import { Request, Response } from 'express';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';

// TODO update with dependencies used by service
// Readiness in template is incomplete and only covers mongo, tenant, cos, and rabbit
export const canInteractWithDependencies = async () => {
  const [cosHealth, mongoHealth, tenantInstanceHealth, rabbitConnectionHealth]: boolean[] = await Promise.all([
    cosHandlerInstance.health(),
    mongoImpl.health(),
    tenantInstance.health(),
    rabbitMQConnectionManager.health(),
  ]);

  if (!mongoHealth && tenantInstanceHealth) {
    logger.warn('Mongo not healthy, flushing tenant cache');
    tenantInstance.flush();
  }

  return !!(cosHealth && mongoHealth && tenantInstanceHealth && rabbitConnectionHealth);
};

export const getReadinessStatus = async (_req: Request, res: Response) => {
  let ready = false;

  try {
    ready = await canInteractWithDependencies();
  } catch (err: unknown) {
    logger.error(`Readiness check error. Ready: ${ready}`, err);
  }

  if (ready) {
    res.status(StatusCodes.OK).send(ReasonPhrases.OK);
  } else {
    logger.warn('Not ready');
    res.status(StatusCodes.SERVICE_UNAVAILABLE).send('Not ready');
  }
};
