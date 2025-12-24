// @ts-nocheck
import { supabaseAdmin } from '@/lib/db'
import { logger } from '@/lib/logger'
import { NYCOpenDataClient } from '@/lib/nyc-api-client'
import { getNYCOpenDataConfig } from '@/lib/nyc-open-data/config-manager'
import type { Json, Tables, TablesInsert } from '@/types/database'

export type PermitSource =
  | 'dob_now_build_approved_permits'
  | 'dob_permit_issuance_old'
  | 'dob_job_applications'
  | 'dep_water_sewer_permits'
  | 'dep_water_sewer_permits_old'
  | 'dob_elevator_permit_applications'
  | 'hpd_registrations'
  | 'dob_now_safety_facade'

type SyncResult = {
  source: PermitSource
  inserted: number
  updated: number
  skipped: number
  errors: string[]
}

type LocationContext = {
  orgId: string
  propertyId?: string | null
  buildingId?: string | null
  bin?: string | null
  bbl?: string | null
  block?: string | null
  lot?: string | null
  borough?: string | null
}

type PropertyLookup = Pick<
  Tables<'properties'>,
  'id' | 'building_id' | 'bin' | 'bbl' | 'block' | 'lot' | 'borough_code'
>
type BuildingLookup = Pick<Tables<'buildings'>, 'id' | 'tax_block' | 'tax_lot' | 'borough_code' | 'bbl' | 'bin'>
type BuildingPermitPayload = Omit<TablesInsert<'building_permits'>, 'metadata'> & {
  metadata: Record<string, Json>
}
type OpenDataRow = Record<string, Json>

const DEFAULT_SOURCES: PermitSource[] = [
  'dob_now_build_approved_permits',
  'dob_permit_issuance_old',
  'dob_job_applications',
  'dep_water_sewer_permits',
  'dep_water_sewer_permits_old',
  'dob_elevator_permit_applications',
  'hpd_registrations',
  'dob_now_safety_facade',
]

const PAGE_SIZE = 5000

function extractDeviceIdentifier(text?: string | null): string | null {
  if (!text) return null
  const deviceMatch = String(text).match(/(device\s*#?\s*|id\s*#?\s*)([A-Za-z0-9-]+)/i)
  if (deviceMatch?.[2]) return deviceMatch[2].trim()
  const boilerMatch = String(text).match(/boiler\s*#?\s*([A-Za-z0-9-]+)/i)
  if (boilerMatch?.[1]) return boilerMatch[1].trim()
  return null
}

export function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  return str.length ? str : null
}

function normalizeDate(value: unknown): string | null {
  const text = normalizeText(value)
  if (!text) return null
  const match = text.match(/\d{4}-\d{2}-\d{2}/) || text.match(/\d{2}\/\d{2}\/\d{4}/)
  if (!match) return null
  const raw = match[0]
  if (raw.includes('/')) {
    const [mm, dd, yyyy] = raw.split('/')
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  return raw
}

function normalizeNumber(value: unknown): number | null {
  const text = normalizeText(value)
  if (!text) return null
  const num = Number(text)
  return Number.isFinite(num) ? num : null
}

function buildBbl(borough?: string | null, block?: string | null, lot?: string | null): string | null {
  const b = normalizeText(borough)
  const blk = normalizeText(block)
  const lt = normalizeText(lot)
  if (!b || !blk || !lt) return null
  const blockPadded = blk.padStart(5, '0')
  const lotPadded = lt.padStart(4, '0')
  const digits = `${b}${blockPadded}${lotPadded}`.replace(/\D+/g, '')
  return digits.length === 10 ? digits : null
}

function combineName(first?: string | null, last?: string | null): string | null {
  const f = normalizeText(first)
  const l = normalizeText(last)
  if (f && l) return `${f} ${l}`
  return f || l
}

async function resolveLocation(orgId: string, propertyId?: string | null, bin?: string | null, bbl?: string | null): Promise<LocationContext> {
  let resolvedPropertyId = propertyId || null
  let resolvedBin = normalizeText(bin)
  let resolvedBbl = normalizeText(bbl)
  let resolvedBuildingId: string | null = null
  let block: string | null = null
  let lot: string | null = null
  let borough: string | null = null

  if (resolvedPropertyId) {
    const { data: property } = await supabaseAdmin
      .from('properties')
      .select('id, building_id, bin, bbl, block, lot, borough_code')
      .eq('id', resolvedPropertyId)
      .eq('org_id', orgId)
      .maybeSingle()
    if (property) {
      resolvedBin = resolvedBin || normalizeText(property.bin)
      resolvedBbl = resolvedBbl || normalizeText(property.bbl)
      resolvedBuildingId = property.building_id || null
      block = normalizeText(property.block) || block
      lot = normalizeText(property.lot) || lot
      borough = normalizeText(property.borough_code) || borough
    }
  }

  if (!resolvedPropertyId && resolvedBin) {
    const { data: propByBin } = await supabaseAdmin
      .from('properties')
      .select('id, building_id, bbl, block, lot, borough_code')
      .eq('org_id', orgId)
      .eq('bin', resolvedBin)
      .maybeSingle()
    if (propByBin) {
      resolvedPropertyId = (propByBin as PropertyLookup).id
      resolvedBuildingId = resolvedBuildingId || (propByBin as PropertyLookup).building_id || null
      resolvedBbl = resolvedBbl || normalizeText((propByBin as PropertyLookup).bbl)
      block = block || normalizeText((propByBin as PropertyLookup).block)
      lot = lot || normalizeText((propByBin as PropertyLookup).lot)
      borough = borough || normalizeText((propByBin as PropertyLookup).borough_code)
    }
  }

  if (!resolvedPropertyId && resolvedBbl) {
    const { data: propByBbl } = await supabaseAdmin
      .from('properties')
      .select('id, building_id, block, lot, borough_code')
      .eq('org_id', orgId)
      .eq('bbl', resolvedBbl)
      .maybeSingle()
    if (propByBbl) {
      resolvedPropertyId = (propByBbl as PropertyLookup).id
      resolvedBuildingId = resolvedBuildingId || (propByBbl as PropertyLookup).building_id || null
      block = block || normalizeText((propByBbl as PropertyLookup).block)
      lot = lot || normalizeText((propByBbl as PropertyLookup).lot)
      borough = borough || normalizeText((propByBbl as PropertyLookup).borough_code)
    }
  }

  if (!resolvedBuildingId && resolvedBbl) {
    const { data: building } = await supabaseAdmin
      .from('buildings')
      .select('id, tax_block, tax_lot, borough_code, bbl')
      .eq('bbl', resolvedBbl)
      .maybeSingle()
    if (building) {
      const buildingRow = building as BuildingLookup
      resolvedBuildingId = buildingRow.id || null
      block = block || normalizeText(buildingRow.tax_block)
      lot = lot || normalizeText(buildingRow.tax_lot)
      borough = borough || normalizeText(buildingRow.borough_code)
    }
  }

  if (!resolvedBuildingId && resolvedBin) {
    const { data: building } = await supabaseAdmin
      .from('buildings')
      .select('id, tax_block, tax_lot, borough_code, bbl')
      .eq('bin', resolvedBin)
      .maybeSingle()
    if (building) {
      const buildingRow = building as BuildingLookup
      resolvedBuildingId = buildingRow.id || null
      resolvedBbl = resolvedBbl || normalizeText(buildingRow.bbl)
      block = block || normalizeText(buildingRow.tax_block)
      lot = lot || normalizeText(buildingRow.tax_lot)
      borough = borough || normalizeText(buildingRow.borough_code)
    }
  }

  if (!block || !lot || !borough) {
    const derived = resolvedBbl ? resolvedBbl.replace(/\D+/g, '') : ''
    if (derived.length === 10) {
      borough = borough || derived[0]
      block = block || derived.slice(1, 6)
      lot = lot || derived.slice(6)
    }
  }

  return {
    orgId,
    propertyId: resolvedPropertyId,
    buildingId: resolvedBuildingId,
    bin: resolvedBin,
    bbl: resolvedBbl || buildBbl(borough, block, lot),
    block,
    lot,
    borough,
  }
}

async function upsertBuildingPermit(row: BuildingPermitPayload, stats: SyncResult) {
  const workPermit = row.work_permit ?? ''
  const sequenceNumber = row.sequence_number ?? ''
  const jobFilingNumber = row.job_filing_number

  const { data: existing } = await supabaseAdmin
    .from('building_permits')
    .select('id')
    .eq('org_id', row.org_id)
    .eq('source', row.source)
    .eq('job_filing_number', jobFilingNumber)
    .eq('work_permit', workPermit)
    .eq('sequence_number', sequenceNumber)
    .maybeSingle()

  if (existing?.id) {
    await supabaseAdmin
      .from('building_permits')
      .update(row)
      .eq('id', existing.id)
    stats.updated += 1
    return
  }

  await supabaseAdmin.from('building_permits').insert(row)
  stats.inserted += 1
}

function mapDobNowApprovedPermit(row: OpenDataRow, datasetId: string, ctx: LocationContext): BuildingPermitPayload | null {
  const jobFilingNumber = normalizeText(row.job_filing_number || row.job_filing_num || row.job_number)
  if (!jobFilingNumber) return null

  const permitNumber = normalizeText(row.work_permit) || ''
  const sequenceNumber = normalizeText(row.sequence_number) || ''
  const borough = normalizeText(row.borough) || ctx.borough
  const block = normalizeText(row.block) || ctx.block
  const lot = normalizeText(row.lot) || ctx.lot
  const bin = normalizeText(row.bin) || ctx.bin
  const bbl = normalizeText(row.bbl) || ctx.bbl || buildBbl(borough, block, lot)
  const deviceId =
    extractDeviceIdentifier(row.job_description) ||
    extractDeviceIdentifier(row.work_type) ||
    extractDeviceIdentifier(row.filing_reason)

  return {
    org_id: ctx.orgId,
    property_id: ctx.propertyId || null,
    building_id: ctx.buildingId || null,
    source: 'dob_now_build_approved_permits',
    dataset_id: datasetId,
    source_record_id: normalizeText(row.objectid || row.id || row.work_permit || jobFilingNumber),
    job_filing_number: jobFilingNumber,
    job_number: jobFilingNumber,
    work_permit: permitNumber,
    sequence_number: sequenceNumber,
    device_identifier: deviceId || null,
    filing_reason: normalizeText(row.filing_reason),
    work_type: normalizeText(row.work_type),
    permit_status: normalizeText(row.permit_status),
    house_no: normalizeText(row.house_no),
    street_name: normalizeText(row.street_name),
    borough,
    lot,
    bin,
    block,
    c_b_no: normalizeText(row.c_b_no),
    apt_condo_no_s: normalizeText(row.apt_condo_no_s),
    work_on_floor: normalizeText(row.work_on_floor),
    permittee_license_type: normalizeText(row.permittee_s_license_type || row.permittee_license_type),
    applicant_license: normalizeText(row.applicant_license),
    applicant_business_name: normalizeText(row.applicant_business_name),
    applicant_business_address: normalizeText(row.applicant_business_address),
    filing_representative_business_name: normalizeText(row.filing_representative_business_name),
    approved_date: normalizeDate(row.approved_date),
    issued_date: normalizeDate(row.issued_date),
    expired_date: normalizeDate(row.expired_date),
    job_description: normalizeText(row.job_description),
    estimated_job_costs: normalizeText(row.estimated_job_costs),
    owner_business_name: normalizeText(row.owner_business_name),
    owner_name: normalizeText(row.owner_name),
    owner_street_address: normalizeText(row.owner_street_address),
    owner_city: normalizeText(row.owner_city),
    owner_state: normalizeText(row.owner_state),
    owner_zip_code: normalizeText(row.owner_zip_code),
    tracking_number: normalizeText(row.tracking_number),
    zip_code: normalizeText(row.zip_code),
    latitude: normalizeNumber(row.latitude),
    longitude: normalizeNumber(row.longitude),
    community_board: normalizeNumber(row.community_board),
    council_district: normalizeNumber(row.council_district),
    bbl,
    census_tract: normalizeNumber(row.census_tract),
    nta: normalizeText(row.nta),
    metadata: row,
  }
}

function mapDobPermitIssuanceOld(row: OpenDataRow, datasetId: string, ctx: LocationContext): BuildingPermitPayload | null {
  const jobNumber = normalizeText(row.job__ || row.job_number || row.job) || normalizeText(row.job_)
  if (!jobNumber) return null

  const permitNumber = normalizeText(row.permit_si_no || row.permit_number) || ''
  const seq = normalizeText(row.permit_sequence__ || row.permit_sequence_number || row.permit_sequence) || ''
  const jobDoc = normalizeText(row.job_doc___ || row.job_doc_number || row.job_doc)
  const borough = normalizeText(row.borough) || ctx.borough
  const block = normalizeText(row.block) || ctx.block
  const lot = normalizeText(row.lot) || ctx.lot
  const bbl = normalizeText(row.bbl) || ctx.bbl || buildBbl(borough, block, lot)
  const ownerHouseNo = normalizeText(row.owner_s_house__ || row.owner_house_number)
  const ownerHouseStreet = normalizeText(row.owner_s_house_street_name || row.owner_house_street_name)
  const ownerHouseCity = normalizeText(row.owner_s_house_city || row.owner_house_city)
  const ownerHouseState = normalizeText(row.owner_s_house_state || row.owner_house_state)
  const ownerHouseZip = normalizeText(row.owner_s_zip_code || row.owner_house_zip_code)
  const deviceId =
    extractDeviceIdentifier(row.job_description) ||
    extractDeviceIdentifier(row.work_type) ||
    extractDeviceIdentifier(row.permit_type) ||
    extractDeviceIdentifier(row.permit_subtype)

  return {
    org_id: ctx.orgId,
    property_id: ctx.propertyId || null,
    building_id: ctx.buildingId || null,
    source: 'dob_permit_issuance_old',
    dataset_id: datasetId,
    source_record_id: normalizeText(row.objectid || row.id || row.permit_si_no || row.job__),
    job_filing_number: jobNumber,
    job_number: jobNumber,
    work_permit: permitNumber,
    sequence_number: seq,
    permit_sequence_number: seq || '',
    job_doc_number: jobDoc,
    device_identifier: deviceId || null,
    job_type: normalizeText(row.job_type),
    filing_status: normalizeText(row.filing_status),
    permit_type: normalizeText(row.permit_type),
    permit_subtype: normalizeText(row.permit_subtype),
    permit_status: normalizeText(row.permit_status),
    work_type: normalizeText(row.work_type),
    house_no: normalizeText(row.house__ || row.house_no),
    street_name: normalizeText(row.street_name),
    borough,
    block,
    lot,
    zip_code: normalizeText(row.zip_code),
    bbl,
    community_board: normalizeNumber(row.community_board),
    council_district: normalizeNumber(row.gis_council_district),
    census_tract: normalizeNumber(row.gis_census_tract),
    nta: normalizeText(row.gis_nta_name),
    latitude: normalizeNumber(row.gis_latitude),
    longitude: normalizeNumber(row.gis_longitude),
    filing_date: normalizeDate(row.filing_date),
    issuance_date: normalizeDate(row.issuance_date),
    expiration_date: normalizeDate(row.expiration_date),
    job_start_date: normalizeDate(row.job_start_date),
    self_cert: normalizeText(row.self_cert),
    oil_gas: normalizeText(row.oil_gas),
    site_fill: normalizeText(row.site_fill),
    non_profit: normalizeText(row.non_profit),
    owner_business_type: normalizeText(row.owner_s_business_type),
    owner_business_name: normalizeText(row.owner_s_business_name),
    owner_first_name: normalizeText(row.owner_s_first_name),
    owner_last_name: normalizeText(row.owner_s_last_name),
    owner_name: combineName(row.owner_s_first_name, row.owner_s_last_name) || normalizeText(row.owner_s_business_name),
    owner_street_address: ownerHouseStreet ? `${ownerHouseNo || ''} ${ownerHouseStreet}`.trim() : null,
    owner_house_number: ownerHouseNo,
    owner_house_street_name: ownerHouseStreet,
    owner_house_city: ownerHouseCity,
    owner_house_state: ownerHouseState,
    owner_house_zip_code: ownerHouseZip,
    owner_house_phone: normalizeText(row.owner_s_phone__ || row.owner_phone),
    owner_city: ownerHouseCity,
    owner_state: ownerHouseState,
    owner_zip_code: ownerHouseZip,
    dataset_run_date: normalizeDate(row.dobrundate),
    permit_si_no: permitNumber,
    bldg_type: normalizeText(row.bldg_type),
    residential: normalizeText(row.residential),
    special_district_1: normalizeText(row.special_district_1),
    special_district_2: normalizeText(row.special_district_2),
    permittee_first_name: normalizeText(row.permittee_s_first_name),
    permittee_last_name: normalizeText(row.permittee_s_last_name),
    permittee_business_name: normalizeText(row.permittee_s_business_name),
    permittee_phone: normalizeText(row.permittee_s_phone__),
    permittee_license_type: normalizeText(row.permittee_s_license_type),
    permittee_license_number: normalizeText(row.permittee_s_license__),
    permittee_other_title: normalizeText(row.permittee_s_other_title),
    act_as_superintendent: normalizeText(row.act_as_superintendent),
    hic_license: normalizeText(row.hic_license),
    site_safety_mgr_first_name: normalizeText(row.site_safety_mgr_s_first_name),
    site_safety_mgr_last_name: normalizeText(row.site_safety_mgr_s_last_name),
    site_safety_mgr_business_name: normalizeText(row.site_safety_mgr_business_name),
    superintendent_name: normalizeText(row.superintendent_first___last_na || row.superintendent_name),
    superintendent_business_name: normalizeText(row.superintendent_business_name),
    metadata: row,
  }
}

function mapDobJobApplication(row: OpenDataRow, datasetId: string, ctx: LocationContext): BuildingPermitPayload | null {
  const jobNumber =
    normalizeText(row.job__ || row.job_number || row.job) ||
    normalizeText(row.jobno) ||
    normalizeText(row.job_)
  if (!jobNumber) return null

  const docNumber = normalizeText(row.doc__ || row.doc_number || row.doc) || ''
  const borough = normalizeText(row.borough) || ctx.borough
  const block = normalizeText(row.block) || ctx.block
  const lot = normalizeText(row.lot) || ctx.lot
  const bin = normalizeText(row.bin__ || row.bin) || ctx.bin
  const bbl = normalizeText(row.bbl) || ctx.bbl || buildBbl(borough, block, lot)
  const deviceId =
    extractDeviceIdentifier(row.job_description) ||
    extractDeviceIdentifier(row.proposed_work) ||
    extractDeviceIdentifier(row.filing_description)

  return {
    org_id: ctx.orgId,
    property_id: ctx.propertyId || null,
    building_id: ctx.buildingId || null,
    source: 'dob_job_applications',
    dataset_id: datasetId,
    source_record_id: normalizeText(row.objectid || row.id || `${jobNumber}-${docNumber}`) || jobNumber,
    job_filing_number: jobNumber,
    job_number: jobNumber,
    work_permit: '',
    sequence_number: docNumber,
    job_doc_number: docNumber,
    device_identifier: deviceId || null,
    job_type: normalizeText(row.job_type),
    filing_status: normalizeText(row.job_status || row.filing_status),
    work_type: normalizeText(row.work_type),
    house_no: normalizeText(row.house_no || row.house__),
    street_name: normalizeText(row.street_name),
    borough,
    block,
    lot,
    bin,
    zip_code: normalizeText(row.zip_code),
    bbl,
    filing_date: normalizeDate(row.filing_date),
    approved_date: normalizeDate(row.latest_action_date || row.approved_date),
    job_description: normalizeText(row.job_description || row.proposed_work),
    applicant_license: normalizeText(row.applicant_license),
    applicant_name: combineName(row.applicant_s_first_name, row.applicant_s_last_name),
    owner_name: normalizeText(row.owner_s_name || row.owner_name),
    owner_business_name: normalizeText(row.owner_business_name),
    latitude: normalizeNumber(row.latitude),
    longitude: normalizeNumber(row.longitude),
    community_board: normalizeNumber(row.community_board),
    council_district: normalizeNumber(row.council_district),
    census_tract: normalizeNumber(row.census_tract),
    nta: normalizeText(row.nta),
    metadata: row,
  }
}

function mapDepWaterSewerPermit(row: OpenDataRow, datasetId: string, ctx: LocationContext): BuildingPermitPayload | null {
  const permitNumber = normalizeText(row.permitnumber)
  if (!permitNumber) return null

  const borough = normalizeText(row.propertyborough) || ctx.borough
  const block =
    normalizeText(row.propertylot) || // propertylot maps from tax_block (new dataset)
    normalizeText(row.block) ||
    ctx.block
  const lot =
    normalizeText(row.propertyblock) || // propertyblock maps from tax_lot (new dataset)
    normalizeText(row.lot) ||
    ctx.lot
  const bin = ctx.bin
  const bbl = ctx.bbl || buildBbl(borough, block, lot)

  return {
    org_id: ctx.orgId,
    property_id: ctx.propertyId || null,
    building_id: ctx.buildingId || null,
    source: 'dep_water_sewer_permits',
    dataset_id: datasetId,
    source_record_id: permitNumber,
    job_filing_number: permitNumber,
    job_number: permitNumber,
    work_permit: permitNumber,
    sequence_number: '',
    work_type: normalizeText(row.applicationtype),
    permit_status: normalizeText(row.requeststatus),
    borough,
    block,
    lot,
    bin,
    zip_code: normalizeText(row.propertyzip),
    bbl,
    approved_date: normalizeDate(row.issuancedate),
    issued_date: normalizeDate(row.issuancedate),
    metadata: row,
  }
}

function mapDobElevatorPermitApplication(row: OpenDataRow, datasetId: string, ctx: LocationContext): BuildingPermitPayload | null {
  const jobFilingNumber =
    normalizeText(row.job_filing_number) ||
    normalizeText(row.job_number) ||
    normalizeText(row.filing_number)
  if (!jobFilingNumber) return null

  const filingNumber = normalizeText(row.filing_number) || ''
  const borough = normalizeText(row.borough) || ctx.borough
  const block = normalizeText(row.block) || ctx.block
  const lot = normalizeText(row.lot) || ctx.lot
  const bin = normalizeText(row.bin) || ctx.bin
  const bbl = normalizeText(row.bbl) || ctx.bbl || buildBbl(borough, block, lot)

  return {
    org_id: ctx.orgId,
    property_id: ctx.propertyId || null,
    building_id: ctx.buildingId || null,
    source: 'dob_elevator_permit_applications',
    dataset_id: datasetId,
    source_record_id: normalizeText(row.objectid || row.id || filingNumber || jobFilingNumber),
    job_filing_number: jobFilingNumber,
    job_number: normalizeText(row.job_number) || jobFilingNumber,
    work_permit: filingNumber,
    sequence_number: '',
    device_identifier: normalizeText(row.elevatordevicetype) || null,
    filing_status: normalizeText(row.filing_status),
    work_type: normalizeText(row.filing_type || row.elevatordevicetype),
    house_no: normalizeText(row.house_number),
    street_name: normalizeText(row.street_name),
    borough,
    block,
    lot,
    bin,
    zip_code: normalizeText(row.zip),
    bbl,
    filing_date: normalizeDate(row.filing_date),
    approved_date: normalizeDate(row.permit_entire_date || row.plan_examiner_assigned_date || row.filing_date),
    issued_date: normalizeDate(row.signedoff_date),
    job_description: normalizeText(row.descriptionofwork),
    applicant_name: combineName(row.applicant_firstname, row.applicant_lastname),
    applicant_business_name: normalizeText(row.applicant_businessname),
    applicant_license: normalizeText(row.applicant_license_number),
    owner_name: combineName(row.owner_firstname, row.owner_lastname) || normalizeText(row.owner_businessname),
    owner_business_name: normalizeText(row.owner_businessname),
    owner_state: normalizeText(row.owner_state),
    owner_city: normalizeText(row.owner_city),
    owner_zip_code: normalizeText(row.owner_zip),
    tracking_number: normalizeText(row.electrical_permit_number),
    latitude: normalizeNumber(row.latitude),
    longitude: normalizeNumber(row.longitude),
    community_board: normalizeNumber(row.community_district_number),
    council_district: normalizeNumber(row.city_council_district),
    census_tract: normalizeNumber(row.census_tract),
    nta: normalizeText(row.nta_name),
    metadata: row,
  }
}

function mapHpdRegistration(row: OpenDataRow, datasetId: string, ctx: LocationContext): BuildingPermitPayload | null {
  const registrationId = normalizeText(row.registrationid || row.registration_id || row.id)
  if (!registrationId) return null

  const borough = normalizeText(row.boro) || ctx.borough
  const block = normalizeText(row.block) || ctx.block
  const lot = normalizeText(row.lot) || ctx.lot
  const bin = normalizeText(row.bin) || ctx.bin
  const bbl = normalizeText(row.bbl) || ctx.bbl || buildBbl(borough, block, lot)

  return {
    org_id: ctx.orgId,
    property_id: ctx.propertyId || null,
    building_id: ctx.buildingId || null,
    source: 'hpd_registrations',
    dataset_id: datasetId,
    source_record_id: registrationId,
    job_filing_number: registrationId,
    job_number: registrationId,
    work_permit: registrationId,
    sequence_number: '',
    work_type: 'HPD Registration',
    permit_status: 'Registered',
    house_no: normalizeText(row.housenumber || row.lowhousenumber || row.highhousenumber),
    street_name: normalizeText(row.streetname),
    borough,
    block,
    lot,
    bin,
    zip_code: normalizeText(row.zip),
    bbl,
    approved_date: normalizeDate(row.lastregistrationdate),
    issued_date: normalizeDate(row.registrationenddate),
    job_description: 'Annual HPD registration',
    metadata: row,
  }
}

function mapDobNowSafetyFacadePermit(row: OpenDataRow, datasetId: string, ctx: LocationContext): BuildingPermitPayload | null {
  const filingNumber =
    normalizeText(row.tr6_no) ||
    normalizeText(row.control_no) ||
    normalizeText(row.sequence_no) ||
    normalizeText(row.bin)
  if (!filingNumber) return null

  const borough = normalizeText(row.borough) || ctx.borough
  const block = normalizeText(row.block) || ctx.block
  const lot = normalizeText(row.lot) || ctx.lot
  const bin = normalizeText(row.bin) || ctx.bin
  const bbl = normalizeText(row.bbl) || ctx.bbl || buildBbl(borough, block, lot)

  return {
    org_id: ctx.orgId,
    property_id: ctx.propertyId || null,
    building_id: ctx.buildingId || null,
    source: 'dob_now_safety_facade',
    dataset_id: datasetId,
    source_record_id: filingNumber,
    job_filing_number: filingNumber,
    job_number: filingNumber,
    work_permit: normalizeText(row.sequence_no) || '',
    sequence_number: normalizeText(row.sequence_no) || '',
    work_type: normalizeText(row.filing_type || row.cycle),
    permit_status: normalizeText(row.current_status || row.filing_status),
    house_no: normalizeText(row.house_no),
    street_name: normalizeText(row.street_name),
    borough,
    block,
    lot,
    bin,
    zip_code: normalizeText(row.zip),
    bbl,
    filing_date: normalizeDate(row.submitted_on || row.filing_date),
    approved_date: normalizeDate(row.submitted_on || row.filing_date),
    issued_date: null,
    job_description: normalizeText(row.comments),
    metadata: row,
  }
}

export async function syncBuildingPermitsFromOpenData(options: {
  orgId: string
  propertyId?: string | null
  bin?: string | null
  bbl?: string | null
  includeSources?: PermitSource[]
}): Promise<{ results: SyncResult[] }> {
  const sources = options.includeSources?.length ? options.includeSources : DEFAULT_SOURCES
  const ctx = await resolveLocation(options.orgId, options.propertyId, options.bin, options.bbl)
  const results: SyncResult[] = []
  const config = await getNYCOpenDataConfig(options.orgId)
  const client = new NYCOpenDataClient({
    nycOpenDataBaseUrl: config.baseUrl,
    nycOpenDataApiKey: config.appToken || undefined,
    appToken: config.appToken || undefined,
    datasets: config.datasets,
  })

  if (sources.includes('dob_now_build_approved_permits')) {
    const stats: SyncResult = { source: 'dob_now_build_approved_permits', inserted: 0, updated: 0, skipped: 0, errors: [] }
    try {
      let offset = 0
      while (true) {
        const rows = await client.fetchDOBNowApprovedPermits({
          bin: ctx.bin || undefined,
          bbl: ctx.bbl || undefined,
          block: ctx.block || undefined,
          lot: ctx.lot || undefined,
          limit: PAGE_SIZE,
          offset,
        })
        if (!rows.length) break
        offset += rows.length
        for (const row of rows) {
          try {
            const payload = mapDobNowApprovedPermit(row, config.datasets.dobNowApprovedPermits, ctx)
            if (!payload) {
              stats.skipped += 1
              continue
            }
            await upsertBuildingPermit(payload, stats)
          } catch (error) {
            logger.error({ error, row }, 'Failed to upsert DOB NOW approved permit')
            stats.errors.push(error instanceof Error ? error.message : String(error))
          }
        }
        if (rows.length < PAGE_SIZE) break
      }
    } catch (error) {
      logger.error({ error, ctx }, 'Failed to fetch DOB NOW approved permits')
      stats.errors.push(error instanceof Error ? error.message : String(error))
    }
    results.push(stats)
  }

  if (sources.includes('dob_permit_issuance_old')) {
    const stats: SyncResult = { source: 'dob_permit_issuance_old', inserted: 0, updated: 0, skipped: 0, errors: [] }
    try {
      let offset = 0
      while (true) {
        const rows = await client.fetchDOBPermitIssuanceOld({
          bin: ctx.bin || undefined,
          bbl: ctx.bbl || undefined,
          block: ctx.block || undefined,
          lot: ctx.lot || undefined,
          borough: ctx.borough || undefined,
          limit: PAGE_SIZE,
          offset,
        })
        if (!rows.length) break
        offset += rows.length
        for (const row of rows) {
          try {
            const payload = mapDobPermitIssuanceOld(row, config.datasets.dobPermitIssuanceOld, ctx)
            if (!payload) {
              stats.skipped += 1
              continue
            }
            await upsertBuildingPermit(payload, stats)
          } catch (error) {
            logger.error({ error, row }, 'Failed to upsert DOB BIS permit')
            stats.errors.push(error instanceof Error ? error.message : String(error))
          }
        }
        if (rows.length < PAGE_SIZE) break
      }
    } catch (error) {
      logger.error({ error, ctx }, 'Failed to fetch DOB Permit Issuance (OLD)')
      stats.errors.push(error instanceof Error ? error.message : String(error))
    }
    results.push(stats)
  }

  if (sources.includes('dob_job_applications')) {
    const stats: SyncResult = { source: 'dob_job_applications', inserted: 0, updated: 0, skipped: 0, errors: [] }
    try {
      let offset = 0
      while (true) {
        const rows = await client.fetchDOBJobApplications({
          bin: ctx.bin || undefined,
          bbl: ctx.bbl || undefined,
          block: ctx.block || undefined,
          lot: ctx.lot || undefined,
          borough: ctx.borough || undefined,
          limit: PAGE_SIZE,
          offset,
        })
        if (!rows.length) break
        offset += rows.length
        for (const row of rows) {
          try {
            const payload = mapDobJobApplication(row, config.datasets.dobJobApplications, ctx)
            if (!payload) {
              stats.skipped += 1
              continue
            }
            await upsertBuildingPermit(payload, stats)
          } catch (error) {
            logger.error({ error, row }, 'Failed to upsert DOB job application')
            stats.errors.push(error instanceof Error ? error.message : String(error))
          }
        }
        if (rows.length < PAGE_SIZE) break
      }
    } catch (error) {
      logger.error({ error, ctx }, 'Failed to fetch DOB Job Application Filings')
      stats.errors.push(error instanceof Error ? error.message : String(error))
    }
    results.push(stats)
  }

  if (sources.includes('dob_elevator_permit_applications')) {
    const stats: SyncResult = { source: 'dob_elevator_permit_applications', inserted: 0, updated: 0, skipped: 0, errors: [] }
    try {
      let offset = 0
      while (true) {
        const rows = await client.fetchDOBElevatorPermitApplications({
          bin: ctx.bin || undefined,
          bbl: ctx.bbl || undefined,
          block: ctx.block || undefined,
          lot: ctx.lot || undefined,
          limit: PAGE_SIZE,
          offset,
        })
        if (!rows.length) break
        offset += rows.length
        for (const row of rows) {
          try {
            const payload = mapDobElevatorPermitApplication(row, config.datasets.dobElevatorPermitApplications, ctx)
            if (!payload) {
              stats.skipped += 1
              continue
            }
            await upsertBuildingPermit(payload, stats)
          } catch (error) {
            logger.error({ error, row }, 'Failed to upsert DOB Elevator Permit Application')
            stats.errors.push(error instanceof Error ? error.message : String(error))
          }
        }
        if (rows.length < PAGE_SIZE) break
      }
    } catch (error) {
      logger.error({ error, ctx }, 'Failed to fetch DOB Elevator Permit Applications')
      stats.errors.push(error instanceof Error ? error.message : String(error))
    }
    results.push(stats)
  }

  if (sources.includes('hpd_registrations')) {
    const stats: SyncResult = { source: 'hpd_registrations', inserted: 0, updated: 0, skipped: 0, errors: [] }
    try {
      const rows = await client.fetchHPDRegistrations({
        bin: ctx.bin || undefined,
        boro: ctx.borough || undefined,
        block: ctx.block || undefined,
        lot: ctx.lot || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      })
      for (const row of rows) {
        try {
          const payload = mapHpdRegistration(row, config.datasets.hpdRegistrations, ctx)
          if (!payload) {
            stats.skipped += 1
            continue
          }
          await upsertBuildingPermit(payload, stats)
        } catch (error) {
          logger.error({ error, row }, 'Failed to upsert HPD registration')
          stats.errors.push(error instanceof Error ? error.message : String(error))
        }
      }
    } catch (error) {
      logger.error({ error, ctx }, 'Failed to fetch HPD registrations')
      stats.errors.push(error instanceof Error ? error.message : String(error))
    }
    results.push(stats)
  }

  if (sources.includes('dep_water_sewer_permits')) {
    const stats: SyncResult = { source: 'dep_water_sewer_permits', inserted: 0, updated: 0, skipped: 0, errors: [] }

    if (!ctx.block || !ctx.lot) {
      stats.errors.push('Missing tax block/lot; skipped DEP Water & Sewer permits')
      results.push(stats)
    } else {
      try {
        let offset = 0
        while (true) {
          const rows = await client.fetchDEPWaterSewerPermits({
            taxBlock: ctx.block,
            taxLot: ctx.lot,
            limit: PAGE_SIZE,
            offset,
          })
          if (!rows.length) break
          offset += rows.length
          for (const row of rows) {
            try {
              const payload = mapDepWaterSewerPermit(row, config.datasets.waterSewer, ctx)
              if (!payload) {
                stats.skipped += 1
                continue
              }
              await upsertBuildingPermit(payload, stats)
            } catch (error) {
              logger.error({ error, row }, 'Failed to upsert DEP Water & Sewer permit')
              stats.errors.push(error instanceof Error ? error.message : String(error))
            }
          }
          if (rows.length < PAGE_SIZE) break
        }
      } catch (error) {
        logger.error({ error, ctx }, 'Failed to fetch DEP Water & Sewer permits')
        stats.errors.push(error instanceof Error ? error.message : String(error))
      }
      results.push(stats)
    }
  }

  if (sources.includes('dep_water_sewer_permits_old')) {
    const stats: SyncResult = { source: 'dep_water_sewer_permits_old', inserted: 0, updated: 0, skipped: 0, errors: [] }

    if (!ctx.block || !ctx.lot) {
      stats.errors.push('Missing tax block/lot; skipped DEP Water & Sewer permits (OLD)')
      results.push(stats)
    } else {
      try {
        let offset = 0
        while (true) {
          const rows = await client.fetchDEPWaterSewerPermitsOld({
            taxBlock: ctx.block,
            taxLot: ctx.lot,
            limit: PAGE_SIZE,
            offset,
          })
          if (!rows.length) break
          offset += rows.length
          for (const row of rows) {
            try {
              const payload = mapDepWaterSewerPermit(row, config.datasets.waterSewerOld, ctx)
              if (!payload) {
                stats.skipped += 1
                continue
              }
              await upsertBuildingPermit(payload, stats)
            } catch (error) {
              logger.error({ error, row }, 'Failed to upsert DEP Water & Sewer permit (OLD)')
              stats.errors.push(error instanceof Error ? error.message : String(error))
            }
          }
          if (rows.length < PAGE_SIZE) break
        }
      } catch (error) {
        logger.error({ error, ctx }, 'Failed to fetch DEP Water & Sewer permits (OLD)')
        stats.errors.push(error instanceof Error ? error.message : String(error))
      }
      results.push(stats)
    }
  }

  if (sources.includes('dob_now_safety_facade')) {
    const stats: SyncResult = { source: 'dob_now_safety_facade', inserted: 0, updated: 0, skipped: 0, errors: [] }
    try {
      let offset = 0
      while (true) {
        const rows = await client.fetchDOBNowSafetyFacadeFilings({
          bin: ctx.bin || undefined,
          limit: PAGE_SIZE,
          offset,
        })
        if (!rows.length) break
        offset += rows.length
        for (const row of rows) {
          try {
            const payload = mapDobNowSafetyFacadePermit(row, config.datasets.dobNowSafetyFacade, ctx)
            if (!payload) {
              stats.skipped += 1
              continue
            }
            await upsertBuildingPermit(payload, stats)
          } catch (error) {
            logger.error({ error, row }, 'Failed to upsert DOB NOW Safety Facade filing')
            stats.errors.push(error instanceof Error ? error.message : String(error))
          }
        }
        if (rows.length < PAGE_SIZE) break
      }
    } catch (error) {
      logger.error({ error, ctx }, 'Failed to fetch DOB NOW Safety Facade filings')
      stats.errors.push(error instanceof Error ? error.message : String(error))
    }
    results.push(stats)
  }

  return { results }
}
