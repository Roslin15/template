import { getConfig } from '../config/config';
import { statusHandlerInstance } from '../loaders/status-loader';
import {
  hashFromFile,
  logger,
  RequestTypes,
  StatusActions,
  StatusStates,
  StatusStep,
  StorageError,
  UnsupportedMediaType,
  UsageErrorClass,
  TarImpl,
  MessagingBindingAndRouting,
  MessagePipeline,
  ServiceUnavailableError,
  CreateStatus,
  ConsolidatedStatus,
  InvalidRequestError,
  DocumentConflictError,
  ConflictError,
  AuthLocals,
  setAttributeIfNonEmpty,
} from '@symposium/usage-common';
import { Request, Response } from 'express';
import { fromBuffer } from 'file-type';
import { getRouterProducer } from '../steps/step-producer-getter';
import { CosService } from './cos-service';

export class UploadService {
  request: Request;
  response: Response<unknown, AuthLocals>;
  bufferedData?: Buffer;
  requestType?: RequestTypes;
  isSuperUser: boolean;
  correlationId?: string;
  statusId?: string;
  originalFileName?: string;
  filename?: string;
  accountOrPrefix?: string; // what gets saved on the status object as the accountOrPrefix field
  rhmAccountId?: string | null;
  requestId?: string;
  targetBucket?: string;
  targetRabbitMessagingRoute?: MessagingBindingAndRouting;

  incomingBucket: string;

  logObject: { [key: string]: unknown };

  constructor(request: Request, response: Response) {
    this.request = request;
    this.response = response;
    this.isSuperUser = this.request.headers['is-super-user'] === 'true';

    const { INCOMING_MESSAGE_QUEUE_BUCKET } = getConfig();
    this.incomingBucket = INCOMING_MESSAGE_QUEUE_BUCKET;
    // Move this out of the constructor if a new upload has to go to a different bucket
    this.targetBucket = this.incomingBucket;
    this.logObject = {};
  }

  async gzipV1Data(usageEventData: unknown) {
    logger.debug(`UploadService gzipV1Data: begin.`);
    const tarImpl = new TarImpl();
    const tarInputData = {
      ['manifest.json']: {
        version: '1',
        type: 'accountMetrics',
      },
      ['report-file.json']: usageEventData,
    };
    try {
      logger.debug(`UploadService gzipV1Data: will create tar with report and manifest file for v1 data.`);
      this.bufferedData = await tarImpl.tarGzipData(tarInputData);
    } catch (error) {
      logger.error(`UploadService gzipV1Data: tar creation failed.`, error);
      throw error;
    }
  }
  // eslint-disable-next-line no-undef
  async getFiletype(file: Express.Multer.File): Promise<string | undefined> {
    return (await fromBuffer(file.buffer))?.ext.toString();
  }

  async verifyXlxs() {
    logger.debug('UploadService verifyXlxs Verifying input file is valid xlxs');
    // eslint-disable-next-line no-undef
    const file = (this.request.files as Express.Multer.File[])[0];
    // Verify xlsx
    if (!(await this.multerFileIsXlxs(file))) {
      throw new UnsupportedMediaType('Upload must end in .xlsx, and be a valid excel spreadsheet file');
    }
  }

  // eslint-disable-next-line no-undef
  async multerFileIsXlxs(file: Express.Multer.File): Promise<boolean> {
    return !!file && file.originalname.endsWith('.xlsx') && (await this.getFiletype(file)) === 'xlsx';
  }

  async verifyGzip() {
    logger.debug('UploadService verifyGzip Verifying input file is valid gzip');
    // eslint-disable-next-line no-undef
    const file = (this.request.files as Express.Multer.File[])[0];
    // Verify gzip
    if (!(await this.multerFileIsGzip(file))) {
      throw new UnsupportedMediaType(
        'Upload must be of mimetype application/gzip, end in .tar.gz, and be a valid gzip file'
      );
    }
  }

  // eslint-disable-next-line no-undef
  async multerFileIsGzip(file: Express.Multer.File): Promise<boolean> {
    return (
      !!file &&
      file.mimetype === 'application/gzip' &&
      file.originalname.endsWith('.tar.gz') &&
      (await this.getFiletype(file)) === 'gz'
    );
  }

  async processV2Upload() {
    this.requestType = RequestTypes.V2_METRICS;
    // eslint-disable-next-line no-undef
    const file = (this.request.files as Express.Multer.File[])[0];
    this.bufferedData = file.buffer;
    this.requestId = hashFromFile(this.bufferedData);
    this.filename = `${this.requestId}.tar.gz`;
    this.originalFileName = file.originalname;

    return this.commonV1V2Processing();
  }

  async processV1Upload() {
    this.requestType = RequestTypes.V1_METRICS;
    // bufferedData generated in gzipV1Data
    this.requestId = hashFromFile(this.bufferedData!);
    this.filename = `${this.requestId}.tar.gz`;
    this.originalFileName = this.filename;

    return this.commonV1V2Processing();
  }

  async commonV1V2Processing() {
    // rhmAccountId will be undefined if user authenticated with an access token
    this.rhmAccountId = this.request.headers.rhmAccountId ? (this.request.headers.rhmAccountId as string) : null;
    this.accountOrPrefix = this.rhmAccountId || undefined;

    this.targetRabbitMessagingRoute = MessagingBindingAndRouting.ROUTE;

    this.logObject = {
      requestId: this.requestId,
      filename: this.originalFileName,
      accountOrPrefix: this.accountOrPrefix,
      isSuperUser: this.isSuperUser,
      requestType: this.requestType,
      bucketName: this.targetBucket,
    };
    logger.info(`UploadService processV1Upload: received upload.`, this.logObject);

    const statusObject: CreateStatus = {
      requestId: this.requestId!,
      requestType: this.requestType as RequestTypes.V1_METRICS | RequestTypes.V2_METRICS,
      inputFileName: this.originalFileName!,
      startTime: Date.now(),
      replayAttempt: 0,
      ...setAttributeIfNonEmpty(this.rhmAccountId, 'accountId'),
      ...setAttributeIfNonEmpty(this.accountOrPrefix, 'accountOrPrefix'),
      authMethod: this.response.locals.authMethod!,
      ...setAttributeIfNonEmpty(this.response.locals.tokenIamId, 'iamId'),
      ...setAttributeIfNonEmpty(this.response.locals.email, 'email'),
      ...setAttributeIfNonEmpty(this.response.locals.iui, 'iui'),
    };

    return this.processUpload(statusObject);
  }

  validateStartAndEndDate() {
    if (!this.request.query.startDate && !this.request.query.endDate) {
      return;
    }
    if (
      (this.request.query.startDate && !this.request.query.endDate) ||
      (this.request.query.endDate && !this.request.query.startDate)
    ) {
      throw new InvalidRequestError(`If either startDate or endDate is provided, the other must be provided as well`);
    }
    const startDate = Number(this.request.query.startDate);
    const endDate = Number(this.request.query.endDate);
    if (endDate && endDate <= startDate) {
      throw new InvalidRequestError(`startDate must be less than endDate`);
    }
    const todaysDate = new Date();
    const todaysLastTimeStamp = Date.UTC(
      todaysDate.getFullYear(),
      todaysDate.getMonth(),
      todaysDate.getDate(),
      23,
      59,
      59,
      999
    );
    if (endDate > todaysLastTimeStamp) {
      throw new InvalidRequestError(`end date ${this.request.query.endDate} cannot be in future`);
    }
  }

  async processIaspUpload() {
    this.requestType = RequestTypes.IASP;
    this.rhmAccountId = this.request.query.accountId as string;
    this.accountOrPrefix = this.rhmAccountId;

    // eslint-disable-next-line no-undef
    this.bufferedData = (this.request.files as Express.Multer.File[])[0].buffer;
    this.requestId = hashFromFile(this.bufferedData);
    // eslint-disable-next-line no-undef
    this.originalFileName = (this.request.files as Express.Multer.File[])[0]?.originalname;
    this.filename = `${this.requestId}.xlsx`;

    this.targetRabbitMessagingRoute = MessagingBindingAndRouting.IASP;

    this.validateStartAndEndDate();

    const statusObject: CreateStatus = {
      requestId: this.requestId,
      requestMetadata: {
        reportUrn: Number(this.request.params.reportUrn),
        ...(this.request.query.startDate && {
          startDate: Number(this.request.query.startDate),
          endDate: Number(this.request.query.endDate),
          isDatesQueryParams: true,
        }),
      },
      requestType: this.requestType,
      inputFileName: this.originalFileName,
      startTime: Date.now(),
      replayAttempt: 0,
      accountId: this.rhmAccountId,
      accountOrPrefix: this.rhmAccountId,
      iamId: this.response.locals.tokenIamId,
      authMethod: this.response.locals.authMethod!,
      ...setAttributeIfNonEmpty(this.response.locals.email, 'email'),
    };

    this.logObject = {
      requestId: this.requestId,
      filename: this.originalFileName,
      accountOrPrefix: this.rhmAccountId,
      isSuperUser: true,
      requestType: this.requestType,
      bucketName: this.targetBucket,
    };

    logger.info(`UploadService processIaspUpload: received upload.`, this.logObject);

    return this.processUpload(statusObject);
  }

  async processUpload(statusObject: CreateStatus) {
    // Add requestId and fileName to headers so they appear in middleware logger output
    this.request.headers.requestId = this.requestId;
    this.request.headers.filename = this.originalFileName;

    let existingStatus = await this.createOrFetchExistingStatus(statusObject);
    let priorPutInBucketStep = undefined;
    if (existingStatus) {
      if (existingStatus.requestMetadata?.reportUrn !== statusObject.requestMetadata?.reportUrn) {
        throw new InvalidRequestError(
          `This report has already been uploaded with the reportUrn: ${existingStatus.requestMetadata!.reportUrn}`
        );
      }
      if (existingStatus.errorCode === 'previous_still_processing') {
        logger.verbose(`UploadService processUpload resetting previous_still_processing status`, this.logObject);
        existingStatus = await this.setStatusForReplay(existingStatus);
        // Will make priorPutInBucketStep undefined since it wont have a matching replay attempt
      }
      priorPutInBucketStep = existingStatus.statusSteps.find(
        (step) =>
          step.action === StatusActions.PUT_IN_INCOMING_BUCKET && step.replayAttempt === existingStatus!.replayAttempt
      );
      if (existingStatus.requestType === RequestTypes.IASP && priorPutInBucketStep?.isPublished) {
        throw new ConflictError('File already submitted, will not process. Create a new version to be processed');
      }
    }
    this.logObject = { ...this.logObject, correlationId: this.correlationId };

    if (priorPutInBucketStep?.state === StatusStates.SUCCESS) {
      logger.warn(`UploadService processUpload: skipped putting duplicate in cos.`, this.logObject);
    } else {
      // Returns the step it updated/created after saving in cos
      priorPutInBucketStep = await this.putInCos(priorPutInBucketStep, existingStatus?.replayAttempt);
    }

    if (priorPutInBucketStep!.isPublished) {
      logger.warn(`UploadService processUpload: skipped duplicate publish`, this.logObject);
    } else {
      await this.publishToRouter(priorPutInBucketStep!);
    }

    return {
      requestId: this.requestId,
      correlationId: this.correlationId,
    };
  }

  // Returns the existing status, if any. Returns nothing if it creates a new status
  async createOrFetchExistingStatus(statusObject: CreateStatus): Promise<ConsolidatedStatus | undefined> {
    try {
      logger.verbose(`UploadService createOrFetchExistingStatus: attempting create status.`, this.logObject);
      const createStatusResult = await statusHandlerInstance.create(statusObject);
      this.correlationId = createStatusResult?.correlationId;
      this.statusId = createStatusResult?.id;
      logger.info(`UploadService createOrFetchExistingStatus: created status.`, this.logObject);
      return undefined;
    } catch (createError) {
      if (!(createError instanceof DocumentConflictError)) {
        logger.error(`UploadService createOrFetchExistingStatus create failed with non-conflict error`, createError);
        throw createError;
      }
      try {
        logger.debug(
          `UploadService createOrFetchExistingStatus create failed, checking if status exists`,
          this.logObject
        );
        // The user may have submitted the same api request multiple times in quick succession.
        // Sleep before retrieving status to give any existing requests time to finish, reducing
        // odds of timing condition
        await new Promise((resolve) => setTimeout(resolve, getConfig().EXISTING_STATUS_DELAY));
        const getStatusResult = await statusHandlerInstance.getConsolidatedStatus(
          {
            requestId: this.requestId!,
            accountOrPrefix: this.rhmAccountId || null,
            eventId: null,
          },
          this.rhmAccountId || null
        );
        this.correlationId = getStatusResult.correlationId;
        this.statusId = getStatusResult.id;
        this.logObject = {
          ...this.logObject,
          accountId: getStatusResult.accountId,
          correlationId: this.correlationId,
        };
        logger.info(`UploadService createOrFetchExistingStatus: status already existed.`, this.logObject);
        return getStatusResult;
      } catch (getError) {
        logger.error(
          `UploadService createOrFetchExistingStatus: failed to create or get status. ${JSON.stringify(
            this.logObject
          )}`,
          {
            createError,
            getError,
          }
        );
        throw getError;
      }
    }
  }

  async putInCos(putInBucketStep?: StatusStep, replayAttempt?: number) {
    let errToUse: UsageErrorClass | undefined = undefined;

    // If existing putInBucketStep, update it instead of creating a new one
    if (!putInBucketStep) {
      putInBucketStep = {
        statusId: this.statusId!,
        action: StatusActions.PUT_IN_INCOMING_BUCKET,
        startTime: Date.now(),
        attempt: -1, // gets incremented to 0 below
        replayAttempt: replayAttempt || 0,
        state: StatusStates.SUCCESS,
        isPublished: false,
      };
    }

    try {
      logger.verbose(`UploadService putInCos: attempting write to COS.`, this.logObject);
      await new CosService(this.filename!, this.accountOrPrefix, this.logObject).uploadFile(
        this.bufferedData!,
        this.targetBucket!
      );
      logger.info(`UploadService putInCos: wrote to COS.`, this.logObject);
      putInBucketStep.attempt++;
      putInBucketStep.state = StatusStates.SUCCESS;
      putInBucketStep.endTime = Date.now();
      delete putInBucketStep.message;
      delete putInBucketStep.errorCode;
    } catch (err) {
      errToUse = err instanceof UsageErrorClass ? err : new StorageError(err);
      logger.error(`UploadService putInCos: failed put in COS step. ${JSON.stringify(this.logObject)}`, errToUse);
      putInBucketStep.attempt++;
      putInBucketStep.state = StatusStates.SYSTEM_ERROR;
      putInBucketStep.endTime = Date.now();
      putInBucketStep.message = errToUse.message;
      putInBucketStep.errorCode = errToUse.code;
    }

    let updatedStep;
    try {
      logger.verbose(`UploadService putInCos: saving status`, {
        ...this.logObject,
        ...putInBucketStep,
      });
      updatedStep = await statusHandlerInstance.updateStatusStep(putInBucketStep, this.rhmAccountId || null);
    } catch (statusErr) {
      logger.error(
        `UploadService putInCos: failed saving status step error. ${JSON.stringify(putInBucketStep)}`,
        statusErr
      );
      // using the original cos error for error response if any
      if (!errToUse) {
        errToUse = statusErr as UsageErrorClass;
      }
    }

    if (errToUse) {
      throw errToUse;
    }

    return updatedStep;
  }

  async publishToRouter(existingStep: StatusStep) {
    const messageToPublish: MessagePipeline = {
      correlationId: this.correlationId!,
      statusId: this.statusId!,
      accountOrPrefix: this.rhmAccountId || null,
    };
    try {
      logger.info(
        `UploadService publishToRouter Publishing to route ${this.targetRabbitMessagingRoute}`,
        messageToPublish
      );
      await getRouterProducer().publish(this.targetRabbitMessagingRoute!, messageToPublish);
      existingStep.isPublished = true;
      await statusHandlerInstance.updateStatusStep(existingStep, this.rhmAccountId || null);
    } catch (err) {
      logger.error(
        `UploadService publishToRouter Failed publishing to route ${this.targetRabbitMessagingRoute}`,
        messageToPublish
      );
      throw new ServiceUnavailableError(err, 'rabbitmq');
    }
  }

  async saveUserResponseReturned() {
    try {
      logger.verbose(
        `UploadService saveUserResponseReturned: attempting updating status userResponseReturned.`,
        this.logObject
      );
      const updateObject = {
        userResponseReturned: true,
      };
      await statusHandlerInstance.save(
        updateObject,
        {
          id: this.statusId!,
        },
        this.accountOrPrefix || null
      );
      logger.verbose(`UploadService saveUserResponseReturned: updated status userResponseReturned.`, this.logObject);
    } catch (err: unknown) {
      logger.error(
        `UploadService saveUserResponseReturned: failed updating status userResponseReturned. ${JSON.stringify(
          this.logObject
        )}`,
        err
      );
    }
  }

  async setStatusForReplay(consolidatedStatus: ConsolidatedStatus) {
    // Get statusSteps so we can add them back in to the result of the status save
    const { statusSteps, ...status } = consolidatedStatus;
    logger.verbose(`UploadService setStatusForReplay start for statusId ${status.id}`, this.logObject);
    try {
      const result = await statusHandlerInstance.save(
        {
          finalResult: undefined,
          endTime: undefined,
          startTime: Date.now(),
          errorResponseMessage: undefined,
          errorCode: undefined,
          replayAttempt: status.replayAttempt + 1,
        },
        { id: status.id },
        status.accountOrPrefix!
      );
      return { statusSteps, ...result };
    } catch (e) {
      logger.error(
        `UploadService setStatusForReplay failed for statusId ${status.id}  ${JSON.stringify(this.logObject)}`,
        e
      );
      throw e;
    }
  }
}
