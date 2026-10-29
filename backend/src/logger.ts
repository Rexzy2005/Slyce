export type LogLevel = 'info' | 'error';

export interface Logger {
  info(message: string, fields?: Record<string, string | number | boolean>): void;
  error(message: string, fields?: Record<string, string | number | boolean>): void;
}

function write(level: LogLevel, message: string, fields?: Record<string, string | number | boolean>): void {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: 'slyyce-backend',
    message,
    ...fields,
  };
  process.stdout.write(JSON.stringify(record) + '\n');
}

export const logger: Logger = {
  info: (message, fields) => write('info', message, fields),
  error: (message, fields) => write('error', message, fields),
};
