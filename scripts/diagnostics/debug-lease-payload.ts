import { mapLeaseToBuildium } from '@/lib/buildium-mappers'
import { supabase, supabaseAdmin } from '@/lib/db'
import { mapCountryToBuildium } from '@/lib/buildium-mappers'

async function run() {
  const db = supabaseAdmin || supabase
  const leaseId = 7
  const { data: lease } = await db.from('lease').select('*').eq('id', leaseId).single()
  if (!lease) throw new Error('lease not found')

  const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  let propertyId = toNumber(lease.buildium_property_id ?? (lease as any).PropertyId)
  let propertyAddress: any = null
  if (lease.property_id) {
    const { data: prop } = await db
      .from('properties')
      .select('buildium_property_id, address_line1, address_line2, city, state, postal_code, country')
      .eq('id', lease.property_id)
      .maybeSingle()
    propertyAddress = prop
    if (!propertyId && prop?.buildium_property_id != null) {
      const converted = toNumber(prop.buildium_property_id)
      if (converted != null) propertyId = converted
    }
  }

  console.log('propertyId', propertyId)

  let rentAmount = toNumber(lease.rent_amount)
  if (rentAmount == null) {
    const leaseIdNumber = Number(lease.id)
    if (!Number.isNaN(leaseIdNumber)) {
      const { data: rentSchedule } = await db
        .from('rent_schedules')
        .select('total_amount')
        .eq('lease_id', leaseIdNumber)
        .order('start_date', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (rentSchedule?.total_amount != null) {
        rentAmount = toNumber(rentSchedule.total_amount)
      }
    }
  }
  if (rentAmount == null) rentAmount = 0

  const unitBuildiumIdRaw = toNumber(lease.buildium_unit_id)
  let unitBuildiumId = unitBuildiumIdRaw
  let unitNumber = (lease as any).unit_number || null
  if (!unitBuildiumId && lease.unit_id) {
    const { data: unitRow } = await db
      .from('units')
      .select('buildium_unit_id, unit_number')
      .eq('id', lease.unit_id)
      .maybeSingle()
    if (unitRow?.buildium_unit_id != null) {
      const converted = toNumber(unitRow.buildium_unit_id)
      if (converted != null) unitBuildiumId = converted
    }
    if (!unitNumber && unitRow?.unit_number) unitNumber = unitRow.unit_number
  }

  const basePayload = mapLeaseToBuildium({
    ...lease,
    buildium_property_id: propertyId,
    buildium_unit_id: unitBuildiumId ?? null,
    rent_amount: rentAmount,
    unit_number: unitNumber ?? (lease as any).unit_number ?? null
  })
  if (unitBuildiumId) basePayload.UnitId = unitBuildiumId

  console.log('basePayload', basePayload)

  const { data: leaseContacts } = await db
    .from('lease_contacts')
    .select(`
      role,
      tenant_id,
      tenants:tenants (
        buildium_tenant_id,
        contact:contacts (
          is_company,
          first_name,
          last_name,
          company_name,
          primary_email,
          primary_phone,
          alt_phone,
          primary_address_line_1,
          primary_address_line_2,
          primary_city,
          primary_state,
          primary_postal_code,
          primary_country
        )
      )
    `)
    .eq('lease_id', leaseId)

  const tenantIds = new Set<number>()
  const tenantDetails: any[] = []

  const leaseStart = lease.lease_from_date ?? (lease as any).StartDate
  const moveInDate = leaseStart ? new Date(String(leaseStart)).toISOString().slice(0, 10) : undefined

  const fallback = propertyAddress || {}

  for (const contactRow of leaseContacts || []) {
    if ((contactRow?.role || '').toLowerCase() !== 'tenant') continue
    const tenantRecord = Array.isArray(contactRow.tenants) ? contactRow.tenants[0] : contactRow.tenants
    if (!tenantRecord) continue
    const buildiumTenantId = tenantRecord.buildium_tenant_id
    if (buildiumTenantId) {
      const numericId = Number(buildiumTenantId)
      if (!Number.isNaN(numericId)) tenantIds.add(numericId)
      continue
    }
    const contact = Array.isArray(tenantRecord.contact) ? tenantRecord.contact[0] : tenantRecord.contact
    if (!contact) continue

    const isCompany = Boolean(contact.is_company)
    const firstName = (contact.first_name || (!isCompany ? '' : contact.company_name) || 'Tenant').trim()
    const lastName = (contact.last_name || (isCompany ? 'Company' : 'Tenant')).trim()
    const email = contact.primary_email ? String(contact.primary_email).trim() : undefined

    const phoneNumbers: any[] = []
    if (contact.primary_phone) phoneNumbers.push({ Number: String(contact.primary_phone), Type: 'Mobile' })
    if (contact.alt_phone) phoneNumbers.push({ Number: String(contact.alt_phone), Type: phoneNumbers.length ? 'Other' : 'Mobile' })

    const addressLine1 = contact.primary_address_line_1 || fallback.address_line1 || 'Unknown Address'
    const addressLine2 = contact.primary_address_line_2 || fallback.address_line2 || undefined
    const city = contact.primary_city || fallback.city || 'Unknown'
    const state = contact.primary_state || fallback.state || 'NA'
    const postal = contact.primary_postal_code || fallback.postal_code || '00000'
    const country = mapCountryToBuildium(contact.primary_country || fallback.country || 'United States') || 'UnitedStates'

    const primaryAddress: any = {
      AddressLine1: String(addressLine1),
      City: String(city),
      State: String(state),
      PostalCode: String(postal),
      Country: country
    }
    if (addressLine2) primaryAddress.AddressLine2 = String(addressLine2)

    const tenantPayload: any = {
      FirstName: firstName || 'Tenant',
      LastName: lastName || 'Tenant',
      PrimaryAddress: primaryAddress,
      LeaseTenantStatus: 'Current',
      IsRentResponsible: true,
      IsPrimaryTenant: true,
      OccupantType: 'Tenant'
    }

    if (email) tenantPayload.Email = email
    if (phoneNumbers.length) tenantPayload.PhoneNumbers = phoneNumbers
    if (moveInDate) tenantPayload.MoveInDate = moveInDate
    if (isCompany) tenantPayload.IsCompany = true

    tenantDetails.push(tenantPayload)
  }

  console.log('tenantIds', Array.from(tenantIds))
  console.log('tenantDetails', JSON.stringify(tenantDetails, null, 2))

  if (tenantDetails.length) basePayload.Tenants = tenantDetails
  if (tenantIds.size) basePayload.TenantIds = Array.from(tenantIds)

  console.log('final payload', JSON.stringify(basePayload, null, 2))
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
