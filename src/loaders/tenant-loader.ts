import { logger, tenantInstance } from '@symposium/usage-common';

export const tenantLoader = async () => {
  try {
    logger.verbose(`tenantLoader tenant handler being loaded`);
    await tenantInstance.initCache();
  } catch (err) {
    logger.error(`tenantLoader failed at startup`, err);
    throw err;
  }
};
