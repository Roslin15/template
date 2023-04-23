import { ExchangeQueue, StepTemplate, logger, InternalError } from '@symposium/usage-common';

// Step which currently does nothing. This is just here so that system-manager will start up
// and manage a rabbit producer connected to router

export class SendToRouterStep extends StepTemplate {
  constructor(
    unhealthyCallback: StepTemplate['unhealthyCallback'],
    consumerENQ?: ExchangeQueue,
    producerENQs?: ExchangeQueue[]
  ) {
    super(unhealthyCallback, consumerENQ, producerENQs);
  }

  handleMessage = async () => {
    logger.error('SendToRouterStep handleMessage should not be called');
    throw new InternalError('SendToRouterStep handleMessage should not be called');
  };
}
