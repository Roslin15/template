import { GithubHealth, logger } from '@symposium/usage-common';

export const githubHealthInstance: GithubHealth = new GithubHealth();

export const githubHealthLoader = async () => {
  try {
    logger.verbose('githubHealthLoader loading');
    await githubHealthInstance.health();
  } catch (e) {
    logger.error('githubHealthLoader failed', e);
    throw e;
  }
};
