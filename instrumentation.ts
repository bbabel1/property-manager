// OpenTelemetry instrumentation hook for Next.js (Node runtime only)
// Starts the OTel Node SDK with OTLP HTTP exporter if configured.

export async function register() {
  // Skip in Edge Runtime - OpenTelemetry Node SDK is not compatible
  if (typeof EdgeRuntime !== 'undefined' || typeof process === 'undefined') {
    return;
  }

  try {
    // Skip if no endpoint configured
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    if (!endpoint) {
      // No collector configured; don't start SDK
      return;
    }

    // Dynamic imports to avoid bundling and allow app to run without deps
    // @ts-ignore - types may not be installed at dev time
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    // @ts-ignore
    const { Resource } = await import("@opentelemetry/resources");
    // @ts-ignore
    const { SemanticResourceAttributes } = await import(
      "@opentelemetry/semantic-conventions"
    );
    // @ts-ignore
    const { OTLPTraceExporter } = await import(
      "@opentelemetry/exporter-trace-otlp-http"
    );
    // @ts-ignore
    const { HttpInstrumentation } = await import(
      "@opentelemetry/instrumentation-http"
    );
    // @ts-ignore
    const { FetchInstrumentation } = await import(
      "@opentelemetry/instrumentation-fetch"
    );
    // @ts-ignore
    const { PgInstrumentation } = await import(
      "@opentelemetry/instrumentation-pg"
    );

    // Optional instrumentations - load separately and ignore if unavailable
    let undiciInstr: any | null = null;
    try {
      // @ts-ignore
      const mod = await import("@opentelemetry/instrumentation-undici");
      // @ts-ignore
      undiciInstr = new mod.UndiciInstrumentation();
    } catch (_) {
      // Undici instrumentation not available
    }

    let pinoInstr: any | null = null;
    try {
      // @ts-ignore
      const mod = await import("@opentelemetry/instrumentation-pino");
      // @ts-ignore
      pinoInstr = new mod.PinoInstrumentation();
    } catch (_) {
      // Pino instrumentation not available
    }

    const serviceName = process.env.OTEL_SERVICE_NAME || "property-manager";
    const serviceVersion =
      process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT || "dev";
    const environment = process.env.NODE_ENV || "development";

    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
    });

    const sdk = new NodeSDK({
      resource,
      traceExporter: new OTLPTraceExporter({
        // Expect base endpoint without trailing slash; append /v1/traces
        url: `${endpoint.replace(/\/+$/, "")}/v1/traces`,
        headers: parseHeaderPairs(process.env.OTEL_EXPORTER_OTLP_HEADERS),
      }),
      instrumentations: [
        new HttpInstrumentation(),
        new FetchInstrumentation(),
        new PgInstrumentation(),
        // Only include optional instrumentations if they loaded successfully
        ...(undiciInstr ? [undiciInstr] : []),
        ...(pinoInstr ? [pinoInstr] : []),
      ],
    });

    await sdk.start();

    // Graceful shutdown on process exit signals
    const shutdown = async () => {
      try {
        await sdk.shutdown();
      } catch {
        // ignore
      }
    };
    // Avoid direct `process.*` access to keep Edge compile happy
    const proc: any = (globalThis as any).process;
    if (proc?.once) {
      proc.once("beforeExit", shutdown);
      proc.once("SIGTERM", shutdown);
      proc.once("SIGINT", shutdown);
    }
  } catch (err) {
    // Swallow to avoid breaking app startup if OTel packages are missing
    // eslint-disable-next-line no-console
    console.warn("OpenTelemetry init skipped:", (err as any)?.message || err);
  }
}

function parseHeaderPairs(input?: string) {
  if (!input) return {} as Record<string, string>;
  const out: Record<string, string> = {};
  for (const pair of input.split(",")) {
    const [k, ...rest] = pair.split("=");
    const key = k?.trim();
    if (!key) continue;
    out[key] = rest.join("=").trim();
  }
  return out;
}
