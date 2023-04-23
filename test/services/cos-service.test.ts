import { COSImpl, NotFound, ServiceUnavailableError } from '@symposium/usage-common';
import { cosHandlerInstance } from '../../src/loaders/cos-loader';
import { CosService } from '../../src/services/cos-service';
describe('CosService', () => {
  let cosService: CosService;
  let mockedWriteObject: jest.MockedFunction<COSImpl['writeObject']>;
  let mockedGetObject: jest.MockedFunction<COSImpl['getObject']>;

  beforeEach(() => {
    cosService = new CosService('test-file', 'test-account1');
    mockedWriteObject = jest.fn();
    mockedGetObject = jest.fn();
    cosHandlerInstance.writeObject = mockedWriteObject;
    cosHandlerInstance.getObject = mockedGetObject;
  });

  describe('uploadFile', () => {
    it('happy path: should upload file', async () => {
      await cosService.uploadFile('test-data', 'test-bucket-incoming-api');
      expect(mockedWriteObject).toBeCalledTimes(1);
      expect(mockedWriteObject).toBeCalledWith('test-bucket-incoming-api', 'test-account1/test-file', 'test-data');
    });

    it('should throw error back to caller when writeObject throws error', async () => {
      const serviceUnavailableError = new ServiceUnavailableError('cos');
      mockedWriteObject.mockRejectedValue(serviceUnavailableError);
      await expect(cosService.uploadFile('test-data', 'mock-bucket')).rejects.toThrow(serviceUnavailableError);
    });
  });

  describe('downloadFile', () => {
    it('happy path: should download file', async () => {
      await cosService.downloadFile('test-bucket-archive', 'test-bucket-incoming-api');
      expect(mockedGetObject).toBeCalledTimes(1);
      expect(mockedGetObject).toBeCalledWith('test-bucket-archive', 'test-account1/test-file', 'test-account1');
    });

    it('should look in fallback bucket if no file found in bucket to download from', async () => {
      const notFoundError = new NotFound('file-not-found');
      mockedGetObject.mockRejectedValueOnce(notFoundError);
      await cosService.downloadFile('test-bucket-archive', 'test-bucket-incoming-api');
      expect(mockedGetObject).toBeCalledTimes(2);
      expect(mockedGetObject).toHaveBeenNthCalledWith(
        1,
        'test-bucket-archive',
        'test-account1/test-file',
        'test-account1'
      );
      expect(mockedGetObject).toHaveBeenNthCalledWith(2, 'test-bucket-incoming-api', 'test-account1/test-file');
    });

    it('should pass accountOrPrefix as undefined to getObject if none is set on object', async () => {
      cosService = new CosService('test-download');
      await cosService.downloadFile('test-bucket-archive', 'test-bucket-incoming-api');
      expect(mockedGetObject).toBeCalledTimes(1);
      expect(mockedGetObject).toBeCalledWith('test-bucket-archive', 'test-download', undefined);
    });

    it('should throw error back to caller if error other than notfound is thrown while download', async () => {
      const serviceUnavailableError = new ServiceUnavailableError('cos');
      mockedGetObject.mockRejectedValueOnce(serviceUnavailableError);
      await expect(cosService.downloadFile('test-bucket-archive', 'test-bucket-incoming-api')).rejects.toThrow(
        serviceUnavailableError
      );
      expect(mockedGetObject).toBeCalledTimes(1);
      expect(mockedGetObject).toHaveBeenLastCalledWith(
        'test-bucket-archive',
        'test-account1/test-file',
        'test-account1'
      );
    });
  });
});
