import { logger, NotFound } from '@symposium/usage-common';
import { cosHandlerInstance } from '../loaders/cos-loader';

export class CosService {
  accountOrPrefix?: string | null;
  logObject: object;
  fileName: string;

  constructor(itemName: string, accountOrPrefix?: string, logObject?: object) {
    this.accountOrPrefix = accountOrPrefix;
    this.fileName = this.accountOrPrefix ? `${this.accountOrPrefix}/${itemName}` : `${itemName}`;
    this.logObject = { ...logObject, accountOrPrefix, fileName: this.fileName };
  }

  async uploadFile(data: string | object | Buffer, bucketToWrite: string) {
    try {
      this.logObject = { ...this.logObject, bucketToWrite };
      logger.verbose('CosService uploadFile: start', this.logObject);
      await cosHandlerInstance.writeObject(bucketToWrite, this.fileName, data);
      logger.info('CosService uploadFile: completed', this.logObject);
    } catch (err) {
      logger.warn(`CosService uploadFile: error while writing to COS.`, this.logObject);
      throw err;
    }
  }

  async downloadFile(bucketToDownloadFrom: string, fallbackBucket: string) {
    try {
      logger.verbose('CosService downloadFile start', {
        ...this.logObject,
        bucketToDownloadFrom,
      });
      return await cosHandlerInstance.getObject(bucketToDownloadFrom, this.fileName, this.accountOrPrefix || undefined);
    } catch (error) {
      // we first search in archive bucket. If it is not found possibility is that it is still under processing and has not been moved to archive yet. hence we search in incoming bucket next
      if (error instanceof NotFound) {
        logger.debug(
          `CosService downloadFile : calling getObject on ${this.fileName} from ${fallbackBucket}.`,
          this.logObject
        );
        return cosHandlerInstance.getObject(fallbackBucket, this.fileName);
      }

      logger.error(
        `CosService downloadFile: Failed to fetch file  ${this.fileName}, ${JSON.stringify(this.logObject)}`,
        error
      );
      throw error;
    }
  }
}
