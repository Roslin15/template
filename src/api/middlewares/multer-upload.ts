import multer from 'multer';
import { NextFunction, Request, Response } from 'express';
import { InvalidRequestError, logger, UploadTooLargeError } from '@symposium/usage-common';

// A middleware function that happens prior to the request passed to the code
export const receiveUpload = (req: Request, res: Response, next: NextFunction) => {
  let sizeNum = 2 ** 20; // 1MiB
  let sizeString = '1MiB';
  if (req.originalUrl.includes('report/iasp')) {
    sizeNum = sizeNum * 5; // 5MiB
    sizeString = '5MiB';
  }
  multer({
    limits: {
      files: 1,
      fileSize: sizeNum,
    },
  }).any()(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new UploadTooLargeError(`Max upload size is ${sizeString}`));
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return next(new InvalidRequestError('Upload must be a single archive'));
      }
      logger.warn(`multer-upload receiveUpload InvalidRequestError multer code: ${err.code}`);
      return next(new InvalidRequestError('Unexpected error parsing uploaded file'));
    }
    if (err) {
      return next(err);
    }
    return next();
  });
};
