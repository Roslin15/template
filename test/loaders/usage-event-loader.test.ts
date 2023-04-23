import { usageEventLoader, usageEventHandlerInstance } from '../../src/loaders/usage-event-loader';
import { UsageEventCollection } from '@symposium/usage-common';

jest.mock('@symposium/usage-common');
const usageEventCollectionMock = UsageEventCollection as jest.MockedClass<typeof UsageEventCollection>;

describe('UsageEvent Loader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it('loads UsageEvent', () => {
    const usageEvent = usageEventLoader();
    expect(usageEvent).toBeDefined();

    expect(usageEventHandlerInstance).toBeDefined();
  });
  it('logs error on failure', () => {
    usageEventCollectionMock.mockImplementation(() => {
      throw 'operation failed';
    });
    expect(() => usageEventLoader()).toThrowError('operation failed');
  });
});
