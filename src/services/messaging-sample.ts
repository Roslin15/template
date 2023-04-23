/* istanbul ignore file */
import { ExchangeQueue, logger, MessagePipeline, Producer } from '@symposium/usage-common';
import { rabbitMQConnectionManager } from '../loaders/rabbitmq-loader';
import { ExchangeQueueGroupNames, exchangeQueueMap } from '../models/system-manager-steps';

// populate queue with messages which will be consumed by mock steps configured in system manager
export const runMessagingSample = async () => {
  logger.verbose(`runMessagingSample start`);

  logger.verbose(`runMessagingSample generate some messges on an input queue`);
  const numberOfMessage = 2;

  // Reusing existing set-up but this code should be handled much more gracefully in the real code
  const mockStepEnQ = exchangeQueueMap.get(ExchangeQueueGroupNames.MOCK_STEP_GROUP);
  const nextStepEnQ = exchangeQueueMap.get(ExchangeQueueGroupNames.MOCK_NEXT_STEP_GROUP);
  const failStepEnQ = exchangeQueueMap.get(ExchangeQueueGroupNames.MOCK_FAIL_STEP_GROUP);
  const producerSetupArray: ExchangeQueue[] = [];
  if (mockStepEnQ) {
    producerSetupArray.push(mockStepEnQ);
  }
  const producerMockStepArray: ExchangeQueue[] = [];
  if (nextStepEnQ && failStepEnQ) {
    producerMockStepArray.push(nextStepEnQ);
    producerMockStepArray.push(failStepEnQ);
  }

  try {
    const producer = new Producer(rabbitMQConnectionManager.getProducerConnection(), producerSetupArray);
    await producer.init();

    for (let i = 0; i < numberOfMessage; i++) {
      const correlationId = Date.now().toString();
      const mesage: MessagePipeline = { correlationId, accountOrPrefix: i.toString(), statusId: i.toString() };
      await producer.publishToEnrich(mesage);
    }
  } catch (error) {
    logger.warn(`runMessagingExample problem publishing to MockStepGroup to start sample`);
  }
};
