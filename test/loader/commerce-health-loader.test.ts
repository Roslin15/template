import { commerceHealthInstance, commerceHealthLoader } from '../../src/loaders/commerce-health-loader';

describe('CommerceHealth loader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it('Loads a single CommerceHealth instance', () => {
    expect(commerceHealthInstance).toBeDefined();
  });

  it('can handle when an error is thrown', async () => {
    commerceHealthInstance.health = jest.fn().mockRejectedValue(new Error('mock error'));
    await expect(commerceHealthLoader()).rejects.toThrow('mock error');
  });
});
