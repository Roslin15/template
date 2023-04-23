import { logger, RabbitMQConnectionManager } from '@symposium/usage-common';

// Has a producer connection, but no consumer connection
export const rabbitMQConnectionManager: RabbitMQConnectionManager = new RabbitMQConnectionManager(false, true);

export const rabbitMQLoader = async () => {
  try {
    logger.verbose('rabbitMQLoader Connection Manager being loaded');
    await rabbitMQConnectionManager.connect();
  } catch (e) {
    logger.error('rabbitMQLoader Connection Manager failed to load on startup', e);
    throw e;
  }
};
