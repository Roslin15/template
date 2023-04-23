import { githubHealthInstance, githubHealthLoader } from '../../src/loaders/github-health-loader';

describe('GithubHealth loader', () => {
  afterAll(async () => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });
  it('Loads a single GithubHealth instance', () => {
    expect(githubHealthInstance).toBeDefined();
  });

  it('can handle when an error is thrown', async () => {
    githubHealthInstance.health = jest.fn().mockRejectedValue(new Error('mock error'));
    await expect(githubHealthLoader()).rejects.toThrow('mock error');
  });
});
