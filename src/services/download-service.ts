import { getErrorToThrow, logger, NotFound, TarImpl } from '@symposium/usage-common';
import { getConfig } from '../config/config';
import { statusHandlerInstance } from '../loaders/status-loader';
import { CosService } from './cos-service';

export class DownloadService {
  reportUrn: number | string;
  accountId?: string;
  logObject: Record<string, unknown>;

  constructor(reportUrn: number | string, accountId?: string) {
    this.reportUrn = reportUrn;
    this.accountId = accountId;
    this.logObject = { reportUrn, accountId };
  }

  async getIaspCosFileName() {
    try {
      logger.debug(`DownloadService getIaspCosFileName start`, this.logObject);
      const statusesForReportUrn = await statusHandlerInstance.getManyStatuses(
        { 'requestMetadata.reportUrn': this.reportUrn as number, eventId: { $exists: false } },
        this.accountId!
      );
      if (!statusesForReportUrn.length) {
        throw new NotFound(`NotFound reportUrn: ${this.reportUrn} accountId: ${this.accountId}`);
      }
      statusesForReportUrn.sort((a, b) => a.startTime - b.startTime);
      const latestIaspStatus = statusesForReportUrn.at(-1);
      const fileName = `${latestIaspStatus!.requestId}`;
      this.logObject.fileName = fileName;
      logger.verbose(`DownloadService getIaspCosFileName got ${fileName}`, this.logObject);
      return fileName;
    } catch (error) {
      logger.error(
        `DownloadService getIaspCosFileName reportUrn ${this.reportUrn} accountId ${this.accountId} `,
        error
      );
      throw getErrorToThrow(error);
    }
  }

  async getIaspFromCos() {
    const { IASP_ARCHIVE_BUCKET, INCOMING_MESSAGE_QUEUE_BUCKET } = getConfig();
    try {
      logger.debug(`DownloadService getIaspFromCos start`, this.logObject);
      let cosFileName: string;
      //TODO: temporary workaround until a long term solution can be found to store and download IASP template
      if (this.reportUrn === 'template') {
        cosFileName = 'ELP-IASP-Template-v2.1';
      } else {
        cosFileName = await this.getIaspCosFileName();
      }
      // Try to download as gzip first. If that fails, download as xlsx. todo remove xlsx part when all files are zipped
      try {
        const cosService = new CosService(cosFileName + '.tar.gz', this.accountId, this.logObject);
        const iaspFile = await cosService.downloadFile(IASP_ARCHIVE_BUCKET, INCOMING_MESSAGE_QUEUE_BUCKET);
        logger.verbose('DownloadService getIaspFromCos unzipping', this.logObject);
        const extracted = await new TarImpl().expandArchive(iaspFile);

        return extracted[`${cosFileName}.xlsx`];
      } catch (err) {
        if (!(err instanceof NotFound)) {
          throw err;
        }
        logger.debug('getIaspFromCos gzip not found, trying xlsx', this.logObject);
      }
      const cosService = new CosService(cosFileName + '.xlsx', this.accountId, this.logObject);
      const iaspFile = await cosService.downloadFile(IASP_ARCHIVE_BUCKET, INCOMING_MESSAGE_QUEUE_BUCKET);
      logger.verbose(`DownloadService getIaspFromCos got ${cosFileName}`, this.logObject);
      return iaspFile;
    } catch (error) {
      logger.error(`DownloadService getIaspFromCos error`, this.logObject);
      throw getErrorToThrow(error);
    }
  }
}
