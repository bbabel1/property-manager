type NormalizedAddressInput = {
  addressLine1?: string | null
  streetNumber?: string | null
  route?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
  country?: string | null
  borough?: string | null
}

export type NormalizedAddressResult = {
  normalizedStreetLine1: string | null
  normalizedStreetNameOnly: string | null
  normalizedCity: string | null
  normalizedState: string | null
  normalizedPostalCode: string | null
  normalizedCountry: string | null
  normalizedBorough?: string | null
  normalizedAddressKey: string | null
}

const NYC_BOROUGHS = new Set(['MANHATTAN', 'BROOKLYN', 'QUEENS', 'BRONX', 'STATEN ISLAND'])

function normalizeToken(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).replace(/\./g, ' ').trim().toUpperCase()
  if (!str) return null
  return str.replace(/\s+/g, ' ')
}

function splitHouseAndStreet(address: string | null | undefined): { houseNumber: string | null; street: string | null } {
  const raw = normalizeToken(address)
  if (!raw) return { houseNumber: null, street: null }
  const match = raw.match(/^([0-9A-Z-]+)\s+(.*)$/)
  if (match?.[1] && match?.[2]) {
    return { houseNumber: match[1].trim(), street: match[2].trim() }
  }
  return { houseNumber: null, street: raw }
}

function normalizeAddressParts(input: NormalizedAddressInput) {
  const houseNumber = normalizeToken(input.streetNumber) || splitHouseAndStreet(input.addressLine1).houseNumber
  const routeOnly =
    normalizeToken(input.route) || splitHouseAndStreet(input.addressLine1).street || null
  const city = normalizeToken(input.city)
  const state = normalizeToken(input.state)
  const postalCode = normalizeToken(input.postalCode)
  const country = normalizeToken(input.country)
  const borough = normalizeToken(input.borough)

  const streetLine1 = houseNumber && routeOnly ? `${houseNumber} ${routeOnly}` : routeOnly

  return {
    houseNumber,
    routeOnly,
    streetLine1: streetLine1 ? normalizeToken(streetLine1) : null,
    city,
    state,
    postalCode,
    country,
    borough,
  }
}

function isNYC(borough: string | null, city: string | null, state: string | null): boolean {
  if (borough && NYC_BOROUGHS.has(borough)) return true
  return city === 'NEW YORK' && state === 'NY'
}

export function buildNormalizedAddressKey(input: NormalizedAddressInput): NormalizedAddressResult | null {
  const parts = normalizeAddressParts(input)

  const normalizedBorough = parts.borough && NYC_BOROUGHS.has(parts.borough) ? parts.borough : null
  const nyc = isNYC(normalizedBorough, parts.city, parts.state)

  if (!parts.streetLine1 && !(parts.houseNumber && parts.routeOnly)) {
    return null
  }

  if (!parts.country && !nyc) {
    return null
  }

  let normalizedAddressKey: string | null = null

  if (nyc) {
    const keyParts = ['NYC', normalizedBorough, parts.houseNumber, parts.routeOnly, parts.postalCode]
    if (keyParts.every((p) => p && String(p).length > 0)) {
      normalizedAddressKey = keyParts.join('|')
    }
  } else {
    const keyParts = [parts.country, parts.state, parts.city, parts.postalCode, parts.streetLine1]
    if (keyParts.every((p) => p && String(p).length > 0)) {
      normalizedAddressKey = keyParts.join('|')
    }
  }

  return {
    normalizedStreetLine1: parts.streetLine1,
    normalizedStreetNameOnly: parts.routeOnly,
    normalizedCity: parts.city,
    normalizedState: parts.state,
    normalizedPostalCode: parts.postalCode,
    normalizedCountry: parts.country,
    normalizedBorough,
    normalizedAddressKey,
  }
}
