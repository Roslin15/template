import path from 'path';
import express from 'express';
import { Express } from 'express-serve-static-core';
import { errorMiddleware, expressWinstonLogger, logger, noCache } from '@symposium/usage-common';
import * as OpenApiValidator from 'express-openapi-validator';
import { getConfig } from './config/config';
import { getLivenessStatus } from './api/routes/liveness';
import { getReadinessStatus } from './api/routes/readiness';

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
    this.expressApp.use(express.json()); // for parsing application/json
    this.expressApp.use('/liveness', getLivenessStatus);
    this.expressApp.use('/readiness', getReadinessStatus);
    this.expressApp.use(noCache);
    this.expressApp.use('/spec', express.static(apiSpec));

    this.expressApp.use(
      OpenApiValidator.middleware({
        apiSpec,
        validateResponses: true,
        validateRequests: true,
        operationHandlers: path.join(__dirname, 'api', 'routes'),
      })
    );
    this.expressApp.use(errorMiddleware);
  }
}
