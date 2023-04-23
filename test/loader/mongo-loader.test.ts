import { mongoLoader } from '../../src/loaders/mongo-loader';
import { logger, mongoImpl } from '@symposium/usage-common';

describe('Mongo Loader', () => {
  let initSpy: jest.SpyInstance;
  beforeEach(() => {
    initSpy = jest.spyOn(mongoImpl, 'init');
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('it initialized mongodb', async () => {
    mongoImpl.client.connect = jest.fn().mockImplementation(() => {
      return Promise.resolve();
    });
    await mongoLoader();
    expect(initSpy).toHaveBeenCalledTimes(1);
  });
  it('throws if init fails', async () => {
    const errorSpy = jest.spyOn(logger, 'error');
    try {
      mongoImpl.client.connect = jest.fn().mockImplementation(() => {
        return Promise.reject('TEST Mongo loader did not init');
      });
      expect(await mongoLoader()).toThrowError();
    } catch (err) {
      expect(err).toBeDefined();
      expect(errorSpy).toHaveBeenCalledWith('mongoLoader failed at startup', expect.anything());
    }
  });
});
