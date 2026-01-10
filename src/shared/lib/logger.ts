export type LogContext = Record<string, unknown>;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LoggerOptions = {
  /**
   * Force logging even if the environment guard would normally silence it.
   */
  force?: boolean;
  /**
   * Keys to redact from the context payload (case-insensitive substring match).
   */
  redactKeys?: string[];
};

const defaultRedactKeys = ['token', 'secret', 'password', 'key', 'authorization', 'cookie'];

const safeGetLocalStorageFlag = (key: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const value = window.localStorage.getItem(key);
    return value === 'true' || value === '1';
  } catch {
    return false;
  }
};

const isDebugEnabled = (): boolean => {
  if (process.env.DEBUG_LOGS === 'true' || process.env.NEXT_PUBLIC_DEBUG_LOGS === 'true') {
    return true;
  }

  // Allow temporary enablement in the browser without a rebuild
  return safeGetLocalStorageFlag('pm-debug-logs');
};

const redactContext = (context?: LogContext, redactKeys: string[] = defaultRedactKeys) => {
  if (!context) return undefined;
  const lowered = redactKeys.map((k) => k.toLowerCase());
  const cleaned: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    const shouldRedact = lowered.some((needle) => key.toLowerCase().includes(needle));
    cleaned[key] = shouldRedact ? '[redacted]' : value;
  }
  return Object.keys(cleaned).length ? cleaned : undefined;
};

const shouldLog = (level: LogLevel, force?: boolean): boolean => {
  if (force) return true;
  if (level === 'error') return true;
  if (level === 'warn') return true;
  if (level === 'info') {
    return process.env.NODE_ENV !== 'production' || isDebugEnabled();
  }
  // debug
  return isDebugEnabled();
};

const buildPayload = (level: LogLevel, message: string, context?: LogContext, options?: LoggerOptions) => {
  const cleanedContext = redactContext(context, options?.redactKeys);
  return {
    level,
    message,
    ...(cleanedContext ? { context: cleanedContext } : {}),
  };
};

const writeLog = (
  level: LogLevel,
  message: string,
  context?: LogContext,
  options?: LoggerOptions,
) => {
  if (!shouldLog(level, options?.force)) return;
  const payload = buildPayload(level, message, context, options);

  switch (level) {
    case 'error':
      console.error(payload);
      break;
    case 'warn':
      console.warn(payload);
      break;
    case 'info':
      console.info(payload);
      break;
    default:
      console.debug(payload);
  }
};

export const logDebug = (message: string, context?: LogContext, options?: LoggerOptions) =>
  writeLog('debug', message, context, options);

export const logInfo = (message: string, context?: LogContext, options?: LoggerOptions) =>
  writeLog('info', message, context, options);

export const logWarn = (message: string, context?: LogContext, options?: LoggerOptions) =>
  writeLog('warn', message, context, options);

export const logError = (message: string, context?: LogContext, options?: LoggerOptions) =>
  writeLog('error', message, context, options);

export const debugToggleHint =
  'Enable debug logging by setting NEXT_PUBLIC_DEBUG_LOGS=true (build-time) or localStorage.setItem("pm-debug-logs","true").';

export const isDebugLoggingEnabled = isDebugEnabled;
