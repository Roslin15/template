import { receiveUpload } from '../middlewares/multer-upload';
import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UploadService } from '../../services/uploads';
import { InternalError } from '@symposium/usage-common';

export const postMetricsV2 = async (req: Request, res: Response, next: NextFunction) => {
  // If auth was an access token, then rhmAccountId will not be set, but tokenIamId will.
  // If auth was pull secret, vice versa. This error should be impossible.
  if (!res.locals.tokenIamId && !req.headers?.rhmAccountId) {
    return next(new InternalError('Must either have rhmAccountId header or tokenIamId local set'));
  }

  const uploadService = new UploadService(req, res);

  try {
    await uploadService.verifyGzip();
    const uploadResponse = await uploadService.processV2Upload();

    res.status(StatusCodes.ACCEPTED).json(uploadResponse);
    await uploadService.saveUserResponseReturned();
  } catch (err) {
    return next(err);
  }
};

// multer is middleware and must be incuded as part of the post
export const postMetrics = [receiveUpload, postMetricsV2];
