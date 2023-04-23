import { systemManagerInstance, systemManagerLoader } from '../../src/loaders/system-manager-loader';
import { SystemManager } from '@symposium/usage-common';

jest.mock('@symposium/usage-common');

describe('systemManagerLoader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it('systemManager is defined', () => {
    expect(systemManagerInstance).toBeDefined();
    expect(systemManagerInstance).toBeInstanceOf(SystemManager);
  });

  describe('systemManagerLoader', () => {
    it('calls systemManagerInstance startup method', async () => {
      systemManagerInstance.startUp = jest.fn().mockResolvedValue(true);
      await systemManagerLoader();
      expect(systemManagerInstance.startUp).toBeCalledTimes(1);
    });

    it('throws error when startup method throws error', async () => {
      systemManagerInstance.startUp = jest.fn().mockRejectedValue(new Error('mock error'));
      await expect(systemManagerLoader()).rejects.toThrow('mock error');
    });
  });
});
