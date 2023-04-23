import { EsmHealth, logger } from '@symposium/usage-common';

export const esmHealthInstance: EsmHealth = new EsmHealth();

export const esmHealthLoader = async () => {
  try {
    logger.verbose('esmHealthLoader loading');
    await esmHealthInstance.health();
  } catch (e) {
    logger.error('esmHealthLoader failed', e);
    throw e;
  }
};
