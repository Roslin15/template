import { Producer } from '@symposium/usage-common';
import { rabbitMQConnectionManager, rabbitMQLoader } from '../../src/loaders/rabbitmq-loader';

jest.mock('@symposium/usage-common');
const mockedProducer = Producer as jest.MockedClass<typeof Producer>;

describe('rabbitmq-loader', () => {
  beforeEach(() => {
    mockedProducer.mockImplementation(() => {
      return {
        init: () => {},
      } as unknown as Producer;
    });
  });
  afterAll(async () => {
    jest.clearAllMocks();
  });

  it('Should load a single rabbit connection manager to be loaded', () => {
    expect(rabbitMQConnectionManager).toBeDefined();
  });

  it('The loader function should initialize the connection', () => {
    rabbitMQLoader();
    expect(rabbitMQConnectionManager.connect).toBeCalled();
  });

  it('throws error when there is error while creating instance', async () => {
    rabbitMQConnectionManager.connect = jest.fn().mockRejectedValueOnce(new Error('mock error'));
    await expect(rabbitMQLoader()).rejects.toThrow('mock error');
  });
});
