import { UsageEventCollection, logger } from '@symposium/usage-common';

export const usageEventLoader = () => {
  try {
    logger.verbose('usageEventLoader usageEvent Handler being loaded');
    return new UsageEventCollection();
  } catch (e) {
    /* istanbul ignore next */
    logger.error('usageEventLoader usageEventHandler failed to load on startup', e);
    /* istanbul ignore next */
    throw e;
  }
};

export const usageEventHandlerInstance: UsageEventCollection = usageEventLoader();
