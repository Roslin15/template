import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ITenant, logger } from '@symposium/usage-common';
import { TenantService } from '../../services/tenant-service';

export const getAllTenants = async (_req: Request, res: Response) => {
  logger.info('tenant getAllTenants: getting details of all tenants');
  const tenantService = new TenantService();
  try {
    await tenantService.refresh();
    const tenants = tenantService.getAllTenants();
    res.status(StatusCodes.OK).json(tenants);
  } catch (err) {
    logger.error('tenant getAllTenants failed', err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR);
  }
};

export const deleteTenant = async (req: Request, res: Response) => {
  logger.info(`tenant deleteTenant: delete Tenant by accountOrPrefix, ${req.params.accountOrPrefix}`);
  const tenantService = new TenantService();
  try {
    await tenantService.deleteTenant(req.params.accountOrPrefix);
    res.status(StatusCodes.OK).json({
      result: 'success',
      message: `accountOrPrefix ${req.params.accountOrPrefix} deleted from mongo. Restart all pods for this change to take effect.`,
    });
  } catch (err) {
    logger.error('tenant deleteTenant failed', err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ result: 'failure' });
  }
};

export const createTenant = async (req: Request, res: Response) => {
  logger.info('tenant createTenant: received requestBody', req.body);
  const tenantService = new TenantService();
  try {
    const tenant = req.body as ITenant;
    // Returns true if we added to an existing tenant, false if we created a new one
    const existed = await tenantService.createTenant(tenant);
    if (existed) {
      res.status(StatusCodes.ACCEPTED).json({
        result: 'success',
        message: `accountOrPrefix ${tenant.accountOrPrefix} added to existing tenant with same name ${tenant.name}. Restart all pods for this change to take effect.`,
      });
    } else {
      res.status(StatusCodes.ACCEPTED).json({
        result: 'success',
        message: `accountOrPrefix ${tenant.accountOrPrefix} added to new tenant. WARN:Restart all pods for this change to take effect.`,
      });
    }
  } catch (err) {
    logger.error('tenant createTenant failed', err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({ result: 'failure' });
  }
};
