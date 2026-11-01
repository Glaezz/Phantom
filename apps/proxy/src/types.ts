import type { AppConfig } from './env';

export type Variables = {
  requestId: string;
  startedAt: number;
  config: AppConfig;
  retryAfter?: string;
};

export type AppEnv = {
  Bindings: Env;
  Variables: Variables;
};
