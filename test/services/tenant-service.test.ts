import { tenantInstance, TenantIdTypes, TenantError, ITenant } from '@symposium/usage-common';
import { cosHandlerInstance } from '../../src/loaders/cos-loader';
import { TenantService } from '../../src/services/tenant-service';

jest.mock('@symposium/usage-common');
jest.mock('../../src/config/config', () => ({
  getConfig: () => ({
    EXISTING_STATUS_DELAY: 1,
    INCOMING_MESSAGE_QUEUE_BUCKET: 'test-bucket-incoming-api',
    ARCHIVE_BUCKET: 'mock-archive',
  }),
}));
describe('Tenant Service', () => {
  const tenantService = new TenantService();

  describe('create tenant', () => {
    let tenant: ITenant;
    beforeEach(() => {
      cosHandlerInstance.bucketExists = jest.fn().mockResolvedValue(true);
      cosHandlerInstance.getBucketForTenant = jest.fn().mockReturnValue('archive-mock');
      tenant = {
        accountOrPrefix: 'accountOrPrefix-1',
        name: 'name1',
        type: TenantIdTypes.ACCOUNT_ID,
        rhmTest: true,
      };
    });
    it('create happy path (new)', async () => {
      tenantInstance.getTenants = jest.fn().mockReturnValue([]);
      const existed = await tenantService.createTenant(tenant);
      expect(existed).toBe(false);
      expect(tenantInstance.create).toBeCalled();
      expect(cosHandlerInstance.getBucketForTenant).toBeCalledTimes(1);
      expect(cosHandlerInstance.bucketExists).toBeCalledTimes(1);
    });

    it('create happy path (add to existing)', async () => {
      const otherTenant = {
        accountOrPrefix: 'accountOrPrefix-2',
        name: 'name1',
        type: TenantIdTypes.ACCOUNT_ID,
        rhmTest: true,
      };
      tenantInstance.getTenants = jest.fn().mockReturnValue([otherTenant]);
      const existed = await tenantService.createTenant(tenant);
      expect(existed).toBe(true);
      expect(tenantInstance.create).toBeCalled();
    });

    it('create skips because it already exists', async () => {
      tenantInstance.getTenants = jest.fn().mockReturnValue([tenant]);
      await expect(tenantService.createTenant(tenant)).rejects.toBeInstanceOf(TenantError);
      expect(tenantInstance.create).not.toBeCalled();
      expect(cosHandlerInstance.getBucketForTenant).not.toBeCalled();
      expect(cosHandlerInstance.bucketExists).not.toBeCalled();
    });

    it('create skips because there are already 50 tenant names registered', async () => {
      const t = {
        accountOrPrefix: 'accountOrPrefix-2',
        type: TenantIdTypes.ACCOUNT_ID,
        rhmTest: true,
      };
      const existingTenants: ITenant[] = [];
      for (let i = 0; i <= 50; i++) {
        existingTenants.push({ name: `name-${i}`, ...t });
      }
      tenantInstance.getTenants = jest.fn().mockReturnValue(existingTenants);
      await expect(tenantService.createTenant(tenant)).rejects.toBeInstanceOf(TenantError);
      expect(tenantInstance.create).not.toBeCalled();
    });

    it('throws error if there is no archive bucket created', async () => {
      cosHandlerInstance.bucketExists = jest.fn().mockResolvedValue(false);
      tenantInstance.getTenants = jest.fn().mockReturnValue([]);
      await expect(tenantService.createTenant(tenant)).rejects.toBeInstanceOf(TenantError);
      expect(tenantInstance.create).not.toBeCalled();
    });
  });

  describe('get all tenants', () => {
    it('Gets tenants and removes the id before returning', () => {
      const tenants = [
        {
          id: '1',
          accountOrPrefix: 'accountOrPrefix-1',
          name: 'name1',
          type: TenantIdTypes.ACCOUNT_ID,
          rhmTest: true,
        },
        {
          id: '2',
          accountOrPrefix: 'accountOrPrefix-2',
          name: 'name2',
          type: TenantIdTypes.ACCOUNT_ID,
          rhmTest: true,
        },
      ];
      tenantInstance.getTenants = jest.fn().mockReturnValue(tenants);
      const result = tenantService.getAllTenants();
      expect(result).toEqual([
        {
          accountOrPrefix: 'accountOrPrefix-1',
          name: 'name1',
          type: TenantIdTypes.ACCOUNT_ID,
          rhmTest: true,
        },
        {
          accountOrPrefix: 'accountOrPrefix-2',
          name: 'name2',
          type: TenantIdTypes.ACCOUNT_ID,
          rhmTest: true,
        },
      ]);
    });

    it('get all tenants handles errors', () => {
      tenantInstance.getTenants = jest.fn().mockImplementationOnce(() => {
        throw new Error();
      });
      expect(() => tenantService.getAllTenants()).toThrowError();
    });
  });

  describe('delete tenant', () => {
    it('deletes', async () => {
      await tenantService.deleteTenant('acct1');
      expect(tenantInstance.delete).toBeCalledWith('acct1');
    });

    it('handles error during delete', async () => {
      tenantInstance.delete = jest.fn().mockRejectedValue(new Error());
      await expect(tenantService.deleteTenant('acct1')).rejects.toBeInstanceOf(TenantError);
    });
  });

  it('refresh', async () => {
    await tenantService.refresh();
    expect(tenantInstance.initCache).toBeCalled();
  });
});
