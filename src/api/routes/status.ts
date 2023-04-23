import { statusHandlerInstance } from '../../loaders/status-loader';
import {
  InternalError,
  logger,
  NotFound,
  Status,
  StatusStates,
  censorshipReplacer,
  GetStatusParams,
  ConsolidatedStatus,
  InvalidRequestError,
  getErrorToThrow,
  GetManyStatusParams,
  AuthLocals,
} from '@symposium/usage-common';
import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { StatusService, V1RequestStatus } from '../../services/status-service';
import { ActualStatus, GetStatusRequestParams, StatusResponseObject } from '../../services/actual-status';

export const isSuperUser = (req: Request): boolean => {
  return req.headers['is-super-user'] === 'true';
};

export const shouldShowDetailed = (req: Request): boolean => {
  return isSuperUser(req) && req.query.detailed === 'true';
};

export const getV2MetricsDefaultResponse = (requestStatus: Status) => {
  if (!requestStatus.finalResult) {
    return { finalStatus: 'inprogress', finalMessage: 'inprogress' };
  }

  switch (requestStatus.finalResult) {
    case StatusStates.SUCCESS:
    case StatusStates.MULTI_STATUS:
      return { finalStatus: requestStatus.finalResult, finalMessage: requestStatus.finalResult };
    case StatusStates.USER_ERROR:
    case StatusStates.UNPROCESSABLE:
      return {
        finalStatus: 'failed',
        finalMessage: requestStatus.errorResponseMessage
          ? `${requestStatus.finalResult}: ${requestStatus.errorResponseMessage}`
          : requestStatus.finalResult,
        errorCode: requestStatus.errorCode,
      };
    default:
      return { finalStatus: 'inprogress', finalMessage: 'inprogress' };
  }
};

export const getUploadStatus = async (req: Request, res: Response, next: NextFunction) => {
  logger.debug(`status getUploadStatus getting status by correlationId or requestId: ${req.params.id}`);
  // If auth was an access token, then rhmAccountId will not be set, but tokenIamId will.
  // If auth was pull secret, vice versa.
  if (!res.locals.tokenIamId && !req.headers?.rhmAccountId) {
    return next(new InternalError('Must either have rhmAccountId header or tokenIamId local set'));
  }

  try {
    let requestStatus: Status | ConsolidatedStatus;
    const accountOrPrefix = calculateAccountOrPrefix(req);

    const statusService = new StatusService(req.params.id, accountOrPrefix);
    const { correlationId, requestId } = statusService;

    let logObject: { [key: string]: unknown } = {
      accountOrPrefix,
      correlationId,
      requestId,
    };

    if (shouldShowDetailed(req)) {
      logger.verbose('status getUploadStatus getting detailed status ', logObject);

      const statusParams: GetStatusParams = correlationId
        ? {
            correlationId,
            eventId: null,
          }
        : {
            requestId: requestId!,
            accountOrPrefix,
            eventId: null,
          };

      requestStatus = await statusHandlerInstance.getConsolidatedStatus(statusParams, accountOrPrefix);
    } else {
      logger.verbose('status getUploadStatus getting status ', logObject);
      requestStatus = await statusService.getRequestStatusByCorrelationIdOrRequestId();
    }

    logObject = {
      ...logObject,
      accountId: requestStatus.accountId,
      requestId: requestStatus.requestId || logObject.requestId,
      correlationId: requestStatus.correlationId || logObject.correlationId,
    };

    logger.verbose(`status getUploadStatus status: ${requestStatus.finalResult ?? 'in progress'}.`, logObject);
    logger.debug(`status getUploadStatus requestStatus:`, requestStatus);

    if (!canViewStatus(req, res, requestStatus)) {
      logger.warn(`status getUploadStatus requester does not have permission to view status.`, {
        accountOrPrefix,
        statusAccount: requestStatus.accountId,
        ...logObject,
      });
      return next(new NotFound('Not found'));
    }

    // Remove redacted fields
    requestStatus = JSON.parse(JSON.stringify(requestStatus, censorshipReplacer));

    const { finalStatus, finalMessage, errorCode } = getV2MetricsDefaultResponse(requestStatus);

    res.status(StatusCodes.OK).json({
      status: finalStatus,
      message: finalMessage,
      errorCode,
      ...(shouldShowDetailed(req) && { detailed: requestStatus }),
    });
  } catch (err) {
    logger.error(`status getUploadStatus Error getting status with correlationId or requestId: ${req.params.id} `, err);
    return next(err);
  }
};

export const getV1MetricsService = async (req: Request, res: Response) => {
  logger.debug(`status getV1MetricsService getting status correlationId or requestId: ${req.params.id}`);

  const accountOrPrefix = calculateAccountOrPrefix(req);

  const statusService = new StatusService(req.params.id, accountOrPrefix);

  try {
    // getUsageEventsFromCos sets statusService.requestStatus as a side effect
    const usageEvents = await statusService.getUsageEventsFromCos();
    if (!canViewStatus(req, res, statusService.requestStatus!)) {
      logger.warn(`status getV1MetricsService requester does not have permission to view status.`, {
        accountOrPrefix,
        statusAccount: statusService.requestStatus!.accountId,
      });
      throw new NotFound('Not found');
    }
    res.status(StatusCodes.ACCEPTED).json(statusService.commonMetricResponse(usageEvents));
  } catch (err: unknown) {
    const errorToUse = getErrorToThrow(err);
    logger.error(`status getV1MetricsService failed correlationId or requestId: ${req.params.id} `, err);
    res.status(errorToUse.statusCode).json({
      status: V1RequestStatus.FAILED,
      errorCode: errorToUse.code,
      message: errorToUse.message,
    });
  }
};

export const getAbortedStatus = async (req: Request, res: Response) => {
  const tenant = typeof req.query.tenant === 'string' && req.query.tenant ? req.query.tenant : null;
  const abortedStatusFilter: GetManyStatusParams = { finalResult: StatusStates.ABORTED };
  if (req.query.eventIdPresent) {
    abortedStatusFilter.eventId = { $exists: req.query.eventIdPresent === 'true' };
  }
  logger.debug(`status getAbortedStatus start`, abortedStatusFilter);
  const abortedStatuses = await statusHandlerInstance.getManyStatuses(abortedStatusFilter, tenant);
  res.status(StatusCodes.OK).json({ data: abortedStatuses, count: abortedStatuses.length });
};

// True if the caller can view the given status, false otherwise
export const canViewStatus = (req: Request, res: Response<unknown, AuthLocals>, status: Partial<Status>): boolean => {
  // Superuser can see anything
  if (isSuperUser(req)) {
    return true;
  }
  // If the user belongs to an account, accountId must match
  if (req.headers.rhmAccountId) {
    return status.accountId === req.headers.rhmAccountId;
  }
  // If auth by access token iamId must match
  if (res.locals.authMethod === 'accessToken') {
    return status.iamId === res.locals.tokenIamId;
  }
  return false;
};

export const calculateAccountOrPrefix = (req: Request): string | null => {
  // If this is a super user, use the the accountOrPrefix from query params (null if not provided).
  // If this is a vendor, use null (vendor data is not tenanted).
  // Otherwise, use the rhmAccountId decoded from the user's token.

  if (isSuperUser(req) && req.query.accountOrPrefix) {
    return req.query.accountOrPrefix as string;
  }
  if (req.headers.rhmAccountId) {
    return req.headers.rhmAccountId as string;
  }
  return null;
};

const getStatusParams = (req: Request) => {
  // accountId gets set in request headers when auth is by pull secret or IBM entitlement key
  // for all other auth requests accountId can be passed in query params
  const accountId = (req.headers.rhmAccountId as string) ?? req.query.accountId;

  return {
    accountId,
    ...(req.params.correlationId && { correlationId: req.params.correlationId }),
    ...(req.params.usageEventId && { usageEventId: req.params.usageEventId }),
    ...(req.params.requestId && { requestId: req.params.requestId }),
  };
};

export const censorStatus = (status: StatusResponseObject, detailed: boolean = false) => {
  status = JSON.parse(JSON.stringify(status, censorshipReplacer));
  if (!detailed) {
    delete status.iamId;
    delete status.iui;
    delete status.email;
    delete status.replayedBy;
  }
  return status;
};

export const getStatusServiceByCorrelationId = async (req: Request, res: Response, next: NextFunction) => {
  const statusParams: GetStatusRequestParams = getStatusParams(req);
  const accountOrPrefix = calculateAccountOrPrefix(req);

  logger.info(`status getStatusServiceByCorrelationId `, statusParams);

  //Retrieve status based on a correlationId
  try {
    const actualStatus = new ActualStatus(statusParams, accountOrPrefix, shouldShowDetailed(req));
    const status = await actualStatus.getStatusByRequestAndCorrelationId();

    if (!canViewStatus(req, res, status.status)) {
      logger.warn(`status getStatusServiceByCorrelationId requester does not have permission to view status.`, {
        accountOrPrefix,
        statusAccount: status.status.accountId,
      });
      return next(new NotFound('Not found'));
    }

    status.status = censorStatus(status.status, shouldShowDetailed(req));

    let statusResponse = StatusCodes.MULTI_STATUS;

    if (
      status.status.finalResult === StatusStates.SUCCESS &&
      status.eventStatus.every((eventStatus) => eventStatus.status === StatusStates.SUCCESS)
    ) {
      statusResponse = StatusCodes.OK;
    }
    res.status(statusResponse).json(status);
  } catch (err: unknown) {
    logger.error(`status getStatusServiceByCorrelationId failed correlationId: ${req.params.correlationId} `, err);
    return next(err);
  }
};

export const getStatusServiceByRequestId = async (req: Request, res: Response, next: NextFunction) => {
  const statusParams: GetStatusRequestParams = getStatusParams(req);
  const accountOrPrefix = calculateAccountOrPrefix(req);
  logger.info(`status getStatusServiceByRequestId `, statusParams);

  //Retrieve status based on a requestId
  try {
    const actualStatus = new ActualStatus(statusParams, accountOrPrefix, shouldShowDetailed(req));
    const status = await actualStatus.getStatusByRequestAndCorrelationId();

    if (!canViewStatus(req, res, status.status)) {
      logger.warn(`status getStatusServiceByRequestId requester does not have permission to view status.`, {
        accountOrPrefix,
        statusAccount: status.status.accountId,
      });
      return next(new NotFound('Not found'));
    }

    status.status = censorStatus(status.status, shouldShowDetailed(req));

    let statusResponse = StatusCodes.MULTI_STATUS;

    if (
      status.status.finalResult === StatusStates.SUCCESS &&
      status.eventStatus.every((eventStatus) => eventStatus.status === StatusStates.SUCCESS)
    ) {
      statusResponse = StatusCodes.OK;
    }
    res.status(statusResponse).json(status);
  } catch (err: unknown) {
    logger.error(`status getStatusServiceByRequestId failed requestId: ${req.params.requestId} `, err);
    return next(err);
  }
};

export const getStatusServiceByUsageEventId = async (req: Request, res: Response, next: NextFunction) => {
  const statusParams: GetStatusRequestParams = getStatusParams(req);
  const accountOrPrefix = calculateAccountOrPrefix(req);

  if (!statusParams.accountId) {
    return next(new InvalidRequestError('accountId must be specified as query param'));
  }

  logger.info(`status getStatusServiceByUsageEventId`, statusParams);

  try {
    const actualStatus = new ActualStatus(
      { usageEventId: req.params.usageEventId, accountId: statusParams.accountId },
      accountOrPrefix,
      shouldShowDetailed(req)
    );

    const usageEventResponses = await actualStatus.getStatusByUsageEventId();

    for (const usageEventResponse of usageEventResponses) {
      if (!canViewStatus(req, res, usageEventResponse.status)) {
        logger.warn(`status getStatusServiceByRequestId requester does not have permission to view status.`, {
          accountOrPrefix,
          statusAccount: usageEventResponse.status.accountId,
        });
        return next(new NotFound('Not found'));
      }
      usageEventResponse.status = censorStatus(usageEventResponse.status, shouldShowDetailed(req));
    }

    let statusResponse = StatusCodes.MULTI_STATUS;

    if (
      usageEventResponses.every((usageEventResponse) => usageEventResponse.status.finalResult === StatusStates.SUCCESS)
    ) {
      statusResponse = StatusCodes.OK;
    }
    res.status(statusResponse).json(usageEventResponses);
  } catch (err: unknown) {
    logger.error(`status getStatusServiceByUsageEventId failed usageEventId: ${req.params.usageEventId} `, err);
    return next(err);
  }
};
