import { getConfig } from '../../src/config/config';

describe('ConfigSettings', () => {
  const myConfig = getConfig();
  it('Should return a port config', () => {
    expect(myConfig.PORT).toEqual('4000');
  });
});
