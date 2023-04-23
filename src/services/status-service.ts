import { UsageEvent, Status, logger, TarImpl, StatusStates, ExpandedArchive } from '@symposium/usage-common';
import { getConfig } from '../config/config';
import { statusHandlerInstance } from '../loaders/status-loader';
import { CosService } from './cos-service';

export interface V1Response {
  status: string;
  message: string;
  errorDetails?: Array<string>;
  data: {
    payload: UsageEvent['usage'];
    status: string;
    batchId: string;
  }[];
}

export enum V1RequestStatus {
  INPROGRESS = 'inprogress',
  ACCEPTED = 'accepted',
  FAILED = 'failed',
}

// TODO: This will be changed as per the future stories of V1Metric Epic
export class StatusService {
  correlationId?: string;
  requestId?: string;
  accountOrPrefix?: string | null;
  requestStatus?: Status;

  constructor(_id: string, _accountOrPrefix?: string | null) {
    if (this.isCorrelationId(_id)) {
      this.correlationId = _id;
    } else {
      this.requestId = _id;
    }
    this.accountOrPrefix = _accountOrPrefix;
  }

  /*
   * Determines type of identifier, correlationId is a uuid while the requestId is hash
   */
  isCorrelationId(id: string) {
    const uuidRegexExp = /^[0-9A-F]{8}\b-[0-9A-F]{4}\b-[0-9A-F]{4}\b-[0-9A-F]{4}\b-[0-9A-F]{12}$/gi;
    return uuidRegexExp.test(id);
  }

  async getRequestStatusByCorrelationIdOrRequestId(): Promise<Status> {
    let requestStatus: Status;

    try {
      if (this.correlationId) {
        logger.debug(
          `StatusService getRequestStatusByCorrelationIdOrRequestId getting status by Correlation Id ${this.correlationId}`
        );

        requestStatus = await statusHandlerInstance.getByCorrelationId(
          {
            correlationId: this.correlationId,
            eventId: null,
          },
          this.accountOrPrefix || null
        );

        this.requestId = requestStatus.requestId;

        return requestStatus;
      }

      logger.debug(
        `StatusService getRequestStatusByCorrelationIdOrRequestId getting status by Request Id ${this.requestId}`
      );

      requestStatus = await statusHandlerInstance.getByRequestId({
        requestId: this.requestId!,
        accountOrPrefix: this.accountOrPrefix || null,
        eventId: null,
      });

      this.correlationId = requestStatus.correlationId;

      return requestStatus;
    } catch (error) {
      logger.error(`StatusService getRequestStatusByCorrelationIdOrRequestId failed ${error}`);
      throw error;
    }
  }

  async getUsageEventsFromCos(): Promise<Array<UsageEvent['usage']>> {
    try {
      const { INCOMING_MESSAGE_QUEUE_BUCKET, ARCHIVE_BUCKET } = getConfig();
      this.requestStatus = await this.getRequestStatusByCorrelationIdOrRequestId();
      const file = await new CosService(`${this.requestId}.tar.gz`, this.accountOrPrefix || undefined).downloadFile(
        ARCHIVE_BUCKET,
        INCOMING_MESSAGE_QUEUE_BUCKET
      );

      // Expand zipped file, it will return array of events
      const tar = new TarImpl();
      const expandedArchive: ExpandedArchive = await tar.expandArchive(file, this.correlationId);
      const parsedExpandedArchive = tar.parseExpandedArchive(expandedArchive);
      const usageEvents = [];
      for (const fileName of Object.keys(parsedExpandedArchive)) {
        usageEvents.push(...parsedExpandedArchive[fileName].data);
      }
      logger.debug(
        `StatusService getUsageEventsFromCos success with requestId: ${this.requestId}, correlationId: ${this.correlationId}`
      );

      return usageEvents;
    } catch (error) {
      logger.error(
        `StatusService getUsageEventsFromCos failed with requestId: ${this.requestId}, correlationId: ${this.correlationId}`,
        error
      );
      throw error;
    }
  }

  commonMetricResponse(usageEvents?: Array<UsageEvent['usage']>, finalStatus?: V1RequestStatus): V1Response {
    let updatedMetricResponse: V1Response['data'] = [];
    if (usageEvents?.length) {
      // status is hardcoded to inprogress since previous metering endpoint from which code was migrated did so
      // at some future point we fix this to return correct usage event status
      updatedMetricResponse = usageEvents.map((usage: UsageEvent['usage']) => {
        return { status: 'inprogress', batchId: this.correlationId || '', payload: usage };
      });
    }

    if (finalStatus) {
      return {
        status: finalStatus,
        message: 'One or more events are in progress or failed to process.',
        data: updatedMetricResponse,
      };
    }
    if (this.requestStatus?.finalResult === StatusStates.SUCCESS) {
      finalStatus = V1RequestStatus.ACCEPTED;
    } else if (
      this.requestStatus?.finalResult === StatusStates.USER_ERROR ||
      this.requestStatus?.finalResult === StatusStates.MULTI_STATUS ||
      this.requestStatus?.finalResult === StatusStates.UNPROCESSABLE
    ) {
      finalStatus = V1RequestStatus.FAILED;
    } else {
      finalStatus = V1RequestStatus.INPROGRESS;
    }

    return {
      status: finalStatus,
      message: 'One or more events are in progress or failed to process.',
      data: updatedMetricResponse,
    };
  }
}
