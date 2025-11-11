export function describeBuildiumPayload(payload: unknown): string | null {
  if (!payload) return null;
  if (typeof payload === 'string') return payload;
  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const message =
      typeof record.Message === 'string'
        ? (record.Message as string)
        : typeof record.message === 'string'
          ? (record.message as string)
          : null;
    if (message) return message;
    const errors = record.Errors;
    if (Array.isArray(errors)) {
      const combined = errors
        .map((err) => {
          if (typeof err === 'object' && err !== null) {
            const errRecord = err as Record<string, unknown>;
            if (typeof errRecord.Message === 'string') return errRecord.Message as string;
            if (typeof errRecord.message === 'string') return errRecord.message as string;
          }
          return null;
        })
        .filter((entry): entry is string => Boolean(entry));
      if (combined.length) return combined.join('; ');
    }
    try {
      return JSON.stringify(payload);
    } catch {
      return null;
    }
  }
  return String(payload);
}

export function summarizeBuildiumResponse(
  buildium: { status?: number; payload?: unknown } | null | undefined,
): string {
  const message = describeBuildiumPayload(buildium?.payload);
  const statusText =
    typeof buildium?.status === 'number' ? ` (status ${buildium.status})` : '';
  if (message) return `${message}${statusText}`;
  if (typeof buildium?.status === 'number') return `Status ${buildium.status}`;
  return 'No response details from Buildium';
}
