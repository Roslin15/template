// Each repo will update this file to create it's own configuration index

import { ConfigByEnvironment, Environments, stringToEnvironment } from '@symposium/usage-common';

export interface ConfigSettings {
  PORT: string;
  EXAMPLE?: string;
  // DO NOT INCLUDE DeP or shared configs - should be in common
  // specific to service
  // etc..
}

const configDefaultSettings: ConfigByEnvironment<ConfigSettings> = {
  [Environments.DEV]: {
    PORT: '4000',
    EXAMPLE: 'Default example string to be replaced',
  },
  [Environments.TEST]: {
    PORT: '4000',
    EXAMPLE: 'Default example string to be replaced',
  },
  [Environments.STAGE]: {
    PORT: '4000',
    EXAMPLE: undefined,
  },
  [Environments.PROD]: {
    PORT: '4000',
    EXAMPLE: undefined,
  },
};

export const getConfig = (env = stringToEnvironment(process.env.ENV)): ConfigSettings => {
  const serviceConfig: ConfigSettings = {
    PORT: process.env.PORT || configDefaultSettings[env].PORT,
    EXAMPLE: process.env.EXAMPLE || configDefaultSettings[env].EXAMPLE,
  };
  return serviceConfig;
};
