import { CatalogHealth, logger } from '@symposium/usage-common';

// export single instance to be used
export const catalogHealthInstance: CatalogHealth = new CatalogHealth();

export const catalogHealthLoader = async () => {
  try {
    logger.verbose('catalogHealthLoader Catalog Health being loaded');
    await catalogHealthInstance.health();
  } catch (e) {
    logger.error('catalogHealthLoader Catalog health loader failed to load at startup', e);
    throw e;
  }
};
