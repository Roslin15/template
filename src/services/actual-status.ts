import {
  logger,
  Status,
  StatusStates,
  StatusStep,
  NotFound,
  UsageEvent,
  UsageContainerSubscription,
  UsageContainerSubscriptionCollection,
  getErrorToThrow,
} from '@symposium/usage-common';
import { statusHandlerInstance } from '../loaders/status-loader';
import { usageEventHandlerInstance } from '../loaders/usage-event-loader';

export interface UsageEventResponse {
  status: Partial<Status>;
  statusStep?: Array<StatusStep>;
  usageEvent: {
    usage: UsageEvent['usage'];
    enrichment?: UsageEvent['enrichment'];
    metrics?: UsageEvent['metrics'];
  };
  usageContainerSubscription?: UsageContainerSubscription | string;
}

export type StatusResponseObject = Partial<Status> & { status?: string /* final result */ };

export interface StatusRequestResponse {
  status: StatusResponseObject;
  statusStep?: Array<StatusStep>;
  eventStatus: Array<{
    eventId: string;
    status: string;
  }>;
}
export interface GetStatusRequestParams {
  correlationId?: string;
  requestId?: string;
  usageEventId?: string;
  accountId?: string;
}
export class ActualStatus {
  statusParams: GetStatusRequestParams;
  accountOrPrefix: string | null;
  detailed?: boolean;

  constructor(_statusParams: GetStatusRequestParams, _accountOrPrefix: string | null, _detailed?: boolean) {
    this.statusParams = _statusParams;
    this.detailed = _detailed;
    this.accountOrPrefix = _accountOrPrefix;
  }

  async getStatusByUsageEventId(): Promise<Array<UsageEventResponse>> {
    logger.debug('ActualStatus getStatusByUsageEventId: ', this.statusParams);

    try {
      const usageEventArray: Array<UsageEvent> = await usageEventHandlerInstance.getByEventAndAccountId(
        this.statusParams.usageEventId!,
        this.statusParams.accountId!,
        this.accountOrPrefix
      );

      if (!usageEventArray.length) {
        const errMsg = 'usageEvents are not found';
        logger.error(`ActualStatus getStatusByUsageEventId failed: ${JSON.stringify(this.statusParams)} `, errMsg);
        throw new NotFound(errMsg);
      }

      return Promise.all(
        usageEventArray.map(async (usageEvent) => {
          const { enrichment, usage, statusId, metrics } = usageEvent;

          let usageEventResponse: UsageEventResponse = {
            status: {} as Status,
            usageEvent: {
              usage,
              ...(this.detailed && { enrichment, metrics }),
            },
          };

          if (this.detailed) {
            logger.info('ActualStatus getStatusByUsageEventId getConsolidatedStatus: ', {
              ...this.statusParams,
              accountOrPrefix: this.accountOrPrefix,
              statusId,
            });

            const { statusSteps, ...status } = await statusHandlerInstance.getConsolidatedStatus(
              {
                id: statusId,
              },
              this.accountOrPrefix
            );

            if ('enrichment' in usageEvent && 'usageContainerSubscriptionId' in usageEvent.enrichment) {
              logger.debug('ActualStatus getStatusByUsageEventId UsageContainer: ', {
                ...this.statusParams,
                id: enrichment.usageContainerSubscriptionId,
              });

              try {
                usageEventResponse.usageContainerSubscription =
                  await new UsageContainerSubscriptionCollection().getUsageContainer({
                    id: enrichment.usageContainerSubscriptionId!,
                  });
              } catch (err) {
                if (err instanceof NotFound) {
                  logger.debug(`ActualStatus getStatusByUsageEventId usageContainerSubscription not found`, {
                    ...this.statusParams,
                    id: enrichment.usageContainerSubscriptionId,
                  });
                  usageEventResponse.usageContainerSubscription = 'not found';
                } else {
                  logger.error(`ActualStatus getStatusByUsageEventId usageContainerSubscription`, err);
                  throw err;
                }
              }
            }

            usageEventResponse = {
              ...usageEventResponse,
              status,
              statusStep: statusSteps,
            };
          } else {
            logger.info('ActualStatus getStatusByUsageEventId getStatus: ', {
              ...this.statusParams,
              accountOrPrefix: this.accountOrPrefix,
              statusId,
            });

            const status = await statusHandlerInstance.getStatus(
              {
                id: statusId,
              },
              this.accountOrPrefix
            );

            usageEventResponse = {
              ...usageEventResponse,
              status,
            };

            delete usageEventResponse.status.id;
          }

          logger.debug('ActualStatus getStatusByUsageEventId succeeded ', this.statusParams);

          return usageEventResponse;
        })
      );
    } catch (error) {
      const errorToUse = getErrorToThrow(error);
      logger.error(`ActualStatus getStatusByUsageEventId failed: ${JSON.stringify(this.statusParams)} `, errorToUse);
      throw errorToUse;
    }
  }

  async getStatusByRequestAndCorrelationId(): Promise<StatusRequestResponse> {
    let statusRequestResponse: StatusRequestResponse;
    let statuses: Array<Status>;
    try {
      logger.info(`ActualStatus getStatusByRequestAndCorrelationId status params:`, this.statusParams);

      if (this.statusParams.requestId) {
        statuses = await statusHandlerInstance.getManyStatuses(
          {
            requestId: this.statusParams.requestId,
            accountOrPrefix: this.accountOrPrefix,
          },
          this.accountOrPrefix
        );
      } else {
        statuses = await statusHandlerInstance.getManyStatuses(
          {
            correlationId: this.statusParams.correlationId!,
          },
          this.accountOrPrefix
        );
      }

      if (!statuses.length) {
        const errMsg = 'statuses are not found';
        logger.error(
          `ActualStatus getStatusByRequestAndCorrelationId failed: ${JSON.stringify(this.statusParams)} `,
          errMsg
        );
        throw new NotFound(errMsg);
      }

      let requestStatus: StatusResponseObject;
      const eventsWithStatus: { eventId: string; status: string }[] = [];

      statuses.forEach((status) => {
        const finalResult: string = this.getFinalResult(status);
        if (status.eventId) {
          eventsWithStatus.push({ eventId: status.eventId, status: finalResult });
        } else {
          requestStatus = { ...status, status: finalResult };
        }
      });

      statusRequestResponse = {
        status: requestStatus!,
        eventStatus: eventsWithStatus,
      };

      if (this.detailed) {
        logger.verbose(`ActualStatus getStatusByRequestAndCorrelationId detailed=true:`, this.statusParams);
        const consolidatedStatus = await statusHandlerInstance.getConsolidatedStatus(
          {
            id: statusRequestResponse.status.id!,
          },
          this.accountOrPrefix
        );
        const { statusSteps } = consolidatedStatus;

        statusRequestResponse.statusStep = statusSteps;
      } else {
        delete statusRequestResponse.status.id;
        delete statusRequestResponse.status.finalResult;
      }

      return statusRequestResponse;
    } catch (error) {
      const errorToUse = getErrorToThrow(error);
      logger.error(
        `ActualStatus getStatusByRequestAndCorrelationId failed: ${JSON.stringify(this.statusParams)}`,
        errorToUse
      );
      throw errorToUse;
    }
  }

  private getFinalResult(status: Status) {
    if (this.detailed) {
      return status.finalResult || 'inprogress';
    }

    if (!status.finalResult) {
      return 'inprogress';
    }

    switch (status.finalResult) {
      case StatusStates.SUCCESS:
      case StatusStates.MULTI_STATUS:
        return status.finalResult;
      case StatusStates.USER_ERROR:
      case StatusStates.UNPROCESSABLE:
        return 'failed';
      default:
        // Aborted and system error stay as 'inprogress'
        return 'inprogress';
    }
  }
}
