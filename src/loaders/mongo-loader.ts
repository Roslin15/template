import { logger, mongoImpl } from '@symposium/usage-common';

export const mongoLoader = async () => {
  try {
    logger.verbose('mongoLoader mongoImpl being loaded');
    await mongoImpl.init();
    logger.info(`mongoLoader mongoImpl connected isHealthy: ${mongoImpl.isHealthy}}`);
  } catch (err) {
    logger.error('mongoLoader failed at startup', err);
    throw err;
  }
};
