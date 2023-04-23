const health = jest.fn();
jest.mock('@symposium/usage-common', () => ({
  ...jest.requireActual('@symposium/usage-common'),
  AccountHealth: jest.fn(() => ({ health })),
}));
import { accountHealthInstance, accountHealthLoader } from '../../src/loaders/account-health-loader';
describe('Account health loader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('Loads a single account health instance', () => {
    expect(accountHealthInstance).toBeDefined();
  });

  it('can handle when an error is thrown', async () => {
    health.mockRejectedValue(new Error('mock error'));
    await expect(accountHealthLoader()).rejects.toThrow('mock error');
  });
});
