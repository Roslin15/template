import { EsmHealth, logger } from '@symposium/usage-common';

// export single instance to be used
export const esmHealthInstance: EsmHealth = new EsmHealth();

export const esmHealthLoader = async () => {
  try {
    logger.verbose('esmHealthLoader Esm Health being loaded');
    await esmHealthInstance.health();
  } catch (e) {
    logger.error('esmHealthLoader Esm health loader failed to load at startup', e);
    throw e;
  }
};
