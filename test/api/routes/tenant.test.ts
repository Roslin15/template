import { TenantIdTypes } from '@symposium/usage-common';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { createTenant, deleteTenant, getAllTenants } from '../../../src/api/routes/tenant';
import { TenantService } from '../../../src/services/tenant-service';

jest.mock('../../../src/services/tenant-service');
const MockedTenantService = TenantService as jest.MockedClass<typeof TenantService>;
describe('tenant', () => {
  const status = jest.fn();
  const json = jest.fn();
  const mockReq = {} as Request;
  const mockRes = () => {
    const res = {} as Response;
    res.status = status.mockReturnValue(res);
    res.json = json;
    return res;
  };

  beforeEach(() => {
    MockedTenantService.mockClear();
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  test('Happy Path for getAllTenants', async () => {
    MockedTenantService.prototype.getAllTenants.mockReturnValue([
      { type: TenantIdTypes.ACCOUNT_ID, name: 'test-name', rhmTest: true, accountOrPrefix: '610176e5d2e7a81111111111' },
    ]);
    await getAllTenants(mockReq, mockRes());
    expect(status).toBeCalledWith(StatusCodes.OK);
    expect(MockedTenantService.prototype.refresh).toBeCalled();
    expect(MockedTenantService.prototype.getAllTenants).toBeCalled();
    expect(json).toBeCalledWith([
      { type: 'accountId', name: 'test-name', rhmTest: true, accountOrPrefix: '610176e5d2e7a81111111111' },
    ]);
  });

  test('getAllTenants handles error', async () => {
    MockedTenantService.prototype.getAllTenants.mockImplementationOnce(() => {
      throw new Error('err');
    });
    await getAllTenants(mockReq, mockRes());
    expect(status).toBeCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
  });

  test('Happy path for deleteTenant', async () => {
    mockReq.params = {
      accountOrPrefix: 'accountOrPrefix-1',
    };
    await deleteTenant(mockReq, mockRes());
    expect(TenantService.prototype.deleteTenant).toBeCalledWith('accountOrPrefix-1');
    expect(status).toBeCalledWith(StatusCodes.OK);
    expect(json).toBeCalledWith({
      result: 'success',
      message: 'accountOrPrefix accountOrPrefix-1 deleted from mongo. Restart all pods for this change to take effect.',
    });
  });

  test('deleteTenant handles error', async () => {
    mockReq.params = {
      accountOrPrefix: 'accountOrPrefix-1',
    };
    MockedTenantService.prototype.deleteTenant.mockRejectedValueOnce(new Error('err'));
    await deleteTenant(mockReq, mockRes());
    expect(status).toBeCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(json).toBeCalledWith({ result: 'failure' });
  });

  test('Happy Path for createTenant (added to existing)', async () => {
    mockReq.body = {
      accountOrPrefix: 'accountOrPrefix-1',
      name: 'name1',
      type: TenantIdTypes.ACCOUNT_ID,
    };
    MockedTenantService.prototype.createTenant.mockResolvedValueOnce(true);
    await createTenant(mockReq, mockRes());
    expect(status).toBeCalledWith(StatusCodes.ACCEPTED);
    expect(json).toBeCalledWith({
      result: 'success',
      message:
        'accountOrPrefix accountOrPrefix-1 added to existing tenant with same name name1. Restart all pods for this change to take effect.',
    });
  });

  test('Happy Path for createTenant (created new)', async () => {
    mockReq.body = {
      accountOrPrefix: 'accountOrPrefix-1',
      name: 'name1',
      type: TenantIdTypes.ACCOUNT_ID,
    };
    MockedTenantService.prototype.createTenant.mockResolvedValueOnce(false);
    await createTenant(mockReq, mockRes());
    expect(status).toBeCalledWith(StatusCodes.ACCEPTED);
    expect(json).toBeCalledWith({
      result: 'success',
      message:
        'accountOrPrefix accountOrPrefix-1 added to new tenant. WARN:Restart all pods for this change to take effect.',
    });
  });

  test('createTenant handles error', async () => {
    mockReq.body = {
      accountOrPrefix: 'accountOrPrefix-1',
      name: 'name1',
      type: TenantIdTypes.ACCOUNT_ID,
    };
    MockedTenantService.prototype.createTenant.mockRejectedValueOnce(new Error('err'));
    await createTenant(mockReq, mockRes());
    expect(status).toBeCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(json).toBeCalledWith({ result: 'failure' });
  });
});
