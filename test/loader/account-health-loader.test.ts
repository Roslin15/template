import { AccountHealth } from '@symposium/usage-common';
import { accountHealthInstance, accountHealthLoader } from '../../src/loaders/account-health-loader';

jest.mock('@symposium/usage-common', () => ({
  ...jest.requireActual('@symposium/usage-common'),
  AccountHealth: jest.fn(),
}));

describe('Account health loader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it('Loads a single account health instance', () => {
    expect(accountHealthInstance).toBeDefined();
    expect(accountHealthInstance instanceof AccountHealth).toBe(true);
  });

  it('can handle when an error is thrown', async () => {
    accountHealthInstance.health = jest.fn().mockRejectedValue(new Error('mock error'));
    await expect(accountHealthLoader()).rejects.toThrow('mock error');
  });
});
