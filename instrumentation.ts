// OpenTelemetry instrumentation for Next.js (Node runtime)
// Enabled when OTEL_ENABLED=1 (and optional OTLP endpoint is provided)

export async function register() {
  try {
    const nodeProcess = typeof globalThis === 'object' ? (globalThis.process as NodeJS.Process | undefined) : undefined
    const isNodeRuntime = Boolean(nodeProcess?.versions?.node)
    if (!isNodeRuntime) return

    const enabled = String(nodeProcess?.env?.OTEL_ENABLED || '').toLowerCase()
    const isEnabled = enabled === '1' || enabled === 'true'
    if (!isEnabled) return

    const { NodeSDK } = await import('@opentelemetry/sdk-node')
    const { Resource } = await import('@opentelemetry/resources')
    const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions')
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http')
    const { FetchInstrumentation } = await import('@opentelemetry/instrumentation-fetch')
    const { HttpInstrumentation } = await import('@opentelemetry/instrumentation-http')
    const { PgInstrumentation } = await import('@opentelemetry/instrumentation-pg')
    const { PinoInstrumentation } = await import('@opentelemetry/instrumentation-pino')

    const serviceName = nodeProcess?.env?.OTEL_SERVICE_NAME || 'property-manager'
    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: nodeProcess?.env?.NODE_ENV || 'development',
    })

    const endpoint = nodeProcess?.env?.OTEL_EXPORTER_OTLP_ENDPOINT
    if (!endpoint) {
      // If no endpoint is configured, skip startup to avoid runtime errors
      // Set OTEL_EXPORTER_OTLP_ENDPOINT to something like http://localhost:4318/v1/traces
      return
    }

    const traceExporter = new OTLPTraceExporter({ url: endpoint })

    const sdk = new NodeSDK({
      resource,
      traceExporter,
      instrumentations: [
        new FetchInstrumentation({}),
        new HttpInstrumentation({}),
        new PgInstrumentation({}),
        new PinoInstrumentation({}) as any,
      ],
    })

    await sdk.start()

    if (typeof nodeProcess?.on === 'function') {
      nodeProcess.on('SIGTERM', () => {
        void sdk.shutdown()
      })
      nodeProcess.on('SIGINT', () => {
        void sdk.shutdown()
      })
    }
  } catch (e) {
    // Never block startup due to telemetry errors
    console.warn('[otel] instrumentation init skipped:', (e as Error)?.message)
  }
}
