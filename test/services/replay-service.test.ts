import { ReplayRequest, ReplayService } from '../../src/services/replay-service';
import { MessagingBindingAndRouting, ServiceUnavailableError } from '@symposium/usage-common';
import { StatusCodes } from 'http-status-codes';

const mockPublish = jest.fn();
jest.mock('../../src/steps/step-producer-getter', () => ({
  getRouterProducer: () => ({
    publish: mockPublish,
  }),
}));

const replayRequest: ReplayRequest = {
  requestId: 'requestId',
  accountOrPrefix: 'account1',
  email: 'test@ibm.com',
  superUserIamId: 'dG9rZW5JYW1JZA==',
};
let replayService: ReplayService;
describe('Replay Service', () => {
  beforeEach(() => {
    replayService = new ReplayService(replayRequest);
  });
  it('ReplayService constructor', () => {
    expect(replayService).toBeDefined();
    expect(replayService).toBeInstanceOf(ReplayService);
  });

  describe('Publish replay', () => {
    it('Happy path publishes message for request', async () => {
      await expect(replayService.publishReplay()).resolves.toEqual({
        requestId: 'requestId',
        accountOrPrefix: 'account1',
        superUserIamId: '***',
        httpCode: StatusCodes.ACCEPTED,
      });
      expect(mockPublish).toHaveBeenCalledWith(MessagingBindingAndRouting.REPLAY, replayRequest);
    });

    it('Happy path publishes message for usageEvent', async () => {
      replayRequest.eventId = 'event1234';
      replayService = new ReplayService(replayRequest);
      await expect(replayService.publishReplay()).resolves.toEqual({
        requestId: 'requestId',
        accountOrPrefix: 'account1',
        eventId: 'event1234',
        superUserIamId: '***',
        httpCode: StatusCodes.ACCEPTED,
      });
      expect(mockPublish).toHaveBeenCalledWith(MessagingBindingAndRouting.REPLAY, replayRequest);
    });

    it.each([
      ['not well-formed', new Error('error'), 500],
      ['well-formed', new ServiceUnavailableError('error'), 503],
    ])('handles %s messaging error', async (name, errorThrown, statusCode) => {
      mockPublish.mockRejectedValue(errorThrown);
      await expect(replayService.publishReplay()).resolves.toEqual({
        accountOrPrefix: replayRequest.accountOrPrefix,
        eventId: replayRequest.eventId,
        requestId: replayRequest.requestId,
        superUserIamId: '***',
        httpCode: statusCode,
      });
    });
  });
});
