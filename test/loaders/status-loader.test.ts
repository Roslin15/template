import { statusHandlerInstance } from '../../src/loaders/status-loader';
import { UsageStatus } from '@symposium/usage-common';

describe('Status Loader', () => {
  beforeAll(() => {
    jest.mock('@symposium/usage-common');
  });

  afterAll(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it('Loads a single UsageStatus instance', () => {
    expect(statusHandlerInstance).toBeInstanceOf(UsageStatus);
  });
});
