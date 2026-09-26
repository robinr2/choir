import { CHOIR_CONFIG, choirConfigFrom } from './choir-config.js';
import { findExecutable } from './executable.js';

export const choirConfigProvider = {
  provide: CHOIR_CONFIG,
  useFactory: () => ({
    ...choirConfigFrom(process.env),
    claudeExecutable: findExecutable('claude', process.env.PATH),
  }),
};
