import {
  logger,
  MessagingBindingAndRouting,
  RequestReplayMessage,
  getErrorToThrow,
  BatchReplayMessage,
} from '@symposium/usage-common';
import { StatusCodes } from 'http-status-codes';
import { getRouterProducer } from '../steps/step-producer-getter';

export type ReplayRequest = RequestReplayMessage;

export interface RequestReplayStatus extends ReplayRequest {
  httpCode: StatusCodes;
}

export type BatchReplayStatus = BatchReplayMessage & { httpCode: StatusCodes };

export class ReplayService {
  replayMessage: RequestReplayMessage | BatchReplayMessage;

  constructor(replayRequest: RequestReplayMessage | BatchReplayMessage) {
    this.replayMessage = replayRequest;
  }

  // httpCode will be 202 if replay published successfully, error code otherwise
  async publishReplay(): Promise<RequestReplayStatus | BatchReplayStatus> {
    logger.info(`ReplayService publishReplay begin`, this.replayMessage);
    const redactedResponse = {
      ...this.replayMessage,
      superUserIamId: '***',
      email: undefined,
    };

    try {
      await getRouterProducer().publish(MessagingBindingAndRouting.REPLAY, this.replayMessage);
    } catch (error) {
      const errorToUse = getErrorToThrow(error);
      logger.warn(`ReplayService publishReplay failed. ${JSON.stringify(this.replayMessage)}`, errorToUse);

      return {
        ...redactedResponse,
        httpCode: errorToUse.statusCode,
      };
    }

    logger.info('ReplayService publishReplay succeeded', this.replayMessage);
    return {
      ...redactedResponse,
      httpCode: StatusCodes.ACCEPTED,
    };
  }
}
