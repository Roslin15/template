// istanbul ignore file
import { authServiceInstance } from '../../loaders/auth-service-loader';
import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';

const authExample = (req: Request, res: Response) => {
  if (req.headers['is-super-user'] === 'true') {
    return res.status(StatusCodes.OK).send('You are a super user!');
  }
  if (req.headers.rhmAccountId !== undefined) {
    return res.status(StatusCodes.OK).send('You are a pull secret or IBM entitlement key user!');
  }
  if (res.locals.tokenIamId !== undefined) {
    return res.status(StatusCodes.OK).send('You are an access token user!');
  }
  return res.status(StatusCodes.OK).send('You are an unauthenticated user!');
};

export const authExampleAny = [authServiceInstance.accessTokenOrPullSecretOrEntitlementKeyAuthenticator, authExample];
export const authExampleAccessToken = [authServiceInstance.accessTokenAuthenticator, authExample];
export const authExamplePullSecretOrEntitlementKey = [
  authServiceInstance.pullSecretOrEntitlementKeyAuthenticator,
  authExample,
];
export const authExampleSuperUser = [authServiceInstance.superUserAuthenticator, authExample];
export const authExampleNone = authExample;
