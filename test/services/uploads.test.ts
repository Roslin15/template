import { cosHandlerInstance } from '../../src/loaders/cos-loader';
import { statusHandlerInstance } from '../../src/loaders/status-loader';
import { UploadService } from '../../src/services/uploads';
import {
  hashFromFile,
  RequestTypes,
  StatusActions,
  StatusStates,
  StorageError,
  Producer,
  MessagingBindingAndRouting,
  ServiceUnavailableError,
  UnsupportedMediaType,
  CreateStatus,
  StatusStep,
  TarImpl,
  InvalidRequestError,
  DocumentConflictError,
  ConsolidatedStatus,
  ConflictError,
} from '@symposium/usage-common';
import { Request, Response } from 'express';
import { getRouterProducer } from '../../src/steps/step-producer-getter';
import { fromBuffer } from 'file-type';

jest.mock('../../src/config/config', () => ({
  getConfig: () => ({
    EXISTING_STATUS_DELAY: 1,
    INCOMING_MESSAGE_QUEUE_BUCKET: 'test-bucket-incoming-api',
  }),
}));

jest.mock('../../src/loaders/feature-flags-loader', () => ({
  featureFlags: { isEnabled: jest.fn((flagName, user) => user.custom.accountId === 'publishEnabledAccount') },
}));

jest.mock('file-type');
const mockFromBuffer = fromBuffer as jest.MockedFunction<typeof fromBuffer>;

jest.mock('../../src/steps/step-producer-getter');
const mockPublish: jest.MockedFunction<Producer['publish']> = jest.fn();
const mockedGetRouterProducer = getRouterProducer as jest.MockedFunction<typeof getRouterProducer>;
mockedGetRouterProducer.mockReturnValue({ publish: mockPublish } as unknown as Producer);

const tarGzipData = jest.fn();
const mockedTarImpl = TarImpl as jest.MockedClass<typeof TarImpl>;
jest.mock('@symposium/usage-common', () => ({
  ...jest.requireActual('@symposium/usage-common'),
  TarImpl: jest.fn(),
}));

describe('Upload Processing', () => {
  let mockReq: Request;
  let mockRes: () => Response;
  beforeEach(() => {
    mockReq = {
      originalUrl: '/metering/api/v2/metrics',
      // eslint-disable-next-line no-undef
      files: [{ originalname: 'mockFile', buffer: Buffer.from('mock buffer') } as Express.Multer.File],
    } as Request;
    mockReq.headers = { rhmAccountId: 'mockId' };
    mockReq.header = jest.fn();
    mockRes = () => {
      const res = {} as Response;
      res.locals = {};
      return res;
    };
  });

  describe('create status', () => {
    beforeEach(() => {
      statusHandlerInstance.create = jest.fn().mockResolvedValueOnce(true);
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockRejectedValueOnce(false);
    });

    test('Creates status green path', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      statusHandlerInstance.create = jest.fn().mockResolvedValueOnce({
        correlationId: 'correlationId',
        id: 'statusId',
      });
      statusHandlerInstance.getConsolidatedStatus = jest.fn();
      await uploadService.createOrFetchExistingStatus({} as CreateStatus);
      expect(uploadService.correlationId).toEqual('correlationId');
      expect(uploadService.statusId).toEqual('statusId');
      expect(statusHandlerInstance.getConsolidatedStatus).not.toBeCalled();
    });

    test('Existing status green path', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      statusHandlerInstance.create = jest.fn().mockRejectedValueOnce(new DocumentConflictError(''));
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockResolvedValueOnce({
        correlationId: 'correlationId',
        id: 'statusId',
      });
      await uploadService.createOrFetchExistingStatus({} as CreateStatus);
      expect(uploadService.correlationId).toEqual('correlationId');
      expect(uploadService.statusId).toEqual('statusId');
    });

    test('Unknown create error', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      statusHandlerInstance.create = jest.fn().mockRejectedValueOnce('other error');
      await expect(uploadService.createOrFetchExistingStatus({} as CreateStatus)).rejects.toEqual('other error');
    });

    test('Create and get status both failing sends error response', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      statusHandlerInstance.create = jest.fn().mockRejectedValueOnce(new DocumentConflictError(''));
      statusHandlerInstance.getConsolidatedStatus = jest.fn().mockRejectedValueOnce('mock status error');
      await expect(uploadService.createOrFetchExistingStatus({} as CreateStatus)).rejects.toEqual('mock status error');
    });
  });

  describe('putInCos', () => {
    beforeEach(() => {
      cosHandlerInstance.writeObject = jest.fn().mockResolvedValueOnce(true);
      statusHandlerInstance.updateStatusStep = jest.fn().mockImplementation((status) => status);
    });

    it('Creates the object in cos and updates the status (green path)', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      uploadService.statusId = 'statusId';
      uploadService.rhmAccountId = 'account';
      const result = await uploadService.putInCos(undefined);
      expect(cosHandlerInstance.writeObject).toBeCalled();
      const updatedStep = {
        statusId: 'statusId',
        action: StatusActions.PUT_IN_INCOMING_BUCKET,
        attempt: 0,
        replayAttempt: 0,
        state: StatusStates.SUCCESS,
        isPublished: false,
      };
      expect(statusHandlerInstance.updateStatusStep).toBeCalledWith(
        expect.objectContaining({ ...updatedStep }),
        'account'
      );
      expect(result).toEqual(expect.objectContaining({ ...updatedStep }));
    });

    it('Creates the object in cos and updates the status (green path) (with existing status)', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      uploadService.statusId = 'statusId';
      uploadService.filename = 'file';
      uploadService.targetBucket = 'bucket';
      const result = await uploadService.putInCos({
        startTime: 1,
        action: StatusActions.PUT_IN_INCOMING_BUCKET,
        state: StatusStates.SYSTEM_ERROR,
        attempt: 2,
        replayAttempt: 0,
        isPublished: false,
        statusId: 'statusIdExisting',
      });
      expect(cosHandlerInstance.writeObject).toBeCalled();
      const updatedStep = {
        startTime: 1,
        action: StatusActions.PUT_IN_INCOMING_BUCKET,
        state: StatusStates.SUCCESS,
        attempt: 3,
        replayAttempt: 0,
        isPublished: false,
        statusId: 'statusIdExisting',
      };
      expect(statusHandlerInstance.updateStatusStep).toBeCalledWith(expect.objectContaining({ ...updatedStep }), null);
      expect(result).toEqual(expect.objectContaining({ ...updatedStep }));
    });

    it('Errors creating the object in cos', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      uploadService.statusId = 'statusId';
      uploadService.rhmAccountId = 'account';
      cosHandlerInstance.writeObject = jest.fn().mockRejectedValue(new Error('errMessage'));
      await expect(uploadService.putInCos(undefined)).rejects.toBeInstanceOf(StorageError);
      expect(cosHandlerInstance.writeObject).toBeCalled();
      const updatedStep = {
        statusId: 'statusId',
        action: StatusActions.PUT_IN_INCOMING_BUCKET,
        attempt: 0,
        replayAttempt: 0,
        state: StatusStates.SYSTEM_ERROR,
        isPublished: false,
        message: 'errMessage',
        errorCode: 'storage_error',
      };
      expect(statusHandlerInstance.updateStatusStep).toBeCalledWith(
        expect.objectContaining({ ...updatedStep }),
        'account'
      );
    });

    it('Errors creating the object in cos (known error type)', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      uploadService.statusId = 'statusId';
      uploadService.rhmAccountId = 'account';
      cosHandlerInstance.writeObject = jest.fn().mockRejectedValue(new ServiceUnavailableError('errMessage'));
      await expect(uploadService.putInCos(undefined)).rejects.toBeInstanceOf(ServiceUnavailableError);
      expect(cosHandlerInstance.writeObject).toBeCalled();
      const updatedStep = {
        statusId: 'statusId',
        action: StatusActions.PUT_IN_INCOMING_BUCKET,
        attempt: 0,
        replayAttempt: 0,
        state: StatusStates.SYSTEM_ERROR,
        isPublished: false,
        message: 'errMessage',
        errorCode: 'service_unavailable',
      };
      expect(statusHandlerInstance.updateStatusStep).toBeCalledWith(
        expect.objectContaining({ ...updatedStep }),
        'account'
      );
    });

    it('Throws if it cant save the status', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      uploadService.statusId = 'statusId';
      uploadService.rhmAccountId = 'account';
      statusHandlerInstance.updateStatusStep = jest.fn().mockRejectedValueOnce(new StorageError('err'));
      await expect(uploadService.putInCos(undefined)).rejects.toBeInstanceOf(StorageError);
      expect(cosHandlerInstance.writeObject).toBeCalled();
      const updatedStep = {
        statusId: 'statusId',
        action: StatusActions.PUT_IN_INCOMING_BUCKET,
        attempt: 0,
        replayAttempt: 0,
        state: StatusStates.SUCCESS,
        isPublished: false,
      };
      expect(statusHandlerInstance.updateStatusStep).toBeCalledWith(
        expect.objectContaining({ ...updatedStep }),
        'account'
      );
    });
  });

  describe('publishToRouter', () => {
    test('green path', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      uploadService.correlationId = 'correlationId';
      uploadService.statusId = 'statusId';
      uploadService.targetRabbitMessagingRoute = MessagingBindingAndRouting.ROUTE;
      uploadService.rhmAccountId = 'publishEnabledAccount';
      await uploadService.publishToRouter({} as StatusStep);
      expect(mockPublish).toBeCalledWith(MessagingBindingAndRouting.ROUTE, {
        correlationId: 'correlationId',
        statusId: 'statusId',
        accountOrPrefix: 'publishEnabledAccount',
      });
    });

    test('green path (undefined accountId)', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      uploadService.correlationId = 'correlationId';
      uploadService.statusId = 'statusId';
      uploadService.targetRabbitMessagingRoute = MessagingBindingAndRouting.ROUTE;
      await uploadService.publishToRouter({} as StatusStep);
      expect(mockPublish).toBeCalledWith(MessagingBindingAndRouting.ROUTE, {
        correlationId: 'correlationId',
        statusId: 'statusId',
        accountOrPrefix: null,
      });
    });

    test('error publishing', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      uploadService.correlationId = 'correlationId';
      uploadService.statusId = 'statusId';
      mockPublish.mockRejectedValueOnce(new Error());
      await expect(uploadService.publishToRouter({} as StatusStep)).rejects.toBeInstanceOf(ServiceUnavailableError);
    });
  });

  describe('setStatusForReplay', () => {
    let uploadService: UploadService;
    beforeEach(() => {
      uploadService = new UploadService(mockReq, mockRes());
    });

    it('saves the status with an incremented error attempt', async () => {
      statusHandlerInstance.save = jest.fn().mockResolvedValueOnce({ field: 'value' });
      const result = await uploadService.setStatusForReplay({
        statusSteps: [],
        id: 'statusId',
        replayAttempt: 0,
        accountOrPrefix: 'acct1',
      } as unknown as ConsolidatedStatus);
      expect(statusHandlerInstance.save).toBeCalledWith(
        expect.objectContaining({
          finalResult: undefined,
          endTime: undefined,
          errorResponseMessage: undefined,
          errorCode: undefined,
          replayAttempt: 1,
        }),
        { id: 'statusId' },
        'acct1'
      );
      expect(result).toEqual({ field: 'value', statusSteps: [] });
    });

    it('logs and rethrows errors', async () => {
      statusHandlerInstance.save = jest.fn().mockRejectedValue(new Error());
      await expect(
        uploadService.setStatusForReplay({
          statusSteps: [],
          id: 'statusId',
          replayAttempt: 0,
          accountOrPrefix: 'acct1',
        } as unknown as ConsolidatedStatus)
      ).rejects.toBeInstanceOf(Error);
    });
  });

  describe('processUpload', () => {
    let uploadService: UploadService;
    const mockCreateStatus = jest.fn();
    const mockPutInCos = jest.fn();
    const mockPublishToRouter = jest.fn();
    const mockSetStatusForReplay = jest.fn();

    beforeEach(() => {
      jest.resetAllMocks();
      uploadService = new UploadService(mockReq, mockRes());
      uploadService.createOrFetchExistingStatus = mockCreateStatus;
      uploadService.putInCos = mockPutInCos;
      uploadService.publishToRouter = mockPublishToRouter;
      uploadService.setStatusForReplay = mockSetStatusForReplay;
    });

    it('creates the status, puts in cos, published to router', async () => {
      mockPutInCos.mockResolvedValue({ isPublished: false });
      await uploadService.processUpload({ field: 'value' } as unknown as CreateStatus);
      expect(mockCreateStatus).toBeCalledWith({ field: 'value' });
      expect(mockPutInCos).toBeCalledWith(undefined, undefined);
      expect(mockPublishToRouter).toBeCalledWith({ isPublished: false });
    });

    it('throws an InvalidRequestError if there is an existing status for this requestId and a different reportUrn', async () => {
      mockPutInCos.mockResolvedValue({ isPublished: false });
      uploadService.createOrFetchExistingStatus = jest
        .fn()
        .mockResolvedValueOnce({ requestMetadata: { reportUrn: 5 }, replayAttempt: 0, statusSteps: [] });
      await expect(
        uploadService.processUpload({
          requestMetadata: { reportUrn: 4 },
        } as unknown as CreateStatus)
      ).rejects.toBeInstanceOf(InvalidRequestError);
    });

    it('throws ConflictError if there is an existing status for this requestId which is already published to router', async () => {
      mockPutInCos.mockResolvedValue({ isPublished: false });
      uploadService.createOrFetchExistingStatus = jest.fn().mockResolvedValueOnce({
        requestMetadata: { reportUrn: 4 },
        replayAttempt: 0,
        requestType: 'IASP',
        statusSteps: [
          {
            action: StatusActions.PUT_IN_INCOMING_BUCKET,
            state: StatusStates.SUCCESS,
            replayAttempt: 0,
            isPublished: true,
          },
        ],
      });
      await expect(
        uploadService.processUpload({
          requestMetadata: { reportUrn: 4 },
        } as unknown as CreateStatus)
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('accepts if there is an existing status with the same report urn', async () => {
      mockPutInCos.mockResolvedValue({ isPublished: false });
      uploadService.createOrFetchExistingStatus = jest
        .fn()
        .mockResolvedValueOnce({ requestMetadata: { reportUrn: 5 }, replayAttempt: 0, statusSteps: [] });
      uploadService.processUpload({
        requestMetadata: { reportUrn: 5 },
      } as unknown as CreateStatus);
    });

    it('resets the status for a replay if the amendment already exists with previous_still_processing', async () => {
      const existingStep = {
        action: StatusActions.PUT_IN_INCOMING_BUCKET,
        state: StatusStates.SUCCESS,
        replayAttempt: 0,
      };
      uploadService.createOrFetchExistingStatus = jest.fn().mockResolvedValueOnce({
        replayAttempt: 0,
        statusSteps: [existingStep],
        errorCode: 'previous_still_processing',
      });
      mockSetStatusForReplay.mockResolvedValue({ replayAttempt: 1, statusSteps: [existingStep] });
      mockPutInCos.mockResolvedValue({ isPublished: false });
      await uploadService.processUpload({ field: 'value' } as unknown as CreateStatus);
      expect(mockSetStatusForReplay).toBeCalled();
      // uses replay value from reset status, not original
      expect(mockPutInCos).toBeCalled();
      expect(mockPublishToRouter).toBeCalled();
    });

    it('skips cos if already done', async () => {
      const existingStep = {
        action: StatusActions.PUT_IN_INCOMING_BUCKET,
        state: StatusStates.SUCCESS,
        replayAttempt: 0,
      };
      mockCreateStatus.mockResolvedValue({ statusSteps: [existingStep], replayAttempt: 0 });
      mockPutInCos.mockResolvedValue({ isPublished: false });
      await uploadService.processUpload({ field: 'value' } as unknown as CreateStatus);
      expect(mockCreateStatus).toBeCalledWith({ field: 'value' });
      expect(mockPutInCos).not.toBeCalled();
      expect(mockPublishToRouter).toBeCalledWith({
        action: StatusActions.PUT_IN_INCOMING_BUCKET,
        state: StatusStates.SUCCESS,
        replayAttempt: 0,
      });
    });

    it('skips publish if already done', async () => {
      const existingStep = {
        action: StatusActions.PUT_IN_INCOMING_BUCKET,
        state: StatusStates.SUCCESS,
        replayAttempt: 0,
        isPublished: true,
      };
      mockCreateStatus.mockResolvedValue({ statusSteps: [existingStep], replayAttempt: 0 });
      mockPutInCos.mockResolvedValue({ isPublished: false });
      await uploadService.processUpload({ field: 'value' } as unknown as CreateStatus);
      expect(mockCreateStatus).toBeCalledWith({ field: 'value' });
      expect(mockPutInCos).not.toBeCalled();
      expect(mockPublishToRouter).not.toBeCalled();
    });
  });

  describe('processV1V2Upload', () => {
    const mockProcessUpload = jest.fn();

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('v1 upload', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      // eslint-disable-next-line no-undef
      uploadService.bufferedData = (mockReq.files as Express.Multer.File[])[0]!.buffer;
      const expectedRequestId = hashFromFile(uploadService.bufferedData);
      uploadService.processUpload = mockProcessUpload;
      await uploadService.processV1Upload();
      expect(uploadService.rhmAccountId).toEqual('mockId');
      expect(uploadService.accountOrPrefix).toEqual('mockId');
      expect(uploadService.filename).toEqual(expectedRequestId + '.tar.gz');
      expect(uploadService.targetBucket).toEqual('test-bucket-incoming-api');
      expect(uploadService.targetRabbitMessagingRoute).toEqual(MessagingBindingAndRouting.ROUTE);
      expect(uploadService.requestId).toEqual(expectedRequestId);
      expect(uploadService.requestType).toEqual(RequestTypes.V1_METRICS);
      expect(mockProcessUpload).toBeCalledWith(
        expect.objectContaining({
          requestId: expectedRequestId,
          requestType: RequestTypes.V1_METRICS,
          inputFileName: expectedRequestId + '.tar.gz',
          replayAttempt: 0,
          accountId: 'mockId',
          accountOrPrefix: 'mockId',
        })
      );
    });

    it('v2 upload', async () => {
      const uploadService = new UploadService(mockReq, mockRes());
      // eslint-disable-next-line no-undef
      const expectedRequestId = hashFromFile((mockReq.files as Express.Multer.File[])[0]!.buffer);
      uploadService.processUpload = mockProcessUpload;
      await uploadService.processV2Upload();
      expect(uploadService.rhmAccountId).toEqual('mockId');
      expect(uploadService.accountOrPrefix).toEqual('mockId');
      expect(uploadService.filename).toEqual(expectedRequestId + '.tar.gz');
      expect(uploadService.targetBucket).toEqual('test-bucket-incoming-api');
      expect(uploadService.targetRabbitMessagingRoute).toEqual(MessagingBindingAndRouting.ROUTE);
      expect(uploadService.requestId).toEqual(expectedRequestId);
      expect(uploadService.requestType).toEqual(RequestTypes.V2_METRICS);
      expect(mockProcessUpload).toBeCalledWith(
        expect.objectContaining({
          requestId: expectedRequestId,
          requestType: RequestTypes.V2_METRICS,
          inputFileName: 'mockFile',
          replayAttempt: 0,
          accountId: 'mockId',
          accountOrPrefix: 'mockId',
        })
      );
    });

    it('superuser v2 upload', async () => {
      mockReq.headers = { 'is-super-user': 'true' };
      const res = mockRes();
      res.locals.tokenIamId = 'superIam';
      res.locals.authMethod = 'superUser';
      const uploadService = new UploadService(mockReq, res);
      // eslint-disable-next-line no-undef
      const expectedRequestId = hashFromFile((mockReq.files as Express.Multer.File[])[0]!.buffer);
      uploadService.processUpload = mockProcessUpload;
      await uploadService.processV2Upload();
      expect(mockProcessUpload).toBeCalledWith(
        expect.objectContaining({
          requestId: expectedRequestId,
          requestType: RequestTypes.V2_METRICS,
          inputFileName: 'mockFile',
          replayAttempt: 0,
          iamId: 'superIam',
          authMethod: 'superUser',
        })
      );
    });

    it('vendor v2 upload', async () => {
      mockReq.headers = {};
      const res = mockRes();
      res.locals.tokenIamId = 'vendorIam';
      res.locals.authMethod = 'accessToken';
      const uploadService = new UploadService(mockReq, res);
      // eslint-disable-next-line no-undef
      const expectedRequestId = hashFromFile((mockReq.files as Express.Multer.File[])[0]!.buffer);
      uploadService.processUpload = mockProcessUpload;
      await uploadService.processV2Upload();
      expect(mockProcessUpload).toBeCalledWith(
        expect.objectContaining({
          requestId: expectedRequestId,
          requestType: RequestTypes.V2_METRICS,
          inputFileName: 'mockFile',
          replayAttempt: 0,
          iamId: 'vendorIam',
          authMethod: 'accessToken',
        })
      );
    });
  });

  describe('validateStartAndEndDate', () => {
    it('fails if start date is defined but not end date', () => {
      const res = mockRes();
      mockReq.query = { startDate: '1' };
      const uploadService = new UploadService(mockReq, res);
      expect(() => uploadService.validateStartAndEndDate()).toThrow(
        new InvalidRequestError(`If either startDate or endDate is provided, the other must be provided as well`)
      );
    });

    it('fails if end date is defined but not start date', () => {
      const res = mockRes();
      mockReq.query = { endDate: '1' };
      const uploadService = new UploadService(mockReq, res);
      expect(() => uploadService.validateStartAndEndDate()).toThrow(
        new InvalidRequestError(`If either startDate or endDate is provided, the other must be provided as well`)
      );
    });

    it('fails if start date is greater than end date', () => {
      const res = mockRes();
      mockReq.query = { startDate: '2', endDate: '1' };
      const uploadService = new UploadService(mockReq, res);
      expect(() => uploadService.validateStartAndEndDate()).toThrow(
        new InvalidRequestError(`startDate must be less than endDate`)
      );
    });

    it('fails if end date in the future', () => {
      const res = mockRes();
      mockReq.query = { endDate: '2000000000000', startDate: '1' };
      const uploadService = new UploadService(mockReq, res);
      expect(() => uploadService.validateStartAndEndDate()).toThrow(
        new InvalidRequestError(`end date 2000000000000 cannot be in future`)
      );
    });

    it('passes for valid start and end date', () => {
      const res = mockRes();
      mockReq.query = { startDate: '1', endDate: '2' };
      const uploadService = new UploadService(mockReq, res);
      uploadService.validateStartAndEndDate();
    });
  });

  describe('processIaspUpload', () => {
    const mockProcessUpload = jest.fn();

    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('iasp upload', async () => {
      const res = mockRes();
      res.locals.tokenIamId = 'superIam';
      res.locals.authMethod = 'superUser';
      mockReq.params = { reportUrn: '10' };
      mockReq.query = { accountId: 'account' };
      const uploadService = new UploadService(mockReq, res);
      // eslint-disable-next-line no-undef
      const expectedRequestId = hashFromFile((mockReq.files as Express.Multer.File[])[0]!.buffer);
      uploadService.processUpload = mockProcessUpload;
      await uploadService.processIaspUpload();
      expect(uploadService.rhmAccountId).toEqual('account');
      expect(uploadService.accountOrPrefix).toEqual('account');
      expect(uploadService.filename).toEqual(expectedRequestId + '.xlsx');
      expect(uploadService.targetBucket).toEqual('test-bucket-incoming-api');
      expect(uploadService.targetRabbitMessagingRoute).toEqual(MessagingBindingAndRouting.IASP);
      expect(uploadService.requestId).toEqual(expectedRequestId);
      expect(uploadService.requestType).toEqual(RequestTypes.IASP);
      expect(mockProcessUpload).toBeCalledWith(
        expect.objectContaining({
          requestId: expectedRequestId,
          requestType: RequestTypes.IASP,
          inputFileName: 'mockFile',
          replayAttempt: 0,
          accountId: 'account',
          accountOrPrefix: 'account',
          iamId: 'superIam',
          authMethod: 'superUser',
          requestMetadata: { reportUrn: 10 },
        })
      );
    });

    it('iasp upload with start and end date from query params', async () => {
      const res = mockRes();
      res.locals.tokenIamId = 'superIam';
      mockReq.params = { reportUrn: '10' };
      mockReq.query = { accountId: 'account', startDate: '1', endDate: '2' };
      const uploadService = new UploadService(mockReq, res);
      // eslint-disable-next-line no-undef
      const expectedRequestId = hashFromFile((mockReq.files as Express.Multer.File[])[0]!.buffer);
      uploadService.processUpload = mockProcessUpload;
      await uploadService.processIaspUpload();
      expect(mockProcessUpload).toBeCalledWith(
        expect.objectContaining({
          requestId: expectedRequestId,
          requestType: RequestTypes.IASP,
          inputFileName: 'mockFile',
          replayAttempt: 0,
          accountId: 'account',
          accountOrPrefix: 'account',
          iamId: 'superIam',
          requestMetadata: { reportUrn: 10, startDate: 1, endDate: 2, isDatesQueryParams: true },
        })
      );
    });
  });
});

describe('UploadService', () => {
  const mockRes = {} as Response;

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('FileFilter gzip', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    const mimetype = 'application/gzip';
    const originalname = 'file.tar.gz';
    const fileBuffer = Uint8Array.of();

    const fileTypeError = 'Upload must be of mimetype application/gzip'; // Not entire error messge

    test('Continues as normal for valid gzip file', async () => {
      const gzipFile = {
        mimetype,
        originalname,
        buffer: fileBuffer,
      };

      mockFromBuffer.mockResolvedValueOnce({ ext: 'gz', mime: mimetype });

      const mockReqWithZip = {
        originalUrl: '/metering/api/v2/metrics',
        // eslint-disable-next-line no-undef
        files: [gzipFile as Express.Multer.File],
        headers: {},
      } as Request;

      const uploadService = new UploadService(mockReqWithZip, mockRes);
      await uploadService.verifyGzip();
    });

    test('Throws error when there are no files', async () => {
      const mockReqWithZip = {
        originalUrl: '/metering/api/v2/metrics',
        headers: {},
      } as Request;

      const uploadService = new UploadService(mockReqWithZip, mockRes);
      try {
        await uploadService.verifyGzip();
        throw new Error('shouldnt reach');
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
      }
    });

    test('Throws error when the mimetype is not gzip (any other type)', async () => {
      const gzipFile = {
        mimetype: 'application/json',
        originalname,
        buffer: fileBuffer,
      };

      mockFromBuffer.mockResolvedValueOnce({ ext: 'gz', mime: mimetype });

      const mockReqWithZip = {
        originalUrl: '/metering/api/v2/metrics',
        // eslint-disable-next-line no-undef
        files: [gzipFile as Express.Multer.File],
        headers: {},
      } as Request;

      const uploadService = new UploadService(mockReqWithZip, mockRes);
      try {
        await uploadService.verifyGzip();
        throw new Error('shouldnt reach');
      } catch (error) {
        expect(error).toBeInstanceOf(UnsupportedMediaType);
        expect((error as UnsupportedMediaType).message.includes(fileTypeError)).toBeTruthy();
      }
    });

    test('Throws error when the detected filetype is not gzip (any other type)', async () => {
      const gzipFile = {
        mimetype: 'application/gzip',
        originalname,
        buffer: fileBuffer,
      };

      mockFromBuffer.mockResolvedValueOnce({ ext: 'xlsx', mime: mimetype });

      const mockReqWithZip = {
        originalUrl: '/metering/api/v2/metrics',
        // eslint-disable-next-line no-undef
        files: [gzipFile as Express.Multer.File],
        headers: {},
      } as Request;

      const uploadService = new UploadService(mockReqWithZip, mockRes);
      try {
        await uploadService.verifyGzip();
        throw new Error('shouldnt reach');
      } catch (error) {
        expect(error).toBeInstanceOf(UnsupportedMediaType);
        expect((error as UnsupportedMediaType).message.includes(fileTypeError)).toBeTruthy();
      }
    });
  });

  describe('FileFilter xlsx', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    const mimetype = 'any';
    const originalname = 'file.xlsx';
    const fileBuffer = Uint8Array.of();

    test('Continues as normal for valid xlsx file', async () => {
      const xlsxFile = {
        mimetype,
        originalname,
        buffer: fileBuffer,
      };

      mockFromBuffer.mockResolvedValueOnce({
        ext: 'xlsx',
        mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const mockReqWithXlsx = {
        originalUrl: '/metering/api/v2/metrics',
        // eslint-disable-next-line no-undef
        files: [xlsxFile as Express.Multer.File],
        headers: {},
      } as Request;

      const uploadService = new UploadService(mockReqWithXlsx, mockRes);
      await uploadService.verifyXlxs();
    });

    test('Throws error when there are no files', async () => {
      const mockReqWithXlsx = {
        originalUrl: '/metering/api/v2/metrics',
        headers: {},
      } as Request;

      const uploadService = new UploadService(mockReqWithXlsx, mockRes);
      try {
        await uploadService.verifyXlxs();
        throw new Error('shouldnt reach');
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError);
      }
    });

    test('Throws error when the detected filetype is not xlsx (any other type)', async () => {
      const xlsxFile = {
        mimetype: '',
        originalname,
        buffer: fileBuffer,
      };

      mockFromBuffer.mockResolvedValueOnce({ ext: 'gz', mime: 'application/gzip' });

      const mockReqWithXlsx = {
        originalUrl: '/metering/api/v2/metrics',
        // eslint-disable-next-line no-undef
        files: [xlsxFile as Express.Multer.File],
        headers: {},
      } as Request;

      const uploadService = new UploadService(mockReqWithXlsx, mockRes);
      try {
        await uploadService.verifyXlxs();
        throw new Error('shouldnt reach');
      } catch (error) {
        expect(error).toBeInstanceOf(UnsupportedMediaType);
        expect(
          (error as UnsupportedMediaType).message.includes(
            'Upload must end in .xlsx, and be a valid excel spreadsheet file'
          )
        ).toBeTruthy();
      }
    });
  });

  describe('saveUserResponseReturned', () => {
    it('saves userResponseReturned', async () => {
      statusHandlerInstance.save = jest.fn().mockResolvedValueOnce(true);
      const uploadService = new UploadService({ headers: {} } as Request, mockRes);
      uploadService.statusId = 'statusId';
      await uploadService.saveUserResponseReturned();
      expect(statusHandlerInstance.save).toBeCalledWith(
        {
          userResponseReturned: true,
        },
        { id: 'statusId' },
        null
      );
    });

    it('saves userResponseReturned with accountOrPrefix', async () => {
      statusHandlerInstance.save = jest.fn().mockResolvedValueOnce(true);
      const uploadService = new UploadService({ headers: {} } as Request, mockRes);
      uploadService.statusId = 'statusId';
      uploadService.accountOrPrefix = 'acct';
      await uploadService.saveUserResponseReturned();
      expect(statusHandlerInstance.save).toBeCalledWith(
        {
          userResponseReturned: true,
        },
        { id: 'statusId' },
        'acct'
      );
    });

    it('logs errors without rethrowing', async () => {
      statusHandlerInstance.save = jest.fn().mockRejectedValueOnce(new Error());
      const uploadService = new UploadService({ headers: {} } as Request, mockRes);
      uploadService.statusId = 'statusId';
      await uploadService.saveUserResponseReturned();
    });
  });
});

describe('gzipV1Data', () => {
  beforeEach(() => {
    mockedTarImpl.mockImplementation(() => {
      return {
        tarGzipData,
      } as unknown as TarImpl;
    });
  });

  it('gzips v1 data', async () => {
    const uploadService = new UploadService({ headers: {} } as Request, {} as Response);
    await uploadService.gzipV1Data({ field: 'value' });
    expect(tarGzipData).toBeCalledWith({
      ['manifest.json']: {
        version: '1',
        type: 'accountMetrics',
      },
      ['report-file.json']: { field: 'value' },
    });
  });

  it('handles error gzipping v1 data', async () => {
    const uploadService = new UploadService({ headers: {} } as Request, {} as Response);
    tarGzipData.mockRejectedValueOnce(new Error());
    await expect(uploadService.gzipV1Data({ field: 'value' })).rejects.toBeInstanceOf(Error);
  });
});
