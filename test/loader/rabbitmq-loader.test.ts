import { rabbitMQConnectionManager, rabbitMQLoader } from '../../src/loaders/rabbitmq-loader';

describe('rabbitmq-loader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it('Should load a single rabbit connection manager to be loaded', () => {
    expect(rabbitMQConnectionManager).toBeDefined();
  });

  it('can handle when an error is thrown', async () => {
    rabbitMQConnectionManager.connect = jest.fn().mockRejectedValue(new Error('mock error'));
    await expect(rabbitMQLoader()).rejects.toThrow('mock error');
  });
});
