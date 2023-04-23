import { CatalogHealth } from '@symposium/usage-common';
import { catalogHealthInstance, catalogHealthLoader } from '../../src/loaders/catalog-health-loader';

describe('Catalog health loader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it('Loads a single catalog health instance', () => {
    expect(catalogHealthInstance).toBeDefined();
    expect(catalogHealthInstance instanceof CatalogHealth).toBe(true);
  });

  it('can handle when an error is thrown', async () => {
    catalogHealthInstance.health = jest.fn().mockRejectedValue(new Error('mock error'));
    await expect(catalogHealthLoader()).rejects.toThrow('mock error');
  });
});
