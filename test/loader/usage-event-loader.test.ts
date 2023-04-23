import { usageEventHandlerInstance } from '../../src/loaders/usage-event-loader';

describe('usage-event-loader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it('Should load a single usage event loader instance', () => {
    expect(usageEventHandlerInstance).toBeDefined();
  });
});
