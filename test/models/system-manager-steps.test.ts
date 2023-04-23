import { exchangeQueueMap, systemManagerStepDefinitionMap } from '../../src/models/system-manager-steps';

describe('SystemManager model', () => {
  test('Should return defined entries', () => {
    expect(exchangeQueueMap).toBeDefined();
    expect(exchangeQueueMap.size).toEqual(3);

    expect(systemManagerStepDefinitionMap).toBeDefined();
    expect(systemManagerStepDefinitionMap.size).toEqual(1);
  });
});
