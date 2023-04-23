import { cosHandlerInstance, cosLoader } from '../../src/loaders/cos-loader';

describe('cos-loader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it('Should load a single cos handler instance', () => {
    expect(cosHandlerInstance).toBeDefined();
  });

  it('can handle when an error is thrown', async () => {
    cosHandlerInstance.health = jest.fn().mockRejectedValue(new Error('mock error'));
    await expect(cosLoader()).rejects.toThrow('mock error');
  });
});
