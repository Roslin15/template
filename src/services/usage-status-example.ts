/* istanbul ignore file */
import {
  logger,
  mongoImpl,
  RequestTypes,
  StatusStates,
  TenantIdTypes,
  tenantInstance,
  UsageStatus,
} from '@symposium/usage-common';

export const runMongoStatusExample = async () => {
  const USAGE_CONFIG = 'usage-config';
  const TENANT_COLLECTION = 'tenant';

  const seed = [
    {
      id: '613cb9530ec9807ca1ac5361',
      type: TenantIdTypes.ACCOUNT_ID,
      accountOrPrefix: 'sample-account',
      name: 'tenant1',
      rhmTest: true,
    },
    {
      id: '613cbda86cf9a7755313a932',
      type: TenantIdTypes.COS_PREFIX,
      accountOrPrefix: 'sample-prefix',
      name: 'tenant1',
      rhmTest: true,
    },
  ];

  let status: UsageStatus;
  try {
    // seed with example tenants
    await mongoImpl.client.db(USAGE_CONFIG).collection(TENANT_COLLECTION).insertMany(seed);
    logger.verbose(`Loaded tenant mocks to mongo, rerunning init to get in memory`);
    await tenantInstance.initCache();
    // now remove example tenants
    await mongoImpl.client.db(USAGE_CONFIG).collection(TENANT_COLLECTION).deleteMany({ name: 'tenant1' });
    const tenant = tenantInstance.get(seed[0].accountOrPrefix);
    logger.debug(`Get By Id result`, { tenant });
    // supplying tenant name here uses only tenant dbs
    status = new UsageStatus();
    // with id, updates, with no id, insert
    await status.create({
      accountId: 'accountId1234',
      inputFileName: 'd592fa8f-8d82-48ec-90c9-18affe37bf96-file.tar.gz',
      endTime: 1631108565783,
      eventId: 'b75a4618-5d13-4670-b004-2d99c2dd10e6',
      finalResult: StatusStates.SUCCESS,
      requestId: 'e7f4a8dd-d58e-4397-8a68-035dfa607ec4',
      requestType: RequestTypes.V2_METRICS,
      startTime: 1631108564783,
      type: 'Not sure',
      userResponseReturned: true,
      replayAttempt: 0,
    });
  } catch (err) {
    logger.error(`************* Error on Usage Status Example *************`, err);
  }
};
