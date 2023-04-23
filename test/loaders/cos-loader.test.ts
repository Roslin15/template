import { cosHandlerInstance, cosLoader } from '../../src/loaders/cos-loader';
import * as config from '../../src/config/config';

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

  it('Should throw error if ARCHIVE_BUCKET not set', async () => {
    jest.spyOn(config, 'getConfig').mockReturnValue({
      INCOMING_MESSAGE_QUEUE_BUCKET: 'BLAH',
    } as config.ConfigSettings);

    await expect(cosLoader()).rejects.toThrow('cosLoader ARCHIVE_BUCKET must have a value');
  });

  it('Should throw error if INCOMING_MESSAGE_QUEUE_BUCKET not set', async () => {
    jest.spyOn(config, 'getConfig').mockReturnValue({
      ARCHIVE_BUCKET: 'BLAH',
    } as config.ConfigSettings);

    await expect(cosLoader()).rejects.toThrow('cosLoader INCOMING_MESSAGE_QUEUE_BUCKET must have a value');
  });
});
