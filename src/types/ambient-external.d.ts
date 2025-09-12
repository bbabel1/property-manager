// Ambient module declarations to satisfy tsc when optional deps are not installed
declare module '@radix-ui/react-context-menu' {
  const anyExport: any
  export = anyExport
}
declare module '@radix-ui/react-menubar' {
  const anyExport: any
  export = anyExport
}
declare module '@radix-ui/react-navigation-menu' {
  const anyExport: any
  export = anyExport
}
declare module '@opentelemetry/exporter-trace-otlp-http' {
  export const OTLPTraceExporter: any
}
declare module '@opentelemetry/instrumentation-fetch' {
  export const FetchInstrumentation: any
}
