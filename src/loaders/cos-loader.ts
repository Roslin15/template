import { COSImpl, logger } from '@symposium/usage-common';
import { getConfig } from '../config/config';

export const cosLoader = async () => {
  try {
    if (!getConfig().INCOMING_MESSAGE_QUEUE_BUCKET) {
      throw new Error('cosLoader INCOMING_MESSAGE_QUEUE_BUCKET must have a value');
    }
    if (!getConfig().ARCHIVE_BUCKET) {
      throw new Error('cosLoader ARCHIVE_BUCKET must have a value');
    }
    logger.verbose('cosLoader COS Handler being loaded');
    cosHandlerInstance.bucketNameForHealth = getConfig().INCOMING_MESSAGE_QUEUE_BUCKET;
    await cosHandlerInstance.health();
  } catch (e) {
    logger.error('cosLoader COS Handler failed to load on startup', e);
    throw e;
  }
};

// export single instance to be used
export const cosHandlerInstance: COSImpl = new COSImpl();
