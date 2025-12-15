import crypto from 'crypto'

// Stable stringify that sorts object keys recursively so that semantically
// identical payloads produce the same string (and hash), independent of
// property insertion order or whitespace.
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value))
}

function sortDeep(input: unknown): unknown {
  if (Array.isArray(input)) return input.map(sortDeep)
  if (input && typeof input === 'object') {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(input).sort()) {
      out[key] = sortDeep((input as Record<string, unknown>)[key])
    }
    return out
  }
  return input
}

export function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export function hashObject(obj: unknown): string {
  return sha256Hex(stableStringify(obj))
}
