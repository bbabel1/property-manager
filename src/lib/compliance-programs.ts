import type {
  ComplianceAppliesTo,
  ComplianceAsset,
  ComplianceDeviceCategory,
  ComplianceProgram,
  ComplianceProgramCriteria,
} from '@/types/compliance'

const BOROUGH_VALUES = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']
export const DEVICE_CATEGORY_OPTIONS: ComplianceDeviceCategory[] = [
  'elevator',
  'escalator',
  'dumbwaiter',
  'wheelchair_lift',
  'material_lift',
  'manlift',
  'pneumatic_elevator',
  'other_vertical',
]

type PropertyMeta = {
  id: string
  borough?: string | null
  bin?: string | null
  occupancy_group?: string | null
  occupancy_description?: string | null
  is_one_two_family?: boolean | null
  is_private_residence_building?: boolean | null
  dwelling_unit_count?: number | null
  property_total_units?: number | null
}

type AssetMeta = Pick<
  ComplianceAsset,
  | 'id'
  | 'asset_type'
  | 'external_source'
  | 'active'
  | 'metadata'
  | 'property_id'
  | 'device_category'
  | 'device_technology'
  | 'device_subtype'
  | 'is_private_residence'
>

export function canonicalAssetType(asset?: AssetMeta | null): string | null {
  if (!asset) return null
  if (asset.asset_type) return asset.asset_type
  const meta = (asset.metadata || {}) as Record<string, any>
  const metaType = typeof meta.device_type === 'string' ? meta.device_type : typeof meta.asset_type === 'string' ? meta.asset_type : null
  const source = asset.external_source || ''
  const candidates = [metaType, source].filter(Boolean).map((v) => String(v).toLowerCase())
  for (const val of candidates) {
    if (val.includes('elevator')) return 'elevator'
    if (val.includes('boiler')) return 'boiler'
    if (val.includes('sprinkler')) return 'sprinkler'
    if (val.includes('gas')) return 'gas_piping'
    if (val.includes('facade')) return 'facade'
  }
  return null
}

export function sanitizeProgramCriteria(input: unknown): ComplianceProgramCriteria | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as Record<string, any>
  const criteria: ComplianceProgramCriteria = {}

  if (raw.scope_override && ['property', 'asset', 'both'].includes(raw.scope_override)) {
    criteria.scope_override = raw.scope_override as ComplianceAppliesTo
  }

  const propertyFilters = raw.property_filters || raw.propertyFilters
  if (propertyFilters && typeof propertyFilters === 'object') {
    const pf: NonNullable<ComplianceProgramCriteria['property_filters']> = {}
    if (Array.isArray(propertyFilters.boroughs)) {
      const boroughs = Array.from(new Set(propertyFilters.boroughs.filter((b: any) => typeof b === 'string' && BOROUGH_VALUES.includes(b))))
      if (boroughs.length) pf.boroughs = boroughs
    }
    if (typeof propertyFilters.require_bin === 'boolean') {
      pf.require_bin = propertyFilters.require_bin
    }
    if (Array.isArray(propertyFilters.occupancy_groups)) {
      const groups = Array.from(
        new Set(
          propertyFilters.occupancy_groups
            .map((g: any) => (typeof g === 'string' ? g.trim() : null))
            .filter((g): g is string => Boolean(g)),
        ),
      )
      if (groups.length) pf.occupancy_groups = groups
    }
    if (typeof propertyFilters.is_one_two_family === 'boolean') {
      pf.is_one_two_family = propertyFilters.is_one_two_family
    }
    if (typeof propertyFilters.is_private_residence_building === 'boolean') {
      pf.is_private_residence_building = propertyFilters.is_private_residence_building
    }
    if (typeof propertyFilters.min_dwelling_units === 'number') {
      pf.min_dwelling_units = propertyFilters.min_dwelling_units
    }
    if (typeof propertyFilters.max_dwelling_units === 'number') {
      pf.max_dwelling_units = propertyFilters.max_dwelling_units
    }
    if (Object.keys(pf).length > 0) criteria.property_filters = pf
  }

  const assetFilters = raw.asset_filters || raw.assetFilters
  if (assetFilters && typeof assetFilters === 'object') {
    const af: NonNullable<ComplianceProgramCriteria['asset_filters']> = {}
    if (Array.isArray(assetFilters.asset_types)) {
      const assetTypes = Array.from(new Set(assetFilters.asset_types.filter((t: any) => typeof t === 'string')))
      if (assetTypes.length) af.asset_types = assetTypes as any
    }
    if (typeof assetFilters.external_source === 'string') {
      const trimmed = assetFilters.external_source.trim()
      af.external_source = trimmed.length ? trimmed : null
    }
    if (typeof assetFilters.active_only === 'boolean') {
      af.active_only = assetFilters.active_only
    }
    if (Array.isArray(assetFilters.device_categories)) {
      const deviceCategories = Array.from(
        new Set(
          assetFilters.device_categories
            .map((d: any) => normalizeDeviceCategoryValue(d))
            .filter((d): d is ComplianceDeviceCategory => Boolean(d)),
        ),
      )
      if (deviceCategories.length) af.device_categories = deviceCategories
    }
    if (Array.isArray(assetFilters.exclude_device_categories)) {
      const excluded = Array.from(
        new Set(
          assetFilters.exclude_device_categories
            .map((d: any) => normalizeDeviceCategoryValue(d))
            .filter((d): d is ComplianceDeviceCategory => Boolean(d)),
        ),
      )
      if (excluded.length) af.exclude_device_categories = excluded
    }
    if (Array.isArray(assetFilters.device_technologies)) {
      const technologies = Array.from(
        new Set(
          assetFilters.device_technologies
            .map((t: any) => (typeof t === 'string' ? matchDeviceTechnology(String(t)) || t.trim() : null))
            .filter((t): t is string => Boolean(t)),
        ),
      )
      if (technologies.length) af.device_technologies = technologies
    }
    if (typeof assetFilters.is_private_residence === 'boolean') {
      af.is_private_residence = assetFilters.is_private_residence
    }
    if (Object.keys(af).length > 0) criteria.asset_filters = af
  }

  return Object.keys(criteria).length > 0 ? criteria : {}
}

export function resolveProgramScope(program: Pick<ComplianceProgram, 'applies_to' | 'criteria'>): ComplianceAppliesTo {
  return (program.criteria?.scope_override as ComplianceAppliesTo) || program.applies_to
}

export function propertyMatchesCriteria(criteria: ComplianceProgramCriteria | null | undefined, property?: PropertyMeta | null): boolean {
  if (!criteria || !criteria.property_filters) return true
  if (!property) return false
  const {
    boroughs,
    require_bin,
    occupancy_groups,
    is_one_two_family,
    is_private_residence_building,
    min_dwelling_units,
    max_dwelling_units,
  } = criteria.property_filters
  if (boroughs && boroughs.length > 0) {
    if (!property.borough || !boroughs.includes(property.borough)) return false
  }
  if (require_bin && !property.bin) return false
  if (occupancy_groups && occupancy_groups.length > 0) {
    if (!property.occupancy_group || !occupancy_groups.includes(property.occupancy_group)) return false
  }
  if (typeof is_one_two_family === 'boolean') {
    if (property.is_one_two_family !== is_one_two_family) return false
  }
  if (typeof is_private_residence_building === 'boolean') {
    if (property.is_private_residence_building !== is_private_residence_building) return false
  }
  const dwellingCount = property.dwelling_unit_count ?? property.property_total_units ?? null
  if (typeof min_dwelling_units === 'number') {
    if (dwellingCount === null || dwellingCount < min_dwelling_units) return false
  }
  if (typeof max_dwelling_units === 'number') {
    if (dwellingCount === null || dwellingCount > max_dwelling_units) return false
  }
  return true
}

export function assetMatchesCriteria(criteria: ComplianceProgramCriteria | null | undefined, asset?: AssetMeta | null): boolean {
  if (!criteria || !criteria.asset_filters) return true
  if (!asset) return false
  const canonicalType = canonicalAssetType(asset)
  const {
    asset_types,
    external_source,
    active_only,
    device_categories,
    exclude_device_categories,
    device_technologies,
    is_private_residence,
  } = criteria.asset_filters
  const deviceCategory = deviceCategoryFromAsset(asset)
  const deviceTechnology = deviceTechnologyFromAsset(asset)
  if (asset_types && asset_types.length > 0) {
    if (!canonicalType || !asset_types.includes(canonicalType as any)) return false
  }
  if (external_source) {
    if (asset.external_source !== external_source) return false
  }
  if (active_only && asset.active === false) return false
  if (device_categories && device_categories.length > 0) {
    if (!deviceCategory || !device_categories.includes(deviceCategory)) return false
  }
  if (exclude_device_categories && exclude_device_categories.length > 0) {
    if (deviceCategory && exclude_device_categories.includes(deviceCategory)) return false
  }
  if (device_technologies && device_technologies.length > 0) {
    if (!deviceTechnology || !device_technologies.includes(deviceTechnology)) return false
  }
  if (typeof is_private_residence === 'boolean') {
    if ((asset as any).is_private_residence !== is_private_residence) return false
  }
  return true
}

export function programTargetsProperty(program: Pick<ComplianceProgram, 'applies_to' | 'criteria'>, property: PropertyMeta | null | undefined): boolean {
  return propertyMatchesCriteria(program.criteria, property)
}

export function programTargetsAsset(program: Pick<ComplianceProgram, 'applies_to' | 'criteria'>, asset: AssetMeta | null | undefined, property: PropertyMeta | null | undefined): boolean {
  return propertyMatchesCriteria(program.criteria, property) && assetMatchesCriteria(program.criteria, asset)
}

export type ProgramPreview = {
  matched_properties: number
  matched_assets: number
}

export function summarizeProgramPreview(
  program: Pick<ComplianceProgram, 'applies_to' | 'criteria'>,
  properties: PropertyMeta[],
  assets: AssetMeta[],
): ProgramPreview {
  const scope = resolveProgramScope(program)
  let matchedProperties = 0
  let matchedAssets = 0

  if (scope === 'property' || scope === 'both') {
    for (const property of properties) {
      if (programTargetsProperty(program, property)) matchedProperties++
    }
  }

  if (scope === 'asset' || scope === 'both') {
    const propertyMap = new Map(properties.map((p) => [p.id, p]))
    for (const asset of assets) {
      const prop = propertyMap.get(asset.property_id)
      if (programTargetsAsset(program, asset, prop)) matchedAssets++
    }
  }

  return { matched_properties: matchedProperties, matched_assets: matchedAssets }
}

function normalizeDeviceCategoryValue(value: unknown): ComplianceDeviceCategory | null {
  if (!value) return null
  const str = String(value).toLowerCase()
  const match = DEVICE_CATEGORY_OPTIONS.find((option) => option === str)
  return (match as ComplianceDeviceCategory) || matchDeviceCategory(str)
}

function matchDeviceCategory(value: string): ComplianceDeviceCategory | null {
  const normalized = value.toLowerCase()
  if (normalized.includes('escalator') || normalized.includes('moving walk')) return 'escalator'
  if (normalized.includes('dumbwaiter') || normalized.includes('dumb waiter')) return 'dumbwaiter'
  if (
    normalized.includes('wheelchair') ||
    normalized.includes('platform lift') ||
    normalized.includes('vertical platform') ||
    normalized.includes('handicap lift') ||
    normalized.includes('ada lift')
  ) {
    return 'wheelchair_lift'
  }
  if (
    normalized.includes('material lift') ||
    normalized.includes('stage lift') ||
    normalized.includes('sidewalk lift') ||
    normalized.includes('convey') ||
    normalized.includes('moving platform')
  ) {
    return 'material_lift'
  }
  if (normalized.includes('manlift') || normalized.includes('man lift')) return 'manlift'
  if (normalized.includes('pneumatic') || normalized.includes('vacuum')) return 'pneumatic_elevator'
  if (normalized.includes('elevator')) return 'elevator'
  if (normalized.includes('lift')) return 'other_vertical'
  return null
}

export function deviceCategoryFromAsset(asset?: AssetMeta | null): ComplianceDeviceCategory | null {
  if (!asset) return null
  const meta = ((asset as any)?.metadata || {}) as Record<string, any>
  const candidates = [
    (asset as any).device_category,
    meta.device_type,
    meta.deviceType,
    meta.device_category,
    meta.deviceCategory,
    meta.device_description,
    meta.deviceDescription,
    meta.type,
    meta.category,
    meta.description,
    asset.asset_type,
    asset.external_source,
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const category = matchDeviceCategory(String(candidate))
    if (category) return category
  }

  if (asset.asset_type === 'elevator') return 'elevator'
  return null
}

function deviceTechnologyFromAsset(asset?: AssetMeta | null): string | null {
  if (!asset) return null
  const meta = ((asset as any)?.metadata || {}) as Record<string, any>
  const candidates = [
    (asset as any).device_technology,
    (asset as any).device_subtype,
    meta.device_technology,
    meta.deviceTechnology,
    meta.tech,
    meta.technology,
    meta.device_type,
    meta.type,
    meta.description,
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const tech = matchDeviceTechnology(String(candidate))
    if (tech) return tech
  }
  return null
}

function matchDeviceTechnology(value: string): string | null {
  const normalized = value.toLowerCase()
  if (normalized.includes('traction') || normalized.includes('gearless') || normalized.includes('geared')) return 'traction'
  if (normalized.includes('hydraulic')) return 'hydraulic'
  if (normalized.includes('roped')) return 'roped_hydraulic'
  if (normalized.includes('mrl')) return 'mrl_traction'
  if (normalized.includes('winding') || normalized.includes('drum')) return 'winding_drum'
  return null
}
