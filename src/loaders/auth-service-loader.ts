import { accountHealthInstance } from './account-health-loader';
import { esmHealthInstance } from './esm-health-loader';
import { AuthService, logger } from '@symposium/usage-common';

export const authServiceLoader = () => {
  try {
    logger.verbose('authServiceLoader loading');
    return new AuthService(accountHealthInstance, esmHealthInstance);
  } catch (e) {
    logger.error('authServiceLoader failed', e);
    throw e;
  }
};

export const authServiceInstance: AuthService = authServiceLoader();
