export type LogContext = Record<string, unknown>;

type LogLevel = 'info' | 'warn' | 'error';

const buildPayload = (level: LogLevel, message: string, context?: LogContext) => {
  const cleanedContext = context && Object.keys(context).length > 0 ? context : undefined;

  return {
    level,
    message,
    ...(cleanedContext ? { context: cleanedContext } : {}),
  };
};

const writeLog = (level: LogLevel, message: string, context?: LogContext) => {
  const payload = buildPayload(level, message, context);

  if (level === 'error') {
    console.error(payload);
    return;
  }

  if (level === 'warn') {
    console.warn(payload);
    return;
  }

  console.info(payload);
};

export const logInfo = (message: string, context?: LogContext) => writeLog('info', message, context);

export const logWarn = (message: string, context?: LogContext) => writeLog('warn', message, context);

export const logError = (message: string, context?: LogContext) => writeLog('error', message, context);
