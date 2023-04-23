import { SendToRouterStep } from '../../src/steps/send-to-router-step';

describe('Handle message', () => {
  it('Should throw an error if handleMessage is called', async () => {
    const step = new SendToRouterStep(async () => {});
    await expect(step.handleMessage()).rejects.toThrowError('SendToRouterStep handleMessage should not be called');
  });
});
