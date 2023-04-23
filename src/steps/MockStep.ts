/* istanbul ignore file */
import { StepTemplate, AmqplibMessage, logger, ExchangeQueue, MessagePipeline } from '@symposium/usage-common';

export class MockStep extends StepTemplate {
  constructor(
    unhealthyCallback: StepTemplate['unhealthyCallback'],
    consumerENQ?: ExchangeQueue,
    producerENQs?: ExchangeQueue[]
  ) {
    super(unhealthyCallback, consumerENQ, producerENQs);
  }

  handleMessage = async (msg: AmqplibMessage | null) => {
    // SHOULD BE SOME LOGIC to create a new instance and run that business logic
    await this.singleInstanceBusinessLogic(msg);
  };

  async singleInstanceBusinessLogic(amqpMessage: AmqplibMessage | null): Promise<boolean> {
    logger.debug(`MockStep singleInstanceBusinessLogic message received ${amqpMessage?.content.toString()}`);
    if (!amqpMessage) {
      return false;
    }
    let msgStringContent: string = '';
    let msgJsonContent: MessagePipeline;

    try {
      msgStringContent = amqpMessage.content.toString();
      logger.debug('MockStep singleInstanceBusinessLogic string content', msgStringContent);

      msgJsonContent = JSON.parse(msgStringContent) as MessagePipeline;
      logger.debug('MockStep singleInstanceBusinessLogic publish to next queue after good processing', msgJsonContent);
      await this.stepProducer!.publishToEnrich(msgJsonContent);

      logger.debug('MockStep singleInstanceBusinessLogic ACK the message', msgJsonContent);
      this.stepConsumer!.ackOnChannel(amqpMessage);
      return true; // message was handled
    } catch (error) {
      logger.error(`MockStep singleInstanceBusinessLogic NACK the message`, error);
      this.stepConsumer!.nackOnChannel(amqpMessage);
      return false;
    }
  }
}
