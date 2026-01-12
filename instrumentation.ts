// OpenTelemetry instrumentation for Next.js (Node runtime)
// Enabled when OTEL_ENABLED=1 (and optional OTLP endpoint is provided)

const globalWithTelemetryFlags = globalThis as typeof globalThis & {
  __otelShutdownHookRegistered?: boolean;
  __buildiumEgressGuardRegistered?: boolean;
};

/**
 * Register Buildium egress guard
 *
 * Monkey-patches globalThis.fetch to block direct Buildium API calls
 * unless the x-buildium-egress-allowed header is present.
 * This ensures all Buildium calls go through the approved wrapper (buildiumFetch).
 */
function registerBuildiumEgressGuard() {
  if (globalWithTelemetryFlags.__buildiumEgressGuardRegistered) {
    return;
  }

  const nodeProcess =
    typeof globalThis === 'object' ? (globalThis.process as NodeJS.Process | undefined) : undefined;
  const isNodeRuntime = Boolean(nodeProcess?.versions?.node);
  if (!isNodeRuntime) return;

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
      url = new URL(input.url);
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
          `Direct Buildium fetch blocked. Use buildiumFetch() wrapper instead. URL: ${url.href}`,
        );
      }
    }

    return originalFetch.call(this, input, init);
  };

  globalWithTelemetryFlags.__buildiumEgressGuardRegistered = true;
}

export async function register() {
  // Register Buildium egress guard first (always, regardless of OTEL)
  registerBuildiumEgressGuard();

  try {
    const nodeProcess =
      typeof globalThis === 'object'
        ? (globalThis.process as NodeJS.Process | undefined)
        : undefined;
    const isNodeRuntime = Boolean(nodeProcess?.versions?.node);
    if (!isNodeRuntime) return;

    const enabled = String(nodeProcess?.env?.OTEL_ENABLED || '').toLowerCase();
    const isEnabled = enabled === '1' || enabled === 'true';
    if (!isEnabled) return;

    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { Resource } = await import('@opentelemetry/resources');
    const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { FetchInstrumentation } = await import('@opentelemetry/instrumentation-fetch');
    const { HttpInstrumentation } = await import('@opentelemetry/instrumentation-http');
    const { PgInstrumentation } = await import('@opentelemetry/instrumentation-pg');
    const { PinoInstrumentation } = await import('@opentelemetry/instrumentation-pino');

    const serviceName = nodeProcess?.env?.OTEL_SERVICE_NAME || 'property-manager';
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
        nodeProcess?.env?.NODE_ENV || 'development',
    });

    const endpoint = nodeProcess?.env?.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (!endpoint) {
      // If no endpoint is configured, skip startup to avoid runtime errors
      // Set OTEL_EXPORTER_OTLP_ENDPOINT to something like http://localhost:4318/v1/traces
      return;
    }

    const traceExporter = new OTLPTraceExporter({ url: endpoint });

    const sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations: [
        new FetchInstrumentation({}),
        new HttpInstrumentation({}),
        new PgInstrumentation({}),
        new PinoInstrumentation({}),
      ],
    });

    await sdk.start();

    if (
      typeof nodeProcess?.on === 'function' &&
      !globalWithTelemetryFlags.__otelShutdownHookRegistered
    ) {
      globalWithTelemetryFlags.__otelShutdownHookRegistered = true;
      const shutdown = () => {
        void sdk.shutdown();
      };
      nodeProcess.once('SIGTERM', shutdown);
      nodeProcess.once('SIGINT', shutdown);
    }
  } catch (e) {
    // Never block startup due to telemetry errors
    console.warn('[otel] instrumentation init skipped:', (e as Error)?.message);
  }
}
