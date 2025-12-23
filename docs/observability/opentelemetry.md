OpenTelemetry Tracing Setup

Overview

- This project initializes OpenTelemetry in `instrumentation.ts` and exports traces via OTLP HTTP.
- Incoming API requests, outgoing HTTP/fetch calls, pg (if used), and pino logs are instrumented.

Install Packages

```bash
npm install \
  @opentelemetry/sdk-node \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/instrumentation-http \
  @opentelemetry/instrumentation-undici \
  @opentelemetry/instrumentation-fetch \
  @opentelemetry/instrumentation-pg \
  @opentelemetry/instrumentation-pino
```

Environment Variables

- `OTEL_EXPORTER_OTLP_ENDPOINT` (required): Base OTLP endpoint, e.g. `https://collector.example.com`
- `OTEL_EXPORTER_OTLP_HEADERS` (optional): Comma-separated key=value pairs, e.g. `authorization=Bearer xxx`
- `OTEL_SERVICE_NAME` (optional): Defaults to `property-manager`
- `GIT_COMMIT` (optional): Service version; Vercel commit SHA is used if present

What’s already wired

- `next.config.ts` enables the Next.js instrumentation hook.
- `instrumentation.ts` starts the NodeSDK if `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
- `src/app/api/webhooks/buildium/route.ts` forwards `traceparent`/`tracestate` to Supabase Edge Functions for distributed traces.

Verify

1. Export env vars and start dev: `OTEL_EXPORTER_OTLP_ENDPOINT=... npm run dev`
2. Hit any endpoint under `/api/*` and look for spans in your tracing backend.
3. You should see incoming HTTP server spans and outgoing fetch/undici spans to Supabase/Edge Functions.

Notes

- If the packages aren’t installed, the app still runs; OTel init is skipped safely.
- Client-side tracing is not enabled; start with server traces for API and backend calls.
