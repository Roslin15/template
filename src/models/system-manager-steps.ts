import { ExchangeQueue, MessagingBindingAndRouting, SystemManagerStepDefinition } from '@symposium/usage-common';
// These values are to be defined by services using the system mamager

// Create enums defining names
enum ExchangeNames {
  EXCHANGE_TEMPLATE_STEP = 'template-exchange-step',
  EXCHANGE_TEMPLATE_NEXT = 'template-exchange-next',
}
enum QueueNames {
  QUEUE_TEMPLATE_ENRICH = 'template-queue-enrich',
  QUEUE_TEMPLATE_NEXT = 'template-queue-next',
  QUEUE_TEMPLATE_FAIL = 'template-queue-fail',
}

export enum ExchangeQueueGroupNames { // not a step name but what they are being used
  MOCK_STEP_GROUP = 'mockStepGroup',
  MOCK_NEXT_STEP_GROUP = 'mockNextGroup',
  MOCK_FAIL_STEP_GROUP = 'mockFailGroup',
}

// Create groupings
export const exchangeQueueMap: Map<ExchangeQueueGroupNames, ExchangeQueue> = new Map([
  [
    ExchangeQueueGroupNames.MOCK_STEP_GROUP,
    {
      exchangeName: ExchangeNames.EXCHANGE_TEMPLATE_STEP,
      exchangeType: 'topic',
      queueName: QueueNames.QUEUE_TEMPLATE_ENRICH,
      routingNamespace: MessagingBindingAndRouting.ENRICH,
    },
  ],
  [
    ExchangeQueueGroupNames.MOCK_NEXT_STEP_GROUP,
    {
      exchangeName: ExchangeNames.EXCHANGE_TEMPLATE_NEXT,
      exchangeType: 'topic',
      queueName: QueueNames.QUEUE_TEMPLATE_NEXT,
      routingNamespace: MessagingBindingAndRouting.ENRICH,
    },
  ],
  [
    ExchangeQueueGroupNames.MOCK_FAIL_STEP_GROUP,
    {
      exchangeName: ExchangeNames.EXCHANGE_TEMPLATE_NEXT,
      exchangeType: 'topic',
      queueName: QueueNames.QUEUE_TEMPLATE_FAIL,
      routingNamespace: MessagingBindingAndRouting.FAIL,
    },
  ],
]);

// note: would need the other groups added to this map

// Create the definiton mapping each step to it's consumer and producer groups
export const systemManagerStepDefinitionMap: Map<string, SystemManagerStepDefinition> = new Map([
  [
    'MockStep',
    {
      consumerExchangeQueueGroupName: ExchangeQueueGroupNames.MOCK_STEP_GROUP,
      producerExchangeQueueGroupNames: [
        ExchangeQueueGroupNames.MOCK_NEXT_STEP_GROUP,
        ExchangeQueueGroupNames.MOCK_FAIL_STEP_GROUP,
      ],
    },
  ],
]);
