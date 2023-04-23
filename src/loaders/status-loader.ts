import { logger, UsageStatus } from '@symposium/usage-common';

export const statusLoader = () => {
  try {
    logger.verbose(`statusLoader usageStatus handler being loaded`);
    return new UsageStatus();
  } catch (e) {
    /* istanbul ignore next */
    logger.error('statusLoader usageStatus handler failed to load at startup', e);
    /* istanbul ignore next */
    throw e;
  }
};

export const statusHandlerInstance: UsageStatus = statusLoader();
