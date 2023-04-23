// Loads dependencies for service

import { COSImpl, logger } from '@symposium/usage-common';

export const cosLoader = async () => {
  try {
    logger.verbose('cosLoader COS Handler being loaded');
    await cosHandlerInstance.health();
  } catch (e) {
    logger.error('cosLoader COS Handler failed to load on startup', e);
    throw e;
  }
};

// export single instance to be used
export const cosHandlerInstance: COSImpl = new COSImpl();
