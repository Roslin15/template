import { logger, SystemManager } from '@symposium/usage-common';
import { exchangeQueueMap, systemManagerStepDefinitionMap } from '../models/system-manager-steps';
import { MockStep } from '../steps/MockStep';
import { rabbitMQConnectionManager } from './rabbitmq-loader';

export const systemManagerLoader = async () => {
  try {
    logger.verbose(`systemManagerLoader systemManager being loaded`);
    await systemManagerInstance.startUp();
  } catch (e) {
    logger.error('systemManagerLoader systemManager failed to load at startup', e);
    throw e;
  }
};

export const systemManagerInstance: SystemManager = new SystemManager(
  systemManagerStepDefinitionMap,
  exchangeQueueMap,
  [MockStep],
  rabbitMQConnectionManager
);
