import { authServiceInstance, authServiceLoader } from '../../src/loaders/auth-service-loader';
import { AuthService } from '@symposium/usage-common';

jest.mock('@symposium/usage-common');
const authServiceMock = AuthService as jest.MockedClass<typeof AuthService>;

describe('AuthService loader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it('Loads a single AuthService instance', () => {
    expect(authServiceInstance).toBeDefined();
  });

  it('Throws error', () => {
    authServiceMock.mockImplementation(() => {
      throw 'mock error';
    });
    expect(() => authServiceLoader()).toThrowError('mock error');
  });
});
