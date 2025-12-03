import { parse } from 'url';

const FALLBACK_PATH = '/dashboard';

export function resolvePostAuthRedirect(input?: string | null): string {
  if (!input) {
    return FALLBACK_PATH;
  }

  const trimmed = input.trim();
  if (trimmed === '') {
    return FALLBACK_PATH;
  }

  if (!trimmed.startsWith('/')) {
    return FALLBACK_PATH;
  }

  if (trimmed.startsWith('//')) {
    return FALLBACK_PATH;
  }

  // Prevent absolute URLs sneaking through via protocol-relative or encoded values
  const parsed = parse(trimmed, false, true);
  if (parsed.host || parsed.protocol) {
    return FALLBACK_PATH;
  }

  return trimmed;
}

export function buildOAuthRedirectUrl(origin: string, next?: string | null): string {
  const safeNext = resolvePostAuthRedirect(next);
  const sanitizedOrigin = origin?.trim() || '';

  if (!sanitizedOrigin) {
    throw new Error('OAuth redirect requires a valid origin');
  }

  const url = new URL('/auth/callback', sanitizedOrigin);
  if (safeNext && safeNext !== FALLBACK_PATH) {
    url.searchParams.set('next', safeNext);
  }

  return url.toString();
}








