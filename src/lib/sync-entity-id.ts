type EntityIdInput = string | number

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const NUMERIC_UUID_PREFIX = '00000000-0000-4000-8000-'

export function normalizeSyncEntityId(entityId: EntityIdInput, context?: string): string {
  const raw = String(entityId ?? '').trim()
  if (!raw) {
    throw new Error(`Missing entity id${context ? ` for ${context}` : ''}`)
  }

  if (UUID_REGEX.test(raw)) {
    return raw
  }

  if (/^\d+$/.test(raw)) {
    const suffixHex = BigInt(raw).toString(16)
    const padded = suffixHex.length > 12 ? suffixHex.slice(-12) : suffixHex.padStart(12, '0')
    return `${NUMERIC_UUID_PREFIX}${padded}`
  }

  throw new Error(`Unable to normalize sync entity id: ${raw}`)
}

export function denormalizeSyncEntityId(storedId: string): string {
  if (storedId?.startsWith(NUMERIC_UUID_PREFIX)) {
    const suffix = storedId.slice(NUMERIC_UUID_PREFIX.length)
    try {
      return BigInt(`0x${suffix}`).toString(10)
    } catch {
      return storedId
    }
  }
  return storedId
}
