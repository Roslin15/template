import { esmHealthInstance, esmHealthLoader } from '../../src/loaders/esm-health-loader';

describe('ESMHealth loader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('Loads a single ESMHealth instance', () => {
    expect(esmHealthInstance).toBeDefined();
  });

  it('can handle when an error is thrown', async () => {
    esmHealthInstance.health = jest.fn().mockRejectedValue(new Error('mock error'));
    await expect(esmHealthLoader()).rejects.toThrow('mock error');
  });
});
