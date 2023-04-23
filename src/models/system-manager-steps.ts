import { ExchangeQueue, MessagingBindingAndRouting, SystemManagerStepDefinition } from '@symposium/usage-common';

export enum ExchangeNames {
  EXCHANGE_API_TO_ROUTER = 'api-to-router-exchange',
}

export enum QueueNames {
  QUEUE_API_ROUTING = 'api-routing',
  QUEUE_API_IASP = 'api-iasp',
  QUEUE_API_REPLAY = 'api-replay',
}

export enum ExchangeQueueGroupNames {
  GROUP_SEND_TO_ROUTER = 'Routing',
  GROUP_SEND_TO_ROUTER_IASP = 'IASP',
  GROUP_SEND_TO_ROUTER_FOR_REPLAY = 'Replay',
}

export const exchangeQueueMap: Map<ExchangeQueueGroupNames, ExchangeQueue> = new Map([
  [
    ExchangeQueueGroupNames.GROUP_SEND_TO_ROUTER,
    {
      exchangeName: ExchangeNames.EXCHANGE_API_TO_ROUTER,
      exchangeType: 'topic',
      queueName: QueueNames.QUEUE_API_ROUTING,
      routingNamespace: MessagingBindingAndRouting.ROUTE,
    },
  ],
  [
    ExchangeQueueGroupNames.GROUP_SEND_TO_ROUTER_IASP,
    {
      exchangeName: ExchangeNames.EXCHANGE_API_TO_ROUTER,
      exchangeType: 'topic',
      queueName: QueueNames.QUEUE_API_IASP,
      routingNamespace: MessagingBindingAndRouting.IASP,
    },
  ],
  [
    ExchangeQueueGroupNames.GROUP_SEND_TO_ROUTER_FOR_REPLAY,
    {
      exchangeName: ExchangeNames.EXCHANGE_API_TO_ROUTER,
      exchangeType: 'topic',
      queueName: QueueNames.QUEUE_API_REPLAY,
      routingNamespace: MessagingBindingAndRouting.REPLAY,
    },
  ],
]);

export const systemManagerStepDefinitionMap: Map<string, SystemManagerStepDefinition> = new Map([
  [
    'SendToRouterStep',
    {
      consumerExchangeQueueGroupName: undefined,
      producerExchangeQueueGroupNames: [
        ExchangeQueueGroupNames.GROUP_SEND_TO_ROUTER,
        ExchangeQueueGroupNames.GROUP_SEND_TO_ROUTER_FOR_REPLAY,
        ExchangeQueueGroupNames.GROUP_SEND_TO_ROUTER_IASP,
      ],
    },
  ],
]);
