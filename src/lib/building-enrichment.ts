import type { Database, Json } from '@/types/database';
import { supabase, supabaseAdmin, type TypedSupabaseClient } from './db';
import { logger } from './logger';
import { buildNormalizedAddressKey } from './normalized-address';
import { DEFAULT_DATASET_IDS } from './nyc-open-data/config-manager';

type BuildingRow = Database['public']['Tables']['buildings']['Row'];
type BuildingInsert = Database['public']['Tables']['buildings']['Insert'];

type FetchJSONOptions = {
  headers?: Record<string, string>;
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  description?: string;
};

type AddressEnrichmentInput = {
  addressLine1: string;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  borough?: string | number | null;
  neighborhood?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  normalizedAddressKey?: string | null;
  bin?: string | null;
  bbl?: string | null;
  block?: string | null;
  lot?: string | null;
};

type EnrichmentOptions = {
  db?: TypedSupabaseClient;
  skipCache?: boolean;
  now?: string;
  normalizedAddressKey?: string | null;
  binOverride?: string | null;
  bblOverride?: string | null;
  blockOverride?: string | null;
  lotOverride?: string | null;
};

type EnrichmentResult = {
  building: BuildingRow | null;
  propertyPatch: Record<string, unknown>;
  errors: string[];
};

type GeoserviceResult = {
  bbl: string | null;
  block: string | null;
  lot: string | null;
  bin: string | null;
  condo_num: string | null;
  coop_num: string | null;
  tax_map: string | null;
  tax_section: string | null;
  tax_volume: string | null;
  ease_digit: string | null;
  parid: string | null;
  raw: Record<string, unknown> | null;
};

type HpdBuildingResult = {
  data: Record<string, unknown> | null;
  raw: Record<string, unknown> | null;
  registrationId: string | null;
  latitude: number | null;
  longitude: number | null;
  buildingId: number | null;
};

type NtaResult = {
  ntaname: string | null;
  ntacode: string | null;
  geometry_match: boolean;
  source: string;
};

const DEFAULT_GEOSERVICE_BASE =
  process.env.NYC_GEOSERVICE_BASE_URL || 'https://api.nyc.gov/geoclient/v2/';
const DEFAULT_OPEN_DATA_BASE =
  process.env.NYC_OPEN_DATA_BASE_URL || 'https://data.cityofnewyork.us/';
const GEOSERVICE_SUBSCRIPTION_KEY =
  process.env.NYC_GEOSERVICE_API_KEY || process.env.NYC_GEOSERVICE_KEY;
const OPEN_DATA_APP_TOKEN =
  process.env.NYC_OPEN_DATA_APP_TOKEN || process.env.NYC_OPEN_DATA_API_KEY;

const SENTINELS = new Set(['n/a', 'na', 'null', 'none', 'undefined', '']);
type UnknownRecord = Record<string, unknown>;

const BOROUGH_CODES: Record<string, string> = {
  manhattan: '1',
  'new york': '1',
  nyc: '1',
  bronx: '2',
  brooklyn: '3',
  kings: '3',
  queens: '4',
  'staten island': '5',
  richmond: '5',
};

const BOROUGH_NAMES: Record<string, string> = {
  '1': 'Manhattan',
  '2': 'Bronx',
  '3': 'Brooklyn',
  '4': 'Queens',
  '5': 'Staten Island',
};

const HPD_REGISTRATION_DATASET_ID = DEFAULT_DATASET_IDS.hpdRegistrations;
const HPD_BUILDINGS_DATASET_ID = DEFAULT_DATASET_IDS.buildingsSubjectToHPD;
const HPD_REGISTRATION_COLUMNS = [
  'registrationid',
  'buildingid',
  'boroid',
  'boro',
  'housenumber',
  'lowhousenumber',
  'highhousenumber',
  'streetname',
  'streetcode',
  'zip',
  'block',
  'lot',
  'bin',
  'communityboard',
  'lastregistrationdate',
  'registrationenddate',
] as const;

function isNYCBoroughCode(code: string | null | undefined): code is string {
  return Boolean(code && ['1', '2', '3', '4', '5'].includes(code));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      next[key] = value;
    }
  }
  return next as T;
}

function normalizeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (SENTINELS.has(str.toLowerCase())) return null;
  return str;
}

function normalizeNumber(value: unknown): number | null {
  const str = normalizeValue(value);
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function normalizeZip(value: unknown): string | null {
  const str = normalizeValue(value);
  if (!str) return null;
  const match = str.match(/\d{5}/);
  return match ? match[0] : str;
}

function normalizeStreetName(value: string): string {
  const str = normalizeValue(value);
  if (!str) return '';
  const tokens = str.split(/\s+/).map((token) => {
    const ordinal = token.match(/^(\d+)(st|nd|rd|th)$/i);
    if (ordinal?.[1]) return ordinal[1];
    if (/^[NSEW]$/i.test(token)) return token.toUpperCase();
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  });
  return tokens.join(' ').trim();
}

function splitHouseAndStreet(address: string): { houseNumber: string; streetName: string } {
  const str = normalizeValue(address) || '';
  const match = str.match(/^([\w-]+)\s+(.*)$/);
  if (match?.[1] && match?.[2]) {
    return { houseNumber: match[1].trim(), streetName: match[2].trim() };
  }
  return { houseNumber: '', streetName: str.trim() };
}

function normalizeBoroughCode(input: string | number | null | undefined): string | null {
  if (input === null || input === undefined) return null;
  const str = String(input).trim();
  if (!str) return null;
  if (/^[1-5]$/.test(str)) return str;
  const name = str.toLowerCase();
  return BOROUGH_CODES[name] || null;
}

function boroughNameFromCode(code: string | null): string | null {
  if (!code) return null;
  return BOROUGH_NAMES[code] || null;
}

function digitsOnly(value: string | null | undefined): string | null {
  const str = normalizeValue(value);
  if (!str) return null;
  const digits = str.replace(/\D+/g, '');
  return digits || null;
}

function asRecord(value: unknown): UnknownRecord | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return null;
}

function getRecordValue(record: UnknownRecord | null, key: string): unknown {
  return record ? record[key] : null;
}

function getRecordString(record: UnknownRecord | null, key: string): string | null {
  return normalizeValue(getRecordValue(record, key));
}

function getRecordDigits(record: UnknownRecord | null, key: string): string | null {
  const value = getRecordValue(record, key);
  if (typeof value === 'string' || typeof value === 'number') {
    return digitsOnly(String(value));
  }
  return digitsOnly(null);
}

export function computeParid(bbl: string | null | undefined, ease: unknown): string | null {
  const base = digitsOnly(bbl);
  if (!base) return null;
  const easeDigit = (String(ease ?? '0') || '0').trim().charAt(0) || '0';
  const digit = /\d/.test(easeDigit) ? easeDigit : '0';
  const parid = `${base}${digit}`;
  if (!/^\d+$/.test(parid)) {
    throw new Error('PARID must be numeric');
  }
  if (parid.length !== base.length + 1) {
    throw new Error('PARID length mismatch');
  }
  return parid;
}

async function fetchJSON<T>(url: string, options: FetchJSONOptions = {}): Promise<T> {
  const { headers = {}, retries = 2, retryDelayMs = 600, timeoutMs = 12000, description } = options;
  const mergedHeaders = {
    Accept: 'application/json',
    ...headers,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: mergedHeaders,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${response.statusText} ${text}`.trim());
      }
      const data = await response.json();
      return data as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      const label = description || url;
      throw new Error(`${label} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Unknown fetch error');
}

async function fetchGeoserviceData(params: {
  houseNumber: string;
  streetName: string;
  boroughCode: string;
  zipCode?: string | null;
  subscriptionKey?: string | null;
  baseUrl?: string | null;
}): Promise<GeoserviceResult> {
  const base = params.baseUrl || DEFAULT_GEOSERVICE_BASE;
  const url = new URL('address.json', base.endsWith('/') ? base : `${base}/`);
  url.searchParams.set('houseNumber', params.houseNumber);
  url.searchParams.set('street', params.streetName);
  url.searchParams.set('borough', params.boroughCode);
  if (params.zipCode) url.searchParams.set('zip', params.zipCode);

  const raw = await fetchJSON<Record<string, unknown>>(url.toString(), {
    description: 'NYC Geoclient v2 address lookup',
    headers: params.subscriptionKey
      ? { 'Ocp-Apim-Subscription-Key': params.subscriptionKey, key: params.subscriptionKey }
      : undefined,
  });

  const rawRecord = asRecord(raw) || {};
  const address = asRecord(rawRecord.address) || rawRecord;

  const bbl = getRecordDigits(address, 'bbl');
  const ease_digit = getRecordString(address, 'easement')?.charAt(0) || '0';
  const parid = computeParid(bbl, ease_digit);
  const taxMap =
    getRecordString(address, 'taxMapNumberSectionAndVolume') ||
    getRecordString(address, 'taxMapNumber');
  const condoId = getRecordString(address, 'dofCondominiumIdentificationNumber');
  const coopId = getRecordString(address, 'cooperativeIdNumber');

  return {
    bbl,
    block: getRecordDigits(address, 'taxBlock'),
    lot: getRecordDigits(address, 'taxLot'),
    bin: getRecordDigits(address, 'buildingIdentificationNumber'),
    condo_num: condoId || getRecordString(address, 'condominiumBillingBbl') || getRecordString(address, 'condominium'),
    coop_num: coopId || getRecordString(address, 'coopNumber'),
    tax_map: taxMap,
    tax_section: getRecordString(address, 'taxSection') || taxMap,
    tax_volume: getRecordString(address, 'taxMapNumber') || taxMap,
    ease_digit,
    parid,
    raw: {
      BBL: bbl,
      Tax_Block: getRecordDigits(address, 'taxBlock'),
      Tax_Lot: getRecordDigits(address, 'taxLot'),
      BIN: getRecordDigits(address, 'buildingIdentificationNumber'),
      Condo_Num: getRecordString(address, 'condominiumBillingBin'),
      Co_op_Num: getRecordString(address, 'coopNumber'),
      Tax_Map: getRecordString(address, 'taxMapNumber'),
      Tax_Section: getRecordString(address, 'taxSection'),
      Tax_Volume: getRecordString(address, 'taxMapNumber'),
      Easement: ease_digit,
      PARID: parid,
      Geoclient_v2_Response: true,
    },
  };
}

async function fetchPlutoRow(
  field: 'bbl' | 'appbbl',
  value: string,
  appToken?: string | null,
  baseUrl?: string | null,
): Promise<Record<string, unknown> | null> {
  const url = new URL('resource/64uk-42ks.json', baseUrl || DEFAULT_OPEN_DATA_BASE);
  url.searchParams.set(field, value);
  if (appToken) url.searchParams.set('$$app_token', appToken);
  const json = await fetchJSON<UnknownRecord[]>(url.toString(), { description: `NYC PLUTO (${field})` });
  const row = Array.isArray(json) ? json[0] : null;
  return row || null;
}

export async function fetchPlutoData(
  bbl: string,
  appToken?: string | null,
  baseUrl?: string | null,
): Promise<Record<string, unknown> | null> {
  const cleanedBbl = digitsOnly(bbl) || bbl;

  const row =
    (await fetchPlutoRow('bbl', cleanedBbl, appToken, baseUrl)) ||
    (await fetchPlutoRow('appbbl', cleanedBbl, appToken, baseUrl));
  if (!row) return null;

  const normalizedRow: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalizedRow[key] = value === undefined ? null : value;
  }

  return {
    ...normalizedRow,
    Building_Area: normalizeNumber(row.bldgarea),
    Building_Class: normalizeValue(row.bldgclass),
    Common_Area: normalizeNumber(row.comarea),
    Total_Buildings: normalizeNumber(row.numbldgs),
    Total_Floors: normalizeNumber(row.numfloors),
    Residential_Area: normalizeNumber(row.resarea),
    Residential_Units: normalizeNumber(row.unitsres),
    Total_Units: normalizeNumber(row.unitstotal),
    Year_Built: normalizeNumber(row.yearbuilt),
    PLUTO_Response: true,
  };
}

async function fetchHpdBuilding(
  bin: string,
  datasetId: string = HPD_BUILDINGS_DATASET_ID,
  appToken?: string | null,
  baseUrl?: string | null,
): Promise<HpdBuildingResult> {
  const cleanedBin = digitsOnly(bin);
  if (!cleanedBin)
    return { data: null, raw: null, registrationId: null, latitude: null, longitude: null, buildingId: null };

  const url = new URL(`resource/${datasetId}.json`, baseUrl || DEFAULT_OPEN_DATA_BASE);
  url.searchParams.set('bin', cleanedBin);
  if (appToken) url.searchParams.set('$$app_token', appToken);

  const json = await fetchJSON<UnknownRecord[]>(url.toString(), { description: 'HPD Building' });
  const row = Array.isArray(json) ? json[0] : null;
  if (!row)
    return { data: null, raw: null, registrationId: null, latitude: null, longitude: null, buildingId: null };

  const normalizedRow: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalizedRow[key] = value === undefined ? null : value;
  }

  const registrationId =
    normalizeValue(row.registrationid) ||
    normalizeValue(row.registration_id) ||
    null;

  const latitude = normalizeNumber(row.latitude);
  const longitude = normalizeNumber(row.longitude);
  const buildingId = normalizeNumber(row.buildingid);

  const hpd: Record<string, unknown> = {
    ownername: normalizeValue(row.ownername),
    ownerbusinessname: normalizeValue(row.ownerbusinessname),
    ownertype: normalizeValue(row.ownertype),
    corporation: normalizeValue(row.corporation),
    businessaddress: normalizeValue(row.businessaddress),
    apartment: normalizeValue(row.apartment),
    state: normalizeValue(row.state),
    zip: normalizeValue(row.zip),
    phone: normalizeValue(row.phone),
    recordstatus: normalizeValue(row.recordstatus),
    registrationenddate: normalizeValue(row.registrationenddate),
    lastregistrationdate: normalizeValue(row.lastregistrationdate),
    registrationtype: normalizeValue(row.registrationtype),
    numfloors: normalizeNumber(row.numfloors),
    numapts: normalizeNumber(row.numapts),
    numBldgs: normalizeNumber(row.numbldgs ?? row.numbldgs),
    longitude,
    latitude,
    communityboard: normalizeValue(row.communityboard),
    census_tract: normalizeValue(row.census_tract),
    ntaname: normalizeValue(row.ntaname),
    businessphone: normalizeValue(row.businessphone),
    emergencyphone: normalizeValue(row.emergencyphone),
    officecode: normalizeValue(row.officecode),
    otherphonenum: normalizeValue(row.otherphonenum),
    registrationid: registrationId,
    buildingid: buildingId,
    HPD_Response: true,
  };

  const duplicates = new Set([
    'bbl',
    'bin',
    'numfloors',
    'numbldgs',
    'numBldgs',
    'longitude',
    'latitude',
  ]);
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(hpd)) {
    if (duplicates.has(key)) continue;
    if (value !== null && value !== undefined) {
      filtered[key] = value;
    }
  }

  return { data: filtered, raw: normalizedRow, registrationId, latitude, longitude, buildingId };
}

async function fetchHpdRegistration(
  registrationId: string,
  appToken?: string | null,
  baseUrl?: string | null,
): Promise<Record<string, unknown> | null> {
  const url = new URL(
    `resource/${HPD_REGISTRATION_DATASET_ID}.json`,
    baseUrl || DEFAULT_OPEN_DATA_BASE,
  );
  url.searchParams.set('$where', `registrationid='${registrationId}'`);
  if (appToken) url.searchParams.set('$$app_token', appToken);

  const json = await fetchJSON<UnknownRecord[]>(url.toString(), { description: 'HPD Registration Details' });
  const row = Array.isArray(json) ? json[0] : null;
  if (!row) return null;

  const normalized: Record<string, unknown> = {};
  for (const column of HPD_REGISTRATION_COLUMNS) {
    const value = (row as Record<string, unknown>)[column];
    const norm = normalizeValue(value) ?? normalizeNumber(value);
    normalized[column] = norm ?? null;
  }

  for (const [key, value] of Object.entries(row)) {
    if (key in normalized) continue;
    const norm = normalizeValue(value) ?? normalizeNumber(value);
    normalized[key] = norm ?? null;
  }

  normalized.HPD_Registration_Response = true;
  return normalized;
}

function parseGeometry(feature: UnknownRecord | null): Array<Array<[number, number]>> {
  const geom = (feature && (feature.the_geom || feature.geometry)) || null;
  if (!geom) return [];

  let geoObj: unknown = geom;
  if (typeof geom === 'string') {
    try {
      geoObj = JSON.parse(geom);
    } catch {
      return [];
    }
  }

  if (
    typeof geoObj === 'object' &&
    geoObj !== null &&
    'type' in geoObj &&
    'coordinates' in geoObj
  ) {
    const { type, coordinates } = geoObj as { type?: string; coordinates?: unknown };
    if (type === 'Polygon' && Array.isArray(coordinates)) {
      return coordinates as Array<Array<[number, number]>>;
    }
    if (type === 'MultiPolygon' && Array.isArray(coordinates)) {
      return (coordinates as unknown[]).flatMap((poly) =>
        Array.isArray(poly) ? (poly as Array<Array<[number, number]>>) : [],
      );
    }
  }

  return [];
}

export function pointInPolygon(point: [number, number], vs: Array<[number, number]>): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0];
    const yi = vs[i][1];
    const xj = vs[j][0];
    const yj = vs[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

async function fetchNtaMatch(
  boroughCode: string,
  latitude: number,
  longitude: number,
  appToken?: string | null,
  baseUrl?: string | null,
): Promise<NtaResult | null> {
  const url = new URL('resource/9nt8-h7nd.json', baseUrl || DEFAULT_OPEN_DATA_BASE);
  url.searchParams.set('borocode', boroughCode);
  if (appToken) url.searchParams.set('$$app_token', appToken);

  const json = await fetchJSON<UnknownRecord[]>(url.toString(), { description: 'NTA geometry' });
  const features = Array.isArray(json) ? json : [];
  for (const feature of features) {
    const ntaname = normalizeValue(feature.ntaname);
    const ntacode = normalizeValue(feature.ntacode);
    const polygons = parseGeometry(feature);
    for (const ring of polygons) {
      const coords = (ring || []).map(
        (pt) => [normalizeNumber(pt[0]), normalizeNumber(pt[1])] as [number | null, number | null],
      );
      const cleaned = coords.filter(
        (pt): pt is [number, number] => pt[0] !== null && pt[1] !== null,
      );
      if (cleaned.length && pointInPolygon([longitude, latitude], cleaned)) {
        return {
          ntaname,
          ntacode,
          geometry_match: true,
          source: 'NTA dataset',
        };
      }
    }
  }
  return null;
}

function firstNumber(values: Array<number | null | undefined>): number | null {
  for (const v of values) {
    if (v === 0 || (v !== null && v !== undefined && Number.isFinite(v))) {
      return Number(v);
    }
  }
  return null;
}

async function findExistingBuilding(
  db: TypedSupabaseClient,
  keys: {
    bbl?: string | null;
    bin?: string | null;
    parid?: string | null;
    normalizedKey?: string | null;
  },
) {
  const filters: string[] = [];
  if (keys.bbl) filters.push(`bbl.eq.${keys.bbl}`);
  if (keys.bin) filters.push(`bin.eq.${keys.bin}`);
  if (keys.parid) filters.push(`parid.eq.${keys.parid}`);
  if (keys.normalizedKey) filters.push(`normalized_address_key.eq.${keys.normalizedKey}`);
  if (!filters.length) return null;

  const { data, error } = await db
    .from('buildings')
    .select('*')
    .or(filters.join(','))
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.warn({ error }, 'Failed to look up existing building');
    return null;
  }
  return data as BuildingRow | null;
}

function mergeJson(existing: Json | null | undefined, incoming: Record<string, unknown> | null) {
  const base = (existing as Record<string, unknown> | null) || {};
  return incoming ? { ...base, ...incoming } : existing || null;
}

export async function enrichBuildingForProperty(
  input: AddressEnrichmentInput,
  options?: EnrichmentOptions,
): Promise<EnrichmentResult> {
  const db = options?.db || supabaseAdmin || supabase;
  if (!db) {
    throw new Error('Supabase client unavailable for enrichment');
  }

  const now = options?.now || new Date().toISOString();
  const errors: string[] = [];

  const normalizedAddress = buildNormalizedAddressKey({
    addressLine1: input.addressLine1,
    city: input.city || undefined,
    state: input.state || undefined,
    postalCode: input.postalCode || undefined,
    country: input.country || undefined,
    borough: input.borough ? String(input.borough) : undefined,
  });
  const normalizedAddressKey =
    options?.normalizedAddressKey || normalizedAddress?.normalizedAddressKey || null;

  const { houseNumber, streetName } = splitHouseAndStreet(input.addressLine1 || '');
  const normalizedStreet = normalizeStreetName(streetName);
  const boroughCode = normalizeBoroughCode(input.borough || input.city);
  const normalizedNeighborhood = normalizeValue(input.neighborhood);
  const zip = normalizeZip(input.postalCode);
  const binOverride = options?.binOverride || input.bin || null;
  const bblOverride = options?.bblOverride || input.bbl || null;
  const blockOverride = options?.blockOverride || input.block || null;
  const lotOverride = options?.lotOverride || input.lot || null;

  if (!isNYCBoroughCode(boroughCode)) {
    const propertyPatch: Record<string, unknown> = {};
    if (normalizedNeighborhood) propertyPatch.neighborhood = normalizedNeighborhood;
    if (normalizedAddressKey) propertyPatch.normalized_address_key = normalizedAddressKey;
    return {
      building: null,
      propertyPatch,
      errors,
    };
  }

  if (!houseNumber || !normalizedStreet) {
    throw new Error('House number and street name are required for address enrichment');
  }

  let geoservice: GeoserviceResult | null = null;
  try {
    geoservice = await fetchGeoserviceData({
      houseNumber,
      streetName: normalizedStreet,
      boroughCode,
      zipCode: zip,
      subscriptionKey: GEOSERVICE_SUBSCRIPTION_KEY,
      baseUrl: DEFAULT_GEOSERVICE_BASE,
    });
  } catch (err) {
    errors.push(err instanceof Error ? err.message : 'Geoservice lookup failed');
  }

  const resolvedBbl = geoservice?.bbl || normalizeValue(bblOverride);
  const resolvedBin = geoservice?.bin || normalizeValue(binOverride);

  if (!resolvedBbl) {
    throw new Error('NYC Geoservice could not resolve a BBL for this address and no BBL override was provided');
  }

  const parid = geoservice?.parid || null;
  const existing = await findExistingBuilding(db, {
    bbl: resolvedBbl || null,
    bin: resolvedBin || null,
    parid,
    normalizedKey: normalizedAddressKey || normalizedAddress?.normalizedAddressKey || null,
  });

  const basePayload: Partial<BuildingInsert> = {
    raw_address: normalizeValue(input.addressLine1),
    house_number: normalizeValue(houseNumber) || existing?.house_number || null,
    street_name: normalizeValue(streetName) || existing?.street_name || null,
    street_name_normalized: normalizedStreet || existing?.street_name_normalized || null,
    borough_code: boroughCode || existing?.borough_code || null,
    borough: boroughNameFromCode(boroughCode) || existing?.borough || null,
    city: normalizeValue(input.city) || existing?.city || null,
    state: normalizeValue(input.state) || existing?.state || null,
    zip_code: zip || existing?.zip_code || null,
    country: normalizeValue(input.country) || existing?.country || null,
    normalized_address_key:
      normalizedAddressKey ||
      normalizedAddress?.normalizedAddressKey ||
      existing?.normalized_address_key ||
      null,
    bbl: resolvedBbl || existing?.bbl || null,
    bin: resolvedBin || existing?.bin || null,
    parid: parid || existing?.parid || null,
    ease_digit: geoservice?.ease_digit || existing?.ease_digit || null,
    condo_num: geoservice?.condo_num || existing?.condo_num || null,
    residential_units: existing?.residential_units || null,
    coop_num: geoservice?.coop_num || existing?.coop_num || null,
    tax_block: geoservice?.block || blockOverride || existing?.tax_block || null,
    tax_lot: geoservice?.lot || lotOverride || existing?.tax_lot || null,
    tax_map: geoservice?.tax_map || existing?.tax_map || null,
    tax_section: geoservice?.tax_section || existing?.tax_section || null,
    tax_volume: geoservice?.tax_volume || existing?.tax_volume || null,
    hpd: (existing?.hpd as Json | null | undefined) ?? null,
    geoservice: geoservice
      ? (mergeJson(existing?.geoservice, geoservice.raw) as Json)
      : ((existing?.geoservice as Json | null | undefined) ?? null),
    geoservice_response_at: geoservice ? now : existing?.geoservice_response_at || null,
    enrichment_errors: Array.isArray(existing?.enrichment_errors)
      ? existing.enrichment_errors
      : [],
  };

  let pluto = (existing?.pluto as Record<string, unknown> | null | undefined) ?? null;
  let plutoResidentialUnits: number | null = null;
  if (!pluto && resolvedBbl) {
    try {
      pluto = await fetchPlutoData(resolvedBbl, OPEN_DATA_APP_TOKEN, DEFAULT_OPEN_DATA_BASE);
      if (pluto) {
        basePayload.pluto = pluto as Json;
        basePayload.pluto_response_at = now;
        plutoResidentialUnits =
          normalizeNumber(pluto.Residential_Units) ??
          normalizeNumber(pluto.unitsres) ??
          null;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'PLUTO fetch failed');
    }
  } else if (pluto) {
    basePayload.pluto = pluto as Json;
    basePayload.pluto_response_at = existing?.pluto_response_at || null;
    plutoResidentialUnits =
      normalizeNumber(pluto.Residential_Units) ??
      normalizeNumber(pluto.unitsres) ??
      null;
  }

  if (
    plutoResidentialUnits !== null &&
    plutoResidentialUnits !== undefined &&
    basePayload.residential_units === null
  ) {
    basePayload.residential_units = plutoResidentialUnits;
  }

  let hpd: HpdBuildingResult | null = null;
  if ((!existing?.hpd_building || !existing?.hpd) && (resolvedBin || existing?.bin)) {
    try {
      hpd = await fetchHpdBuilding(
        resolvedBin || existing?.bin || '',
        HPD_BUILDINGS_DATASET_ID,
        OPEN_DATA_APP_TOKEN,
        DEFAULT_OPEN_DATA_BASE,
      );
      if (hpd?.data) {
        basePayload.hpd_building = hpd.data as Json;
        basePayload.hpd = hpd.raw as Json;
        basePayload.hpd_response_at = now;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'HPD fetch failed');
    }
  } else if (existing?.hpd_building) {
    const existingHpdBuilding = asRecord(existing.hpd_building) || null;
    hpd = {
      data: existingHpdBuilding,
      raw: (existing?.hpd as Record<string, unknown> | null | undefined) ?? null,
      registrationId: normalizeValue(getRecordValue(existingHpdBuilding, 'registrationid')),
      latitude: existing.latitude,
      longitude: existing.longitude,
      buildingId: normalizeNumber(getRecordValue(existingHpdBuilding, 'buildingid')),
    };
  }

  if (!basePayload.latitude) {
    basePayload.latitude = firstNumber([
      hpd?.latitude,
      geoservice?.raw?.latitude as number,
      input.latitude,
      existing?.latitude,
    ]);
  }
  if (!basePayload.longitude) {
    basePayload.longitude = firstNumber([
      hpd?.longitude,
      geoservice?.raw?.longitude as number,
      input.longitude,
      existing?.longitude,
    ]);
  }

  if (!existing?.hpd_registration && hpd?.registrationId) {
    try {
      const registration = await fetchHpdRegistration(
        hpd.registrationId,
        OPEN_DATA_APP_TOKEN,
        DEFAULT_OPEN_DATA_BASE,
      );
      if (registration) {
        const registrationPayload: Record<string, unknown> = { ...registration };
        if (hpd?.data) {
          const taken = new Set(Object.keys(hpd.data).map((k) => k.toLowerCase()));
          for (const key of Object.keys(registrationPayload)) {
            if (taken.has(key.toLowerCase())) {
              delete registrationPayload[key];
            }
          }
        }
        basePayload.hpd_registration = registrationPayload as Json;
        basePayload.hpd_registration_response_at = now;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'HPD Registration fetch failed');
    }
  } else if (existing?.hpd_registration) {
    basePayload.hpd_registration = existing.hpd_registration;
    basePayload.hpd_registration_response_at = existing.hpd_registration_response_at || null;
  }

  if (
    !existing?.nta &&
    basePayload.latitude !== null &&
    basePayload.latitude !== undefined &&
    basePayload.longitude !== null &&
    basePayload.longitude !== undefined
  ) {
    try {
      const nta = await fetchNtaMatch(
        boroughCode,
        Number(basePayload.latitude),
        Number(basePayload.longitude),
        OPEN_DATA_APP_TOKEN,
        DEFAULT_OPEN_DATA_BASE,
      );
      if (nta) {
        basePayload.nta = { ...nta, NTA_Response: true } as Json;
        basePayload.nta_name = nta.ntaname;
        basePayload.nta_code = nta.ntacode;
        basePayload.neighborhood =
          nta.ntaname || existing?.neighborhood || normalizedNeighborhood || null;
        basePayload.nta_response_at = now;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'NTA geometry match failed');
    }
  } else if (existing?.nta) {
    basePayload.nta = existing.nta;
    basePayload.nta_name = existing.nta_name;
    basePayload.nta_code = existing.nta_code;
    basePayload.neighborhood = existing.neighborhood || normalizedNeighborhood || null;
    basePayload.nta_response_at = existing.nta_response_at || null;
  }

  if (!basePayload.neighborhood) {
    basePayload.neighborhood = normalizedNeighborhood || existing?.neighborhood || null;
  }

  const payload = stripUndefined(basePayload);

  let building: BuildingRow | null = null;
  if (existing) {
    const { data, error } = await db
      .from('buildings')
      .update(payload as BuildingInsert)
      .eq('id', existing.id)
      .select('*')
      .maybeSingle();
    if (error) {
      throw new Error(error.message || 'Failed to update building');
    }
    building = data as BuildingRow;
  } else {
    const { data, error } = await db
      .from('buildings')
      .insert(payload as BuildingInsert)
      .select('*')
      .maybeSingle();
    if (error) {
      throw new Error(error.message || 'Failed to create building');
    }
    building = data as BuildingRow;
  }

  const boroughName = boroughNameFromCode(boroughCode);
  const latFromBuilding = building?.latitude;
  const lngFromBuilding = building?.longitude;
  const blockNumber = normalizeNumber(basePayload.tax_block);
  const lotNumber = normalizeNumber(basePayload.tax_lot);
  const propertyPatch: Record<string, unknown> = {
    building_id: building?.id || null,
    location_verified: true,
    normalized_address_key:
      normalizedAddressKey ||
      normalizedAddress?.normalizedAddressKey ||
      building?.normalized_address_key ||
      null,
  };
  if (resolvedBin) propertyPatch.bin = resolvedBin;
  if (resolvedBbl) propertyPatch.bbl = resolvedBbl;
  if (blockNumber !== null && blockNumber !== undefined) propertyPatch.block = blockNumber;
  if (lotNumber !== null && lotNumber !== undefined) propertyPatch.lot = lotNumber;
  if (boroughCode) propertyPatch.borough_code = Number(boroughCode);
  if (hpd?.buildingId !== null && hpd?.buildingId !== undefined)
    propertyPatch.hpd_building_id = hpd.buildingId;
  if (hpd?.registrationId) {
    const regId = normalizeNumber(hpd.registrationId) ?? null;
    propertyPatch.hpd_registration_id = regId;
  }
  if (boroughName) propertyPatch.borough = boroughName;
  const neighborhood = building?.neighborhood || normalizedNeighborhood;
  if (neighborhood) propertyPatch.neighborhood = neighborhood;
  if (latFromBuilding !== undefined && latFromBuilding !== null)
    propertyPatch.latitude = latFromBuilding;
    if (lngFromBuilding !== undefined && lngFromBuilding !== null)
      propertyPatch.longitude = lngFromBuilding;

  if (errors.length && building) {
    try {
      await db
        .from('buildings')
        .update({ enrichment_errors: errors })
        .eq('id', building.id);
    } catch (err) {
      logger.warn({ err }, 'Failed to persist enrichment errors');
    }
  }

  return {
    building,
    propertyPatch,
    errors,
  };
}

export { fetchJSON };
 
