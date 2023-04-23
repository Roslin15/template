import { CommerceHealth, logger } from '@symposium/usage-common';

export const commerceHealthInstance: CommerceHealth = new CommerceHealth();

export const commerceHealthLoader = async () => {
  try {
    logger.verbose('commerceHealthLoader loading');
    await commerceHealthInstance.health();
  } catch (e) {
    logger.error('commerceHealthLoader failed', e);
    throw e;
  }
};
