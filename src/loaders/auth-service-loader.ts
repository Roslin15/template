import { accountHealthInstance } from './account-health-loader';
import { AuthService, logger } from '@symposium/usage-common';
import { esmHealthInstance } from './esm-health-loader';

export const authServiceLoader = () => {
  try {
    logger.verbose('authServiceLoader loading');
    // ESM is optional, only needed if using pull secret or entitlement key auth
    return new AuthService(accountHealthInstance, esmHealthInstance);
  } catch (e) {
    logger.error('authServiceLoader failed', e);
    throw e;
  }
};

export const authServiceInstance: AuthService = authServiceLoader();
