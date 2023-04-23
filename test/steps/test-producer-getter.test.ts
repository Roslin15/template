import { Producer } from '@symposium/usage-common';
import { systemManagerInstance } from '../../src/loaders/system-manager-loader';
import { getRouterProducer } from '../../src/steps/step-producer-getter';

jest.mock('../../src/loaders/system-manager-loader');

describe('Producer Getters', () => {
  it('Gets router producer', () => {
    systemManagerInstance.managedSteps = {
      get: () => {
        return {
          stepInstance: {
            stepProducer: {
              prefetch: 5,
            } as unknown as Producer,
          },
        };
      },
    } as unknown as Map<string, never>;

    const producer = getRouterProducer();
    expect(producer.prefetch).toBe(5);
  });
});
