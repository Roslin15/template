import { logger, RabbitMQConnectionManager } from '@symposium/usage-common';

export const rabbitMQLoader = async () => {
  try {
    logger.verbose('rabbitMQ Connection Manager being loaded');
    await rabbitMQConnectionManager.connect();
  } catch (e) {
    logger.error('rabbitMQLoader Connection Manager failed to load on startup', e);
    throw e;
  }
};

// export single instance to be used
export const rabbitMQConnectionManager: RabbitMQConnectionManager = new RabbitMQConnectionManager();
