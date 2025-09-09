import pino from 'pino';

// Use a simple, transport-less logger to avoid worker-thread transports
// that are incompatible or unavailable in some runtimes.
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  base: { env: process.env.NODE_ENV },
});

export type Logger = typeof logger;
