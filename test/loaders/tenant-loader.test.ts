import { tenantLoader } from '../../src/loaders/tenant-loader';
import { logger, mongoImpl, tenantInstance, TenantIdTypes, ITenant } from '@symposium/usage-common';

describe('Tenant Loader', () => {
  beforeEach(() => {
    jest.mock('@symposium/usage-common');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('it initialized tenant cache', async () => {
    const mockTenant: ITenant = {
      id: '613cbda86cf9a7755313a932',
      type: TenantIdTypes.COS_PREFIX,
      accountOrPrefix: 'sample-prefix',
      name: 'tenant1',
      rhmTest: true,
    };
    mongoImpl.client.connect = jest.fn().mockImplementation(() => {
      return Promise.resolve();
    });
    tenantInstance.getTenantsFromMongo = jest.fn().mockReturnValueOnce([mockTenant]);
    const initSpy = jest.spyOn(tenantInstance, 'initCache');
    await tenantLoader();
    const tenant = tenantInstance.get(mockTenant.accountOrPrefix);
    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(tenant).toEqual(mockTenant);
  });
  it('throws if initCache fails', async () => {
    const errorSpy = jest.spyOn(logger, 'error');
    try {
      mongoImpl.client.connect = jest.fn().mockImplementation(() => {
        return Promise.reject('TEST Tenantloader did not init');
      });

      expect(await tenantLoader()).toThrowError();
    } catch (err) {
      expect(err).toBeDefined();
      expect(errorSpy).toHaveBeenCalledWith(`tenantLoader failed at startup`, expect.anything());
    }
  });
});
