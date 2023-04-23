/* istanbul ignore file */
import { featureFlags } from '../loaders/feature-flags-loader';
import { logger } from '@symposium/usage-common';

/**
 * For development, set .env FEATURE_FLAGS_SDK_KEY
 * These env vars are shared globally in vault
 * LAUNCHDARKLY_SDK_KEY for prod
 * LAUNCHDARKLY_DEV_SDK_KEY for dev
 * LAUNCHDARKLY_TEST_SDK_KEY for sandbox
 */

export const runFeatureFlagsExample = async () => {
  // should return false, as flag is off by default
  let result = await featureFlags.isEnabled('conman-test-flag');
  logger.info(`==== FLAG ENABLED = ${result} ====`);
  // should return true, as flag is set for key = conman
  result = await featureFlags.isEnabled('conman-test-flag', {
    key: 'conman',
  });
  logger.info(`==== FLAG ENABLED = ${result} ====`);
  // should return true, as flag is set for accountId = conman-test-account
  result = await featureFlags.isEnabled('conman-test-flag', {
    key: 'not-conman',
    custom: {
      accountId: 'conman-test-account',
    },
  });
  logger.info(`==== FLAG ENABLED = ${result} ====`);
};
