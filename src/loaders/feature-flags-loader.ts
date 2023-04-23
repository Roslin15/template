import { FeatureFlags, logger } from '@symposium/usage-common';

export const featureFlags = new FeatureFlags();

export const featureFlagsLoader = async () => {
  try {
    logger.verbose(`feature-flags-loader featureFlagsLoader being loaded`);
    await featureFlags.init();
  } catch (err) {
    logger.error(`feature-flags-loader featureFlagsLoader failed`, err);
    throw err;
  }
};
