import pino, { type Logger, type LoggerOptions } from 'pino';

// Logging strategy: structured JSON everywhere (required for log aggregation in
// production), pretty-printed only when NODE_ENV !== 'production' so local dev
// stays readable. No separate env var - it follows NODE_ENV so there's one less
// thing to misconfigure at deploy time.
export const getLoggerOptions = (name: string, level: string = 'info'): LoggerOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    name,
    level,
    ...(isProduction
      ? {}
      : {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              singleLine: false,
              translateTime: 'SYS:standard',
            },
          },
        }),
  };
};

// Standalone logger instance, for processes that aren't handed their logger
// by a framework (e.g. the worker). Frameworks that construct their own
// logger internally (e.g. Fastify) should use getLoggerOptions() instead -
// a pre-built pino instance isn't type-compatible with Fastify's expected
// logger shape.
export const createLogger = (name: string, level: string = 'info'): Logger => {
  return pino(getLoggerOptions(name, level));
};

// Create a default logger
export const logger = createLogger('docly');

export default logger;
