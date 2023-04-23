/* istanbul ignore file */
import { CommerceApi, CommerceHealth, AccountHealth, logger, UsageEventCollection } from '@symposium/usage-common';

const group = 'c8b82d189e7545f0892db9ef2731b90d.licensing.ibm.com';
const kind = 'IBMLicensing';
const metricId = 'VIRTUAL_PROCESSOR_CORE';

const measuredUsage = {
  metricId: metricId,
  value: 4,
  additionalAttributes: { measuredValue: '4' },
};

const usageEventSeed = {
  accountOrPrefix: null,
  statusId: '623119f1380ca22cbec1972f',
  usage: {
    accountId: '5e99d8da07f07c0013954599',
    eventId: '222222ed3fd01e52521',
    start: 1641013200000,
    end: 1641099600000,
    subscriptionId: '60aeb45fddecf33634d41982',
    additionalAttributes: {
      clusterId: '58e7454d-595b-4c3a-b2a7-d7ca4c5c76d4',
      group: group,
      kind: kind,
      metricType: 'license',
      source: 'LS',
    },
    measuredUsage: [measuredUsage],
  },
  enrichment: {},
};

export const runCommerceApiExample = async () => {
  try {
    logger.info(`commerce example getBestEditionAndStoreOnEnrichment`);
    const commerceApi = new CommerceApi(new AccountHealth(), new CommerceHealth(), 'correlationId');
    const usageEvent = await new UsageEventCollection().create(usageEventSeed);

    const { edition, updatedUsageEvent } = await commerceApi.getBestEditionAndStoreOnEnrichment(
      { group, kind, metricIds: [metricId] },
      usageEvent,
      null
    );

    logger.info(`best match edition found and enrichment updated with edition info`, {
      edition,
      updatedUsageEvent,
    });
  } catch (e: unknown) {
    logger.error(`Run CommerceApi example failed`, e);
  }
};
