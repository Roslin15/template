import path from 'path';
import express, { Express } from 'express';
import { errorMiddleware, expressWinstonLogger, noCache, logger } from '@symposium/usage-common';
import * as OpenApiValidator from 'express-openapi-validator';
import { getConfig } from './config/config';
import { getLivenessStatus } from './api/routes/liveness';
import { getReadinessStatus } from './api/routes/readiness';
import { authServiceInstance } from './loaders/auth-service-loader';
import { v1ErrorMiddleware } from './api/middlewares/v1-error-middleware';
import { notFound } from './api/middlewares/not-found';

const apiSpec = path.join(__dirname, 'api.yml');

// express app
export class App {
  expressApp: Express;
  port: string;

  constructor() {
    this.expressApp = express();
    this.expressApp.use(expressWinstonLogger);
    this.mountRoutes();
    this.port = getConfig().PORT;
  }
  /* istanbul ignore next */
  public listen() {
    this.expressApp.listen(this.port);
    logger.info(`App listening on http://localhost:${this.port}`);
  }
  getExpressApp() {
    return this.expressApp;
  }

  private mountRoutes() {
    this.expressApp.use((req, _res, next) => {
      if (req.headers['content-type'] === 'application/json; utf-8') {
        req.headers['content-type'] = 'application/json';
      }
      next();
    });
    this.expressApp.use(express.json()); // for parsing application/json
    this.expressApp.use('/liveness', getLivenessStatus);
    this.expressApp.use('/readiness', getReadinessStatus);
    this.expressApp.use(
      ['/metering/api/v2/metrics', '/metering/api/v1/metrics', '/metering/v1/status'],
      authServiceInstance.accessTokenOrPullSecretOrEntitlementKeyAuthenticator
    );
    this.expressApp.use(
      [
        '/metering/v2/replay',
        '/metering/v1/usageevent',
        '/metering/v1/tenant',
        '/metering/v1/report/iasp',
        '/metering/status/aborted/v1',
      ],
      authServiceInstance.superUserAuthenticator
    );
    this.expressApp.use(noCache);
    this.expressApp.use('/spec', express.static(apiSpec));
    this.expressApp.use(
      OpenApiValidator.middleware({
        apiSpec,
        validateResponses: true,
        validateRequests: true,
        operationHandlers: path.join(__dirname, 'api', 'routes'),
        fileUploader: false,
      })
    );
    this.expressApp.use(v1ErrorMiddleware);
    this.expressApp.use(errorMiddleware);
    this.expressApp.use(notFound); // Catchall 404. We only get here if nothing else returned a response yet
  }
}
