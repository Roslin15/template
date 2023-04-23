// node server
import { logger, mongoImpl } from '@symposium/usage-common';
import { App } from './app';
import { cosLoader } from './loaders/cos-loader';
import { esmHealthLoader } from './loaders/esm-health-loader';
import { mongoLoader } from './loaders/mongo-loader';
import { tenantLoader } from './loaders/tenant-loader';
import { catalogHealthLoader } from './loaders/catalog-health-loader';
import { runCosExample } from './services/cos-example';
import { runMongoStatusExample } from './services/usage-status-example';
import { featureFlagsLoader } from './loaders/feature-flags-loader';
import { runFeatureFlagsExample } from './services/feature-flags-example';
import { accountHealthLoader } from './loaders/account-health-loader';
import { rabbitMQConnectionManager, rabbitMQLoader } from './loaders/rabbitmq-loader';
import { systemManagerLoader } from './loaders/system-manager-loader';
import { githubHealthLoader } from './loaders/github-health-loader';
import { commerceHealthLoader } from './loaders/commerce-health-loader';
import { runMessagingSample } from './services/messaging-sample';
import { runCommerceApiExample } from './services/commerce-api-example';

/**
 * Init process event handlers
 */
process.on('SIGINT', async () => {
  // CTRL+C signal
  logger.info('Server: SIGINT received; exiting application');
  await closeDependencies();
  process.exit();
});

process.once('SIGTERM', async () => {
  logger.info('Server: SIGTERM received; exiting application');
  await closeDependencies();
  process.exit();
});

process.on('beforeExit', (code) => {
  console.log('Server: process beforeExit event with code: ', code);
});

process.on('exit', () => {
  logger.info('Server: Exit received; application shutting down');
});

process.on('uncaughtException', async (err) => {
  logger.error(`Server: UncaughtException received; error = ${err.message}`);
  logger.error(err);
  await closeDependencies();
  process.exit();
});

export const loadDependencies = async () => {
  logger.verbose(`server loadDependencies loading dependencies`);
  let gotErrorsLoadingDependencies = false;

  try {
    // Single instance loaded in common, need to init at start up for service
    await featureFlagsLoader();
  } catch (e) {
    logger.error(`server loadDependencies Unable to load dependencies feature flag - service shutting down`, e);
    // Some dependencies might have connected
    await closeDependencies();
    process.exit(1);
  }

  try {
    await mongoLoader();
    await tenantLoader();
  } catch (e) {
    gotErrorsLoadingDependencies = true;
    logger.error(`server loadDependencies Unable to load dependencies - mongo and tenant`, e);
  }

  try {
    // COS Does not have connection pooling so needs a trigger to check the health
    await cosLoader();
  } catch (e) {
    gotErrorsLoadingDependencies = true;
    logger.error(`server loadDependencies Unable to load dependencies - cos`, e);
  }

  try {
    await rabbitMQLoader();
  } catch (e) {
    gotErrorsLoadingDependencies = true;
    logger.error(`server loadDependencies Unable to load dependencies - rabbit`, e);
  }

  if (!gotErrorsLoadingDependencies) {
    try {
      await accountHealthLoader();
      await catalogHealthLoader();
      await commerceHealthLoader();
      await esmHealthLoader();
      await githubHealthLoader();
      // TODO Remove when creating a new repo
      // Loading messages prior to step loader to test async handling
      await runMessagingSample();

      // system manager should load after all other dependency
      await systemManagerLoader();

      logger.info(`server loadDependencies dependencies have loaded and started`);
    } catch (e) {
      logger.error(`server loadDependencies Unable to load dependencies, unhealthy`, e);
    }
  }
};

const closeDependencies = async () => {
  // As dependencies are added and if needed, add a close implementation
  logger.info(`SHUTTING DOWN and closing dependency`);
  try {
    await rabbitMQConnectionManager.disconnect();
  } catch (error) {
    logger.warn(`closeDependencies could not rabbitMQConnectionManager.disconnect()`);
  }

  try {
    await mongoImpl.disconnect();
  } catch (error) {
    logger.warn(`closeDependencies could not mongoImpl.disconnect`);
  }

  logger.info(`SHUTTING DOWN and dependency closed`);
};

const startApp = async () => {
  await loadDependencies();
  const app = new App();
  app.listen();

  // Temp code to run dependency examples
  // Run Mongo example
  if (process.env.SKIP_MONGO_SAMPLE && process.env.SKIP_MONGO_SAMPLE === 'true') {
    logger.debug('server startApp skipping runMongoStatusExample');
  } else {
    await runMongoStatusExample();
  }
  // Run COS example.
  if (process.env.SKIP_COS_SAMPLE && process.env.SKIP_COS_SAMPLE === 'true') {
    logger.debug('server startApp skipping runCosExample');
  } else {
    await runCosExample();
  }

  if (process.env.SKIP_FEATURE_FLAG_SAMPLE && process.env.SKIP_FEATURE_FLAG_SAMPLE === 'true') {
    logger.debug('server startApp skipping runFeatureFlagsExample');
  } else {
    await runFeatureFlagsExample();
  }

  if (process.env.SKIP_COMMERCE_API_SAMPLE && process.env.SKIP_COMMERCE_API_SAMPLE === 'true') {
    logger.debug('server startApp skipping runCommerceApiExample');
  } else {
    await runCommerceApiExample();
  }
};

startApp();
