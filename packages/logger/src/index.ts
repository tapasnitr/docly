import pino from 'pino';

export const createLogger = (name: string, level: string = 'info') => {
  return pino(
    {
      name,
      level,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          singleLine: false,
          translateTime: 'SYS:standard',
        },
      },
    }
  );
};

// Create a default logger
export const logger = createLogger('docly');

export default logger;
