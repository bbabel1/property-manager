/**
 * Buildium Egress Guard for Edge Functions
 *
 * Monkey-patches globalThis.fetch to block direct Buildium API calls
 * unless the x-buildium-egress-allowed header is present.
 * This ensures all Buildium calls go through the approved wrapper (buildiumFetchEdge).
 */

const globalWithEgressGuard = globalThis as typeof globalThis & {
  __buildiumEgressGuardRegistered?: boolean;
};

if (!globalWithEgressGuard.__buildiumEgressGuardRegistered) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    // Parse URL
    let url: URL;
    if (typeof input === 'string') {
      url = new URL(input);
    } else if (input instanceof URL) {
      url = input;
    } else {
      url = new URL((input as Request).url);
    }

    // Check if URL is Buildium hostname
    const buildiumHostnames = ['api.buildium.com', 'apisandbox.buildium.com'];
    const isBuildium = buildiumHostnames.some((host) => url.hostname === host);

    if (isBuildium) {
      // Check for egress-allowed header
      const headers = init?.headers as HeadersInit | undefined;
      let headerMap: Headers;

      if (headers instanceof Headers) {
        headerMap = headers;
      } else if (Array.isArray(headers)) {
        headerMap = new Headers(headers);
      } else if (headers && typeof headers === 'object') {
        headerMap = new Headers(Object.entries(headers));
      } else {
        headerMap = new Headers();
      }

      const allowed = headerMap.get('x-buildium-egress-allowed') === '1';

      if (!allowed) {
        throw new Error(
          `Direct Buildium fetch blocked. Use buildiumFetchEdge() wrapper instead. URL: ${url.href}`,
        );
      }
    }

    return originalFetch.call(this, input, init);
  };

  globalWithEgressGuard.__buildiumEgressGuardRegistered = true;
}
