// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Deno globals for Edge runtime (see https://typescript-eslint.io/rules/triple-slash-reference/)
/// <reference path="../../../types/deno.d.ts" />
// deno-lint-ignore-file
const encoder = new TextEncoder()
const DEFAULT_TIMESTAMP_WINDOW_MS = 5 * 60 * 1000
const defaultReplayCache = new Map<string, number>()

export type SignatureVerificationResult =
  | { ok: true; timestamp: number; signature: string }
  | { ok: false; status: number; reason: string; signature?: string | null; timestamp?: number | null }

export interface SignatureVerificationOptions {
  secret?: string | null
  timestampWindowMs?: number
  replayCache?: Map<string, number>
  now?: number
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16)
  }
  return bytes
}

async function computeHmac(payload: string, secret: string): Promise<{ hex: string; base64: string }> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  const bytes = new Uint8Array(signature)
  return { hex: bytesToHex(bytes), base64: bytesToBase64(bytes) }
}

function maybeDecodeBase64Secret(secret: string): string {
  try {
    if (/^[A-Za-z0-9+/]+=*$/.test(secret) && secret.length % 4 === 0) {
      const decoded = atob(secret)
      if (decoded) return decoded
    }
  } catch {
    // Ignore decode errors and fall back to the original secret.
  }
  return secret
}

function normalizeTimestamp(value: string | null): number | null {
  if (!value) return null
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  // Support seconds or milliseconds.
  return num < 1_000_000_000_000 ? num * 1000 : num
}

function pruneReplayCache(cache: Map<string, number>, now: number, windowMs: number) {
  for (const [key, seenAt] of cache.entries()) {
    if (now - seenAt > windowMs * 2) cache.delete(key)
  }
}

export async function signBuildiumPayload(rawBody: string, secret: string, timestamp: string): Promise<string> {
  const { base64 } = await computeHmac(`${timestamp}.${rawBody}`, secret)
  return base64
}

export async function verifyBuildiumSignature(
  headers: Headers,
  rawBody: string,
  options?: SignatureVerificationOptions
): Promise<SignatureVerificationResult> {
  const signature =
    headers.get('x-buildium-signature') ||
    headers.get('buildium-webhook-signature') ||
    headers.get('x-buildium-webhook-signature')

  const timestampHeader =
    headers.get('buildium-webhook-timestamp') ||
    headers.get('x-buildium-timestamp') ||
    headers.get('x-buildium-webhook-timestamp')

  const secret = (options?.secret ?? Deno.env.get('BUILDIUM_WEBHOOK_SECRET') ?? '').trim()
  const timestampWindowMs = options?.timestampWindowMs ?? DEFAULT_TIMESTAMP_WINDOW_MS
  const now = options?.now ?? Date.now()
  const cache = options?.replayCache ?? defaultReplayCache

  if (!secret) {
    return { ok: false, status: 401, reason: 'missing-secret', signature, timestamp: null }
  }

  if (!signature) {
    return { ok: false, status: 401, reason: 'missing-signature', signature, timestamp: normalizeTimestamp(timestampHeader) }
  }

  if (!timestampHeader) {
    return { ok: false, status: 401, reason: 'missing-timestamp', signature, timestamp: null }
  }

  const timestamp = normalizeTimestamp(timestampHeader)
  if (timestamp === null) {
    return { ok: false, status: 401, reason: 'invalid-timestamp', signature, timestamp }
  }

  if (Math.abs(now - timestamp) > timestampWindowMs) {
    return { ok: false, status: 401, reason: 'timestamp-out-of-window', signature, timestamp }
  }

  try {
    const signingSecret = maybeDecodeBase64Secret(secret)
    const payloadToSign = `${timestampHeader}.${rawBody}`
    const primary = await computeHmac(payloadToSign, signingSecret)
    const alt = signingSecret !== secret ? await computeHmac(payloadToSign, secret) : null
    const normalizedSignature = signature.replace(/^(sha256=|sha1=)/i, '')

    const expected = new Set<string>([
      primary.base64,
      primary.hex,
      bytesToBase64(hexToBytes(primary.hex)),
    ])

    if (alt) {
      expected.add(alt.base64)
      expected.add(alt.hex)
      expected.add(bytesToBase64(hexToBytes(alt.hex)))
    }

    const matches = [signature, normalizedSignature].some((candidate) => expected.has(candidate))
    if (!matches) {
      return { ok: false, status: 401, reason: 'invalid-signature', signature, timestamp }
    }

    const replayKey = `${timestampHeader}:${normalizedSignature}`
    const seenAt = cache.get(replayKey)
    if (seenAt && now - seenAt < timestampWindowMs) {
      return { ok: false, status: 401, reason: 'replayed-signature', signature: normalizedSignature, timestamp }
    }

    cache.set(replayKey, now)
    pruneReplayCache(cache, now, timestampWindowMs)
    return { ok: true, timestamp, signature: normalizedSignature }
  } catch {
    return { ok: false, status: 401, reason: 'hmac-error', signature, timestamp }
  }
}
