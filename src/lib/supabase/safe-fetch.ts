/**
 * Wraps fetch so network failures return a structured Response instead of throwing.
 * This prevents Supabase's internal request wrapper from logging noisy stack traces
 * while still surfacing a clear error payload to callers.
 */
export async function safeSupabaseFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  try {
    return await fetch(input as RequestInfo, init);
  } catch (error) {
    // Preserve abort semantics so callers can still handle cancellations
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }

    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as { url?: string })?.url ?? '[unknown]';

    console.warn('[supabase] fetch failed', {
      url,
      message: error instanceof Error ? error.message : String(error),
    });

    const body = JSON.stringify({
      error: 'NETWORK_ERROR',
      message: 'Unable to reach Supabase. Please check your connection and try again.',
      details: error instanceof Error ? error.message : String(error),
    });

    return new Response(body, {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }
}
