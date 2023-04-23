import { EsmHealth } from '@symposium/usage-common';
import { esmHealthInstance, esmHealthLoader } from '../../src/loaders/esm-health-loader';

describe('Esm health loader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it('Loads a single esm health instance', () => {
    expect(esmHealthInstance).toBeDefined();
    expect(esmHealthInstance instanceof EsmHealth).toBe(true);
  });

  it('can handle when an error is thrown', async () => {
    esmHealthInstance.health = jest.fn().mockRejectedValue(new Error('mock error'));
    await expect(esmHealthLoader()).rejects.toThrow('mock error');
  });
});
