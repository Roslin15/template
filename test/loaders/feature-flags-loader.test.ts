import { featureFlagsLoader, featureFlags } from '../../src/loaders/feature-flags-loader';
import { logger } from '@symposium/usage-common';

jest.mock('@symposium/usage-common');

describe('featureFlagsLoader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  const errorSpy = jest.spyOn(logger, 'error');

  it('featureFlags is defined', () => {
    expect(featureFlags).toBeDefined();
  });
  it('logs and can handle when an error is thrown', async () => {
    featureFlags.init = jest.fn().mockRejectedValue(new Error('mock error'));

    await expect(featureFlagsLoader()).rejects.toThrow('mock error');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
