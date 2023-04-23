import { InvalidRequestError, logger } from '@symposium/usage-common';
import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { DownloadService } from '../../services/download-service';
import { UploadService } from '../../services/uploads';
import { receiveUpload } from '../middlewares/multer-upload';

export const receiveIaspReport = async (req: Request, res: Response, next: NextFunction) => {
  logger.info(`iaspReport receiveIaspReport processing request`, {
    reportUrn: req.params.reportUrn,
    accountId: req.query.accountId,
  });
  const uploadService = new UploadService(req, res);

  try {
    await uploadService.verifyXlxs();
    const uploadResponse = await uploadService.processIaspUpload();

    res.status(StatusCodes.ACCEPTED).json(uploadResponse);
    await uploadService.saveUserResponseReturned();
  } catch (err) {
    return next(err);
  }
};

export const postReportIASP = [receiveUpload, receiveIaspReport];

export const getIaspReport = async (req: Request, res: Response, next: NextFunction) => {
  let reportUrn: string | number = req.params.reportUrn;
  let accountId;
  logger.info(`iaspReport getIaspReport getting file for request: `, {
    reportUrn,
    accountId,
  });
  try {
    if (reportUrn !== 'template') {
      //TODO: temporary workaround until a long term solution can be found to store and download IASP template
      reportUrn = Number(req.params.reportUrn);
      accountId = req.query.accountId as string;
    }
    if (!reportUrn) {
      throw new InvalidRequestError('reportUrn must be numeric value');
    }
    if (reportUrn !== 'template' && !accountId) {
      //TODO: temporary workaround until a long term solution can be found to store and download IASP template. this can be handled directly in yaml defn
      throw new InvalidRequestError('accountId must be passed as queryParam');
    }
    const downloadService = new DownloadService(reportUrn, accountId);
    const iaspReport = await downloadService.getIaspFromCos();
    res.status(StatusCodes.OK).send(iaspReport);
  } catch (err) {
    return next(err);
  }
};
