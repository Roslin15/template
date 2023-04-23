import { AccountHealth, logger } from '@symposium/usage-common';

// export single instance to be used
export const accountHealthInstance: AccountHealth = new AccountHealth();

export const accountHealthLoader = async () => {
  try {
    logger.verbose('accountHealthLoader Account Health being loaded');
    await accountHealthInstance.health();
  } catch (e) {
    logger.error('accountHealthLoader Account health loader failed to load at startup', e);
    throw e;
  }
};
