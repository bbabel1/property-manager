Centralized Logging

Goals
- Emit structured JSON logs that can be shipped to any log platform (stdout-first).
- Include request context (request id, path, method) and trace context for correlation.

What’s Implemented
- Base logger (`pino`) with env-configurable level and pretty output in dev:
  - src/lib/logger.ts:1
- Request-scoped logger with correlation + W3C trace headers:
  - src/lib/logging.ts:1
- Webhook route wired to request logger (example usage):
  - src/app/api/webhooks/buildium/route.ts:1

Usage
- In any API route handler:
  ```ts
  import { createRequestLogger } from '@/lib/logging'
  export async function GET(req: NextRequest) {
    const log = createRequestLogger(req, 'my-endpoint')
    log.info({ msg: 'start' })
    // ... your logic
    log.info({ status: 200, ms: 12 }, 'success')
    return NextResponse.json({ ok: true })
  }
  ```

Environment
- `LOG_LEVEL` (optional): fatal|error|warn|info|debug|trace. Defaults to `info` in prod, `debug` in dev.
- Prefer writing logs to stdout in production; your hosting should collect and ship.

Shipping Logs to a Platform
- Most hosts (Vercel, Fly, Render, AWS) capture stdout/stderr and let you stream/forward logs.
- If you need to forward from the app, add a transport when you pick a provider (e.g., Datadog, Logtail, OpenObserve) and wire it into `src/lib/logger.ts`.
- OpenTelemetry users: pino logs include trace headers; use your collector to correlate logs with traces.

Next Steps (optional)
- Add an HTTP access log wrapper to consistently log duration and status for all endpoints.
- Add redaction rules for secrets/PII if needed.

