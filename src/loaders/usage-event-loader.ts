import { UsageEventCollection, logger } from '@symposium/usage-common';

export const usageEventLoader = () => {
  try {
    logger.verbose(`usageEventLoader UsageEvent handler being loaded`);
    return new UsageEventCollection();
  } catch (e) {
    logger.error(`usageEventLoader UsageEvent failed to load at startup`, e);
    throw e;
  }
};

export const usageEventHandlerInstance = usageEventLoader();
