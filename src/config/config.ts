import { ConfigByEnvironment, stringToEnvironment } from '@symposium/usage-common';
export interface ConfigSettings {
  PORT: string;
  INCOMING_MESSAGE_QUEUE_BUCKET: string;
  ARCHIVE_BUCKET: string;
  IASP_ARCHIVE_BUCKET: string;
  EXISTING_STATUS_DELAY: number;
  // DO NOT INCLUDE DeP or shared configs - should be in common
  // specific to service
  // etc..
}

const configDefaultSettings: ConfigByEnvironment<ConfigSettings> = {
  dev: {
    PORT: '4001',
    INCOMING_MESSAGE_QUEUE_BUCKET: 'test-bucket-incoming-api',
    ARCHIVE_BUCKET: `test-bucket-archive`,
    IASP_ARCHIVE_BUCKET: 'test-bucket-iasp-archive',
    EXISTING_STATUS_DELAY: 500,
  },
  test: {
    PORT: '4001',
    INCOMING_MESSAGE_QUEUE_BUCKET: 'test-bucket-incoming-api',
    ARCHIVE_BUCKET: 'test-bucket-archive',
    IASP_ARCHIVE_BUCKET: 'test-bucket-iasp-archive',
    EXISTING_STATUS_DELAY: 500,
  },
  stage: {
    PORT: '4001',
    INCOMING_MESSAGE_QUEUE_BUCKET: 'rhm-usage-incoming-api-sandbox',
    ARCHIVE_BUCKET: `rhm-usage-archive-sandbox`,
    IASP_ARCHIVE_BUCKET: 'rhm-usage-iasp-archive-sandbox',
    EXISTING_STATUS_DELAY: 500,
  },
  prod: {
    PORT: '4001',
    INCOMING_MESSAGE_QUEUE_BUCKET: 'rhm-usage-incoming-api',
    ARCHIVE_BUCKET: 'rhm-usage-archive',
    IASP_ARCHIVE_BUCKET: 'rhm-usage-iasp-archive',
    EXISTING_STATUS_DELAY: 500,
  },
};

export const getConfig = (env = stringToEnvironment(process.env.ENV)): ConfigSettings => {
  return {
    PORT: process.env.PORT || configDefaultSettings[env].PORT,
    INCOMING_MESSAGE_QUEUE_BUCKET:
      process.env.INCOMING_MESSAGE_QUEUE_BUCKET || configDefaultSettings[env].INCOMING_MESSAGE_QUEUE_BUCKET,
    ARCHIVE_BUCKET: process.env.ARCHIVE_BUCKET || configDefaultSettings[env].ARCHIVE_BUCKET,
    IASP_ARCHIVE_BUCKET: process.env.IASP_ARCHIVE_BUCKET || configDefaultSettings[env].IASP_ARCHIVE_BUCKET,
    EXISTING_STATUS_DELAY:
      Number(process.env.EXISTING_STATUS_DELAY) || configDefaultSettings[env].EXISTING_STATUS_DELAY,
  };
};
