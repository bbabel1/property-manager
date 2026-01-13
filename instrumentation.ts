// OpenTelemetry instrumentation for Next.js (Node runtime)
// Enabled when OTEL_ENABLED=1 (and optional OTLP endpoint is provided)

import type * as Http from 'node:http';
import type * as Https from 'node:https';
import { createRequire } from 'node:module';

const globalWithTelemetryFlags = globalThis as typeof globalThis & {
  __otelShutdownHookRegistered?: boolean;
  __buildiumEgressGuardRegistered?: boolean;
};

// Use createRequire to obtain a mutable CommonJS module object; ESM namespace objects are read-only.
const require = createRequire(import.meta.url);
const httpModule = require('node:http') as typeof import('node:http');
const httpsModule = require('node:https') as typeof import('node:https');

const BUILDIUM_HOSTNAMES = new Set(['api.buildium.com', 'apisandbox.buildium.com']);

function normalizeHostname(host?: string | null): string | null {
  if (!host) return null;
  return host.split(':')[0].toLowerCase();
}

function hasEgressHeader(headers: unknown): boolean {
  if (!headers || typeof headers !== 'object') return false;
  // Node lower-cases header keys in practice, but check both to be safe.
  const record = headers as Record<string, unknown>;
  const value = record['x-buildium-egress-allowed'] ?? record['X-Buildium-Egress-Allowed'];
  if (value === undefined) return false;
  if (Array.isArray(value)) {
    return value.some((v) => String(v) === '1');
  }
  return String(value) === '1';
}

function shouldBlockBuildiumEgress(hostname: string | null, headers: unknown): boolean {
  if (!hostname) return false;
  return BUILDIUM_HOSTNAMES.has(hostname) && !hasEgressHeader(headers);
}

function wrapHttpRequest<T extends (...args: any[]) => any>(
  original: T,
  moduleName: 'http' | 'https',
): T {
  const wrapped = function (...args: any[]) {
    // request(url[, options][, callback]) or request(options[, callback])
    let hostname: string | null = null;
    let headers: unknown;

    if (typeof args[0] === 'string') {
      try {
        const url = new URL(args[0]);
        hostname = normalizeHostname(url.hostname);
      } catch {
        // ignore parse failures; fall through
      }
      headers = args[1]?.headers ?? args[0]?.headers;
    } else if (args[0] instanceof URL) {
      hostname = normalizeHostname(args[0].hostname);
      headers = args[1]?.headers ?? args[0]?.headers;
    } else if (args[0] && typeof args[0] === 'object') {
      hostname = normalizeHostname(
        (args[0] as any).hostname || (args[0] as any).host || (args[0] as any).Host,
      );
      headers = (args[0] as any).headers;
    }

    if (shouldBlockBuildiumEgress(hostname, headers)) {
      throw new Error(
        `Direct Buildium ${moduleName} request blocked. Use buildiumFetch() wrapper with x-buildium-egress-allowed header. Host: ${hostname}`,
      );
    }

    return original.apply(this, args);
  };

  return wrapped as T;
}

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
    const hostname = normalizeHostname(url.hostname);
    const isBuildium = hostname ? BUILDIUM_HOSTNAMES.has(hostname) : false;

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

  // Also guard lower-level http/https.request to block axios/undici/Raw HTTP bypasses.
  (httpModule as any).request = wrapHttpRequest(httpModule.request, 'http');
  (httpModule as any).get = function (...args: any[]) {
    const req = (httpModule as any).request(...args);
    req.end();
    return req;
  };
  (httpsModule as any).request = wrapHttpRequest(httpsModule.request, 'https');
  (httpsModule as any).get = function (...args: any[]) {
    const req = (httpsModule as any).request(...args);
    req.end();
    return req;
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
