import { ITenant, logger, TenantError, tenantInstance } from '@symposium/usage-common';
import { getConfig } from '../config/config';
import { cosHandlerInstance } from '../loaders/cos-loader';

export class TenantService {
  async refresh() {
    await tenantInstance.initCache();
  }

  async createTenant(tenant: ITenant): Promise<boolean> {
    try {
      logger.debug(`tenant-service createTenant getting existing tenants`);
      const existingTenants = tenantInstance.getTenants();

      logger.debug(`tenant-service createTenant checking if there is already a tenant for this accountOrPrefix`);
      const matchingTenant = existingTenants.find(
        (existingTenant) => existingTenant.accountOrPrefix === tenant.accountOrPrefix
      );
      if (matchingTenant) {
        delete matchingTenant.id;
        throw new TenantError(`Not creating, tenant already existed ${JSON.stringify(matchingTenant)}`);
      }

      logger.debug(`tenant-service createTenant checking if space for more tenants`);
      let existingTenantNames = existingTenants.map((existingTenant) => existingTenant.name);
      // Filter out multiple occurrences of the same name
      existingTenantNames = existingTenantNames.filter((value, index) => existingTenantNames.indexOf(value) === index);
      if (existingTenantNames.length >= 50) {
        throw new TenantError(`Too many tenant names ${existingTenantNames.length}`);
      }
      logger.debug(`tenant-service createTenant tenant name count: ${existingTenantNames.length}`);
      const archiveBucketName = cosHandlerInstance.getBucketForTenant(getConfig().ARCHIVE_BUCKET, undefined, tenant);

      if (!(await cosHandlerInstance.bucketExists(archiveBucketName))) {
        logger.debug(`tenant-service createTenant missing archive bucket ${archiveBucketName}`, tenant);
        throw new TenantError(`COS buckets must be manually created. Notify devOps to add ${archiveBucketName}`);
      }

      logger.debug(`tenant-service createTenant starting in mongo and cache`, tenant);
      await tenantInstance.create(tenant);
      logger.debug(`tenant-service createTenant done, returning status to caller`, tenant);

      // Returns true if there was already a tenant with the same name, false otherwise
      return existingTenantNames.some((existingTenantName) => tenant.name === existingTenantName);
    } catch (err) {
      logger.error(`tenant-service unable to create tenant ${JSON.stringify(tenant)}`, err);
      throw new TenantError(err);
    }
  }

  getAllTenants(): ITenant[] {
    try {
      const tenants = tenantInstance.getTenants();
      for (const tenant of tenants) {
        delete tenant.id;
      }
      return tenants;
    } catch (err) {
      logger.error('tenant-service getAllTenants could not load tenants', err);
      throw new TenantError(err);
    }
  }

  async deleteTenant(accountOrPrefix: string) {
    try {
      return await tenantInstance.delete(accountOrPrefix);
    } catch (err) {
      logger.error('tenant-service deleteTenant could not delete tenant', err);
      throw new TenantError(err);
    }
  }
}
