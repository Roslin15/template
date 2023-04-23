// API doesn't use steps the normal way, it just uses them as shells around a producer
// managed by the system-manager. This class has util functions to get the producer from steps

import { Producer } from '@symposium/usage-common';
import { systemManagerInstance } from '../loaders/system-manager-loader';

export const getRouterProducer = (): Producer => {
  return systemManagerInstance.managedSteps.get('SendToRouterStep')?.stepInstance.stepProducer!;
};
