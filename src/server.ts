// node server
import { logger, mongoImpl } from '@symposium/usage-common';
import { App } from './app';
import { accountHealthLoader } from './loaders/account-health-loader';
import { cosLoader } from './loaders/cos-loader';
import { esmHealthLoader } from './loaders/esm-health-loader';
import { featureFlags, featureFlagsLoader } from './loaders/feature-flags-loader';
import { mongoLoader } from './loaders/mongo-loader';
import { rabbitMQConnectionManager, rabbitMQLoader } from './loaders/rabbitmq-loader';
import { systemManagerLoader } from './loaders/system-manager-loader';
import { tenantLoader } from './loaders/tenant-loader';

const fileName = 'server';
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

process.on('exit', () => {
  logger.info('Server: Exit received; application shutting down');
});

process.on('uncaughtException', async (err) => {
  logger.error(`Server: UncaughtException received; error = ${err.message}`, err);
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
    gotErrorsLoadingDependencies = true;
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

  try {
    await esmHealthLoader();
    await accountHealthLoader();
    logger.debug(`server loadDependencies API healths checked`);

    // system manager should load after all dependencies
    if (!gotErrorsLoadingDependencies) {
      await systemManagerLoader();
    } else {
      logger.info(`server loadDependencies gotErrorsLoadingDependencies - Skipping loading systemManagerLoader`);
    }

    logger.info(`server loadDependencies dependencies have loaded and started`);
  } catch (e) {
    logger.error(`server loadDependencies Unable to load dependencies`, e);
  }
};

const closeDependencies = async () => {
  // As dependencies are added and if needed, add a close implementation
  logger.info(`${fileName} closeDependencies SHUTTING DOWN and closing dependency`);

  try {
    await rabbitMQConnectionManager.disconnect();
  } catch (error) {
    logger.warn(`closeDependencies could not disconnect rabbit`);
  }

  try {
    await mongoImpl.disconnect();
  } catch (error) {
    logger.warn(`closeDependencies could not mongoImpl.disconnect`);
  }

  try {
    featureFlags.close();
  } catch (error) {
    logger.warn(`closeDependencies could not featureFlags.close`);
  }

  logger.info(`SHUTTING DOWN and dependency closed`);
};

const startApp = async () => {
  await loadDependencies();
  const app = new App();
  app.listen();
};

startApp();
