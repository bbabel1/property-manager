import { performance } from 'node:perf_hooks';

const SHOULD_LOG =
  process.env.MONTHLY_LOG_TRACE === '1' ||
  process.env.TRACE_MONTHLY_LOGS === '1' ||
  process.env.NODE_ENV === 'development';

export async function traceAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    if (SHOULD_LOG) {
      const duration = performance.now() - start;
      console.info(`[perf] ${name} ${duration.toFixed(1)}ms`);
    }
  }
}
