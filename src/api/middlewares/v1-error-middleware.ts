import { UsageErrorHelper } from '@symposium/usage-common';
import { NextFunction, Request, Response } from 'express';
import { HttpError } from 'express-openapi-validator/dist/framework/types';
import createHttpError from 'http-errors';
import { StatusService, V1RequestStatus } from '../../services/status-service';

export const v1ErrorMiddleware = (error: unknown, request: Request, response: Response, next: NextFunction) => {
  if (!request.originalUrl.includes('/api/v1/metrics')) {
    return next(error);
  }

  let v1Error;
  if (error instanceof HttpError || createHttpError.isHttpError(error)) {
    v1Error = new UsageErrorHelper({
      ...error,
      message: error.message,
      statusCode: error.status,
      retryable: false,
    });
  } else {
    v1Error = new UsageErrorHelper(error);
  }

  if (v1Error.statusCode === 401) {
    response.status(v1Error.statusCode).json({
      status: 401,
      title: 'Unauthorized',
      detail: 'Missing Authorization header or invalid bearer token specified',
    });
  } else {
    const finalResponse = new StatusService('').commonMetricResponse(request.body.data, V1RequestStatus.FAILED);
    finalResponse.message = `One or more events are failed with some validation or other errors: ${v1Error.message}`;
    finalResponse.errorDetails = v1Error.message.split(',');
    response.status(v1Error.statusCode).json(finalResponse);
  }
};
