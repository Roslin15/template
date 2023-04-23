import { App } from '../src/app';
import { authServiceInstance } from '../src/loaders/auth-service-loader';
import express from 'express';
import supertest from 'supertest';

jest.mock('@symposium/usage-common', () => ({
  ...jest.requireActual('@symposium/usage-common'),
  AccountHealth: jest.fn(),
}));

describe('Test app', () => {
  test('Starting the app', () => {
    const useSpy = jest.spyOn(express.application, 'use');
    const testApp = new App().getExpressApp();
    expect(useSpy).toBeCalledTimes(13);
    expect(typeof testApp).toEqual('function');
  });

  test('sending an ilmt request to v1 metrics', (done) => {
    const testApp = new App().getExpressApp();
    supertest(testApp)
      .post('/liveness')
      .set('Content-type', 'application/json; utf-8')
      .send({ data: [] })
      .end((err, res) => {
        console.log();
        expect(res.statusCode).toEqual(200);
        done();
      });
  });

  describe('Authentication', () => {
    const superUserAuthenticatorSpy = jest.spyOn(authServiceInstance, 'superUserAuthenticator');
    const accessTokenOrPullSecretOrEntitlementKeyAuthenticatorSpy = jest.spyOn(
      authServiceInstance,
      'accessTokenOrPullSecretOrEntitlementKeyAuthenticator'
    );
    let testApp: express.Express;

    beforeEach(() => {
      jest.clearAllMocks();
      testApp = new App().getExpressApp();
    });

    test.each<Array<string | jest.SpyInstance | jest.DoneCallback>>([
      [
        'accessTokenOrPullSecretOrEntitlementKeyAuthenticator',
        '/metering/api/v2/metrics',
        accessTokenOrPullSecretOrEntitlementKeyAuthenticatorSpy,
      ],
      [
        'accessTokenOrPullSecretOrEntitlementKeyAuthenticator',
        '/metering/api/v1/metrics',
        accessTokenOrPullSecretOrEntitlementKeyAuthenticatorSpy,
      ],
      [
        'accessTokenOrPullSecretOrEntitlementKeyAuthenticator',
        '/metering/v1/status',
        accessTokenOrPullSecretOrEntitlementKeyAuthenticatorSpy,
      ],
      ['superUserAuthenticator', '/metering/v2/replay', superUserAuthenticatorSpy],
      ['superUserAuthenticator', '/metering/v1/usageevent', superUserAuthenticatorSpy],
      ['superUserAuthenticator', '/metering/v1/tenant', superUserAuthenticatorSpy],
    ])('Authenticates with %s for route %s', (_authenticatorName, route, authenticatorSpy, done) => {
      supertest(testApp)
        .get(route as string)
        .end(() => {
          expect(authenticatorSpy).toHaveBeenCalledTimes(1);
          (done as jest.DoneCallback)();
        });
    });
  });
});
