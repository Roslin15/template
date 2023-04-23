import { Request, Response } from 'express';
import { UploadService } from '../../services/uploads';
import { getErrorToThrow, InvalidFormatError, logger } from '@symposium/usage-common';
import { StatusService, V1RequestStatus } from '../../services/status-service';
import { StatusCodes } from 'http-status-codes';

/**
 * Takes the body of a POST /api/v1/metrics  and invokes the UploadService. Waits for upload to complete before returning the status of request.
 **/
export const postMetricsV1 = async (req: Request, res: Response) => {
  const usageEventData = req.body.data;
  const uploadService = new UploadService(req, res);

  try {
    if (Object.keys(req.body).length === 0) throw new InvalidFormatError('Data array must be present in request body');
    logger.info(`metricsV1 postMetricsV1: received v1 request`, uploadService.correlationId);
    await uploadService.gzipV1Data(req.body);
    await uploadService.processV1Upload();
    const statusService = new StatusService(uploadService.correlationId as string, req.headers.rhmAccountId as string);
    res
      .status(StatusCodes.ACCEPTED)
      .json(statusService.commonMetricResponse(usageEventData, V1RequestStatus.INPROGRESS));
    await uploadService.saveUserResponseReturned();
  } catch (err: unknown) {
    const errorToUse = getErrorToThrow(err);
    logger.error(`metricsV1 postMetricsV1: failed accountId: ${req.headers.rhmAccountId}`, err);
    res.status(errorToUse.statusCode).json({
      status: V1RequestStatus.FAILED,
      errorCode: errorToUse.code,
      message: errorToUse.message,
    });
  }
};
