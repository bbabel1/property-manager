import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/db'
import { getServerSupabaseClient } from '@/lib/supabase-client'
import { logger } from '@/lib/logger'
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'
import { buildiumSync } from '@/lib/buildium-sync'
import { getOrgGlSettingsOrThrow } from '@/lib/gl-settings'
import { createCharge } from '@/lib/posting-service'
import { generateRecurringCharges } from '@/lib/recurring-engine'
import { normalizeCountry, normalizeCountryWithDefault } from '@/lib/normalizers'
import { Pool, type PoolClient } from 'pg'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { BuildiumLease } from '@/types/buildium'

type ContactRow = Database['public']['Tables']['contacts']['Row']
type LeaseContactRow = Database['public']['Tables']['lease_contacts']['Row']
type LeaseRow = Database['public']['Tables']['lease']['Row']

type LeaseContactWithTenant = LeaseContactRow & {
  tenants?: {
    id: string
    contact: Pick<ContactRow, 'display_name' | 'first_name' | 'last_name' | 'company_name' | 'is_company'> | null
  } | null
}

type LeaseWithContacts = LeaseRow & {
  lease_contacts?: LeaseContactWithTenant[] | null
}

type StagedPerson = {
  role?: string | null
  same_as_unit?: boolean | null
  same_as_unit_address?: boolean | null
  addr1?: string | null
  addr2?: string | null
  city?: string | null
  state?: string | null
  postal?: string | null
  country?: string | null
  first_name?: string | null
  last_name?: string | null
  email?: string | null
  phone?: string | null
  alt_phone?: string | null
  alt_email?: string | null
  alt_addr1?: string | null
  alt_addr2?: string | null
  alt_city?: string | null
  alt_state?: string | null
  alt_postal?: string | null
  alt_country?: string | null
}

const nullIfEmpty = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

const normalizeEmail = (value: string | null | undefined): string | null => {
  const normalized = nullIfEmpty(value)
  return normalized ? normalized.toLowerCase() : null
}

const cleanNullable = (value: unknown): unknown | null => {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' && value.trim() === '') return null
  return value
}

// Normalize UI rent cycle labels to DB enum values
// DB enum: 'Monthly' | 'Weekly' | 'Every2Weeks' | 'Quarterly' | 'Yearly' | 'Every2Months' | 'Daily' | 'Every6Months'
const mapRentCycleToDbEnum = (value: unknown): string => {
  const v = typeof value === 'string' ? value.trim().toLowerCase() : ''
  switch (v) {
    case 'weekly':
      return 'Weekly'
    case 'biweekly':
    case 'bi-weekly':
    case 'every2weeks':
      return 'Every2Weeks'
    case 'quarterly':
      return 'Quarterly'
    case 'annually':
    case 'annual':
    case 'yearly':
      return 'Yearly'
    case 'every2months':
    case 'every 2 months':
      return 'Every2Months'
    case 'daily':
      return 'Daily'
    case 'every6months':
    case 'every 6 months':
      return 'Every6Months'
    default:
      return 'Monthly'
  }
}

let legacyPool: Pool | null = null

const getLegacyPool = (): Pool | null => {
  if (legacyPool) return legacyPool
  const directUrl = process.env.SUPABASE_DB_URL
  const password = process.env.SUPABASE_DB_PASSWORD
  const projectRef = process.env.SUPABASE_PROJECT_REF_PRODUCTION
  const connectionString = directUrl || (password && projectRef
    ? `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`
    : null)
  if (!connectionString) return null
  legacyPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
  })
  return legacyPool
}

type JsonLike = Record<string, unknown>

type JsonbPayload = {
  lease: JsonLike
  contacts?: JsonLike[]
  rent_schedules?: JsonLike[]
  recurring_transactions?: JsonLike[]
  documents?: JsonLike[]
}

type LegacyLeaseInsertResult = {
  lease: JsonLike
  contacts: JsonLike[]
  rent_schedules: JsonLike[]
  recurring_transactions: JsonLike[]
  documents: JsonLike[]
}

const fetchTableColumns = async (client: PoolClient, table: string): Promise<Set<string>> => {
  const { rows } = await client.query<{
    column_name: string
  }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
    [table]
  )
  return new Set(rows.map((r) => r.column_name))
}

const tableExists = async (client: PoolClient, table: string): Promise<boolean> => {
  const { rowCount } = await client.query(
    `SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=$1 LIMIT 1`,
    [table]
  )
  return Boolean(rowCount)
}

async function createLeaseLegacyTransactional(payload: JsonbPayload): Promise<LegacyLeaseInsertResult> {
  const pool = getLegacyPool()
  if (!pool) {
    throw new Error('Database connection not configured for legacy lease create fallback')
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const now = new Date().toISOString()
    const leaseColumns = await fetchTableColumns(client, 'lease')
    const leaseValues: unknown[] = []
    const leaseFields: string[] = []

    const pushLeaseField = (field: string, value: unknown) => {
      if (!leaseColumns.has(field)) return
      leaseFields.push(field)
      leaseValues.push(cleanNullable(value))
    }

    pushLeaseField('property_id', payload.lease.property_id)
    pushLeaseField('unit_id', payload.lease.unit_id)
    pushLeaseField('lease_from_date', payload.lease.lease_from_date)
    pushLeaseField('lease_to_date', payload.lease.lease_to_date)
    pushLeaseField('lease_type', payload.lease.lease_type)
    pushLeaseField('term_type', payload.lease.term_type)
    pushLeaseField('payment_due_day', payload.lease.payment_due_day)
    pushLeaseField('security_deposit', payload.lease.security_deposit)
    pushLeaseField('rent_amount', payload.lease.rent_amount)
    pushLeaseField('lease_charges', payload.lease.lease_charges)
    pushLeaseField('prorated_first_month_rent', payload.lease.prorated_first_month_rent)
    pushLeaseField('prorated_last_month_rent', payload.lease.prorated_last_month_rent)
    pushLeaseField('renewal_offer_status', payload.lease.renewal_offer_status)
    pushLeaseField('status', payload.lease.status ?? 'active')
    pushLeaseField('automatically_move_out_tenants', payload.lease.automatically_move_out_tenants)
    pushLeaseField('current_number_of_occupants', payload.lease.current_number_of_occupants)
    pushLeaseField('org_id', payload.lease.org_id)
    pushLeaseField('created_at', now)
    pushLeaseField('updated_at', now)

    if (leaseColumns.has('unit_number') && payload.lease.unit_number) {
      pushLeaseField('unit_number', payload.lease.unit_number)
    }

    const leasePlaceholders = leaseFields.map((_, idx) => `$${idx + 1}`)
    const { rows: leaseRows } = await client.query(
      `INSERT INTO public.lease (${leaseFields.join(', ')}) VALUES (${leasePlaceholders.join(', ')}) RETURNING *`,
      leaseValues
    )
    const leaseRow = leaseRows[0]
    const leaseId = leaseRow?.id
    if (!leaseId) {
      throw new Error('Lease insert failed in legacy fallback')
    }

    const leaseContacts: JsonLike[] = []
    const rentSchedules: JsonLike[] = []
    const recurringTemplates: JsonLike[] = []

    const contactsColumns = await fetchTableColumns(client, 'lease_contacts')

    for (const contact of payload.contacts ?? []) {
      const contactFields: string[] = []
      const contactValues: unknown[] = []
      const addContactField = (field: string, value: unknown) => {
        if (!contactsColumns.has(field)) return
        contactFields.push(field)
        contactValues.push(field === 'is_rent_responsible' ? Boolean(value) : cleanNullable(value))
      }

      addContactField('lease_id', leaseId)
      addContactField('tenant_id', contact.tenant_id)
      addContactField('role', contact.role ?? 'Tenant')
      addContactField('status', contact.status ?? 'Active')
      addContactField('move_in_date', contact.move_in_date)
      addContactField('move_out_date', contact.move_out_date)
      addContactField('notice_given_date', contact.notice_given_date)
      addContactField('is_rent_responsible', contact.is_rent_responsible ?? false)
      addContactField('created_at', now)
      addContactField('updated_at', now)
      addContactField('org_id', payload.lease.org_id)

      const placeholders = contactFields.map((_, idx) => `$${idx + 1}`)
      const { rows } = await client.query(
        `INSERT INTO public.lease_contacts (${contactFields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
        contactValues
      )
      leaseContacts.push(rows[0])
    }

    if (await tableExists(client, 'rent_schedules')) {
      const rentScheduleColumns = await fetchTableColumns(client, 'rent_schedules')
      for (const schedule of payload.rent_schedules ?? []) {
        const scheduleFields: string[] = []
        const scheduleValues: unknown[] = []
        const addScheduleField = (field: string, value: unknown) => {
          if (!rentScheduleColumns.has(field)) return
          scheduleFields.push(field)
          scheduleValues.push(field === 'backdate_charges' ? Boolean(value) : cleanNullable(value))
        }

        addScheduleField('lease_id', leaseId)
        addScheduleField('start_date', schedule.start_date)
        addScheduleField('end_date', schedule.end_date)
        addScheduleField('total_amount', schedule.total_amount)
        addScheduleField('rent_cycle', schedule.rent_cycle ?? 'Monthly')
        addScheduleField('status', schedule.status ?? 'Current')
        addScheduleField('backdate_charges', schedule.backdate_charges ?? false)
        addScheduleField('created_at', now)
        addScheduleField('updated_at', now)

        const placeholders = scheduleFields.map((_, idx) => `$${idx + 1}`)
        const { rows } = await client.query(
          `INSERT INTO public.rent_schedules (${scheduleFields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
          scheduleValues
        )
        rentSchedules.push(rows[0])
      }
    }

    let recurringTable: string | null = null
    if (await tableExists(client, 'recurring_transactions')) {
      recurringTable = 'recurring_transactions'
    } else if (await tableExists(client, 'lease_recurring_transactions')) {
      recurringTable = 'lease_recurring_transactions'
    }

    if (recurringTable) {
      const recurringColumns = await fetchTableColumns(client, recurringTable)
      for (const template of payload.recurring_transactions ?? []) {
        const isLegacyTable = recurringTable === 'lease_recurring_transactions'
        const fields: string[] = []
        const values: unknown[] = []
        const addField = (field: string, value: unknown) => {
          if (!recurringColumns.has(field)) return
          fields.push(field)
          values.push(cleanNullable(value))
        }

        if (!recurringColumns.has('lease_id')) {
          throw new Error(`lease_id column missing on ${recurringTable}`)
        }

        addField('lease_id', leaseId)
        if (isLegacyTable) {
          addField('description', template.memo ?? 'Recurring Charge')
        } else {
          addField('memo', template.memo)
        }
        addField('frequency', template.frequency ?? 'Monthly')
        addField('amount', template.amount)
        addField('start_date', template.start_date)
        addField('end_date', template.end_date)
        addField('gl_account_id', template.gl_account_id)
        addField('created_at', now)
        addField('updated_at', now)

        const placeholders = fields.map((_, idx) => `$${idx + 1}`)
        const { rows } = await client.query(
          `INSERT INTO public.${recurringTable} (${fields.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
          values
        )
        recurringTemplates.push(rows[0])
      }
    }

    await client.query('COMMIT')

    return {
      lease: leaseRow,
      contacts: leaseContacts,
      rent_schedules: rentSchedules,
      recurring_transactions: recurringTemplates,
      documents: []
    }
  } catch (legacyErr) {
    await client.query('ROLLBACK')
    throw legacyErr
  } finally {
    client.release()
  }
}

async function createContactsForNewPeople(
  client: SupabaseClient<Database>,
  staged: StagedPerson[],
  propertyId: string,
  unitId: string
): Promise<{ contacts: Array<{ tenant_id: string; role: string; is_rent_responsible: boolean }> }> {
  if (!staged.length) {
    return { contacts: [] }
  }

  const { data: propertyRow } = await client
    .from('properties')
    .select('address_line1, address_line2, city, state, postal_code, country, org_id')
    .eq('id', propertyId)
    .maybeSingle()

  const { data: unitRow } = await client
    .from('units')
    .select('unit_number, property_id')
    .eq('id', unitId)
    .maybeSingle()

  let resolvedOrgId = propertyRow?.org_id ?? null

  if (!resolvedOrgId && unitRow?.property_id) {
    const { data: parentProperty } = await client
      .from('properties')
      .select('org_id, address_line1, address_line2, city, state, postal_code, country')
      .eq('id', unitRow.property_id)
      .maybeSingle()
    if (parentProperty) {
      resolvedOrgId = parentProperty.org_id ?? resolvedOrgId
    }
  }

  const fallbackAddr2 = propertyRow?.address_line2 ?? (unitRow?.unit_number ? `Unit ${unitRow.unit_number}` : null)
  const normalizedPropertyCountry = normalizeCountryWithDefault(propertyRow?.country ?? undefined)

  const contacts: Array<{ tenant_id: string; role: string; is_rent_responsible: boolean }> = []
  const nowIso = new Date().toISOString()

  for (const person of staged) {
    const role = typeof person.role === 'string' ? person.role : 'Tenant'
    const sameAsUnit = Boolean(person.same_as_unit ?? person.same_as_unit_address ?? true)
    const email = normalizeEmail(person.email)

    let contactId: number | null = null

    if (email) {
      const { data: existingContact } = await client
        .from('contacts')
        .select('id')
        .or(`primary_email.eq.${email},primary_email.eq.${email.toUpperCase()}`)
        .maybeSingle()

      if (existingContact?.id) {
        contactId = existingContact.id
      }
    }

    if (!contactId) {
      const primaryAddressLine1 = sameAsUnit ? propertyRow?.address_line1 : nullIfEmpty(person.addr1)
      const primaryAddressLine2 = sameAsUnit ? fallbackAddr2 : nullIfEmpty(person.addr2)
      const primaryCity = sameAsUnit ? propertyRow?.city : nullIfEmpty(person.city)
      const primaryState = sameAsUnit ? propertyRow?.state : nullIfEmpty(person.state)
      const primaryPostal = sameAsUnit ? propertyRow?.postal_code : nullIfEmpty(person.postal)
      const primaryCountry = sameAsUnit
        ? normalizedPropertyCountry
        : normalizeCountry(person.country)

      const { data: newContact, error: contactError } = await client
        .from('contacts')
        .insert({
          is_company: false,
          first_name: nullIfEmpty(person.first_name),
          last_name: nullIfEmpty(person.last_name),
          primary_email: email,
          primary_phone: nullIfEmpty(person.phone),
          alt_phone: nullIfEmpty(person.alt_phone),
          alt_email: normalizeEmail(person.alt_email),
          primary_address_line_1: primaryAddressLine1,
          primary_address_line_2: primaryAddressLine2,
          primary_city: primaryCity,
          primary_state: primaryState,
          primary_postal_code: primaryPostal,
          primary_country: primaryCountry,
          alt_address_line_1: nullIfEmpty(person.alt_addr1),
          alt_address_line_2: nullIfEmpty(person.alt_addr2),
          alt_city: nullIfEmpty(person.alt_city),
          alt_state: nullIfEmpty(person.alt_state),
          alt_postal_code: nullIfEmpty(person.alt_postal),
          alt_country: normalizeCountry(person.alt_country)
        })
        .select('id')
        .single()

      if (contactError || !newContact) {
        if (contactError?.code === '23505' && email) {
          const { data: deduped } = await client
            .from('contacts')
            .select('id')
            .or(`primary_email.eq.${email},primary_email.eq.${email.toUpperCase()}`)
            .maybeSingle()
          if (!deduped?.id) {
            throw new Error(contactError.message || 'Failed to create contact for staged tenant')
          }
          contactId = deduped.id
        } else {
          throw new Error(contactError?.message || 'Failed to create contact for staged tenant')
        }
      } else {
        contactId = newContact.id
      }
    }

    const { data: tenantRow, error: _tenantLookupError } = await client
      .from('tenants')
      .select('id')
      .eq('contact_id', contactId)
      .maybeSingle()

    let tenantId = tenantRow?.id ?? null

    if (!tenantId) {
      const { data: newTenant, error: tenantError } = await client
        .from('tenants')
        .insert({
          contact_id: contactId,
          org_id: resolvedOrgId,
          created_at: nowIso,
          updated_at: nowIso
        })
        .select('id')
        .single()

      if (tenantError || !newTenant) {
        throw new Error(tenantError?.message || 'Failed to create tenant for staged contact')
      }
      tenantId = newTenant.id
    }

    contacts.push({
      tenant_id: tenantId,
      role,
      is_rent_responsible: role === 'Tenant'
    })
  }

  return { contacts }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const propertyId = searchParams.get('propertyId')
    const unitId = searchParams.get('unitId')

    const baseSelect = `*, lease_contacts(role, tenants( id, contact:contacts(display_name, first_name, last_name, company_name, is_company) ))`
    const db = supabaseAdmin || supabase

    let query = db
      .from('lease')
      .select(baseSelect)
      .order('updated_at', { ascending: false })
    if (status) query = query.eq('status', status)
    if (propertyId) query = query.eq('property_id', propertyId)
    if (unitId) query = query.eq('unit_id', unitId)

    const { data, error } = await query.returns<LeaseWithContacts[]>()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const mapped = (data || []).map((lease) => {
      const contacts = Array.isArray(lease.lease_contacts) ? lease.lease_contacts : []
      const tenantNames = contacts
        .filter((contact) => (contact.role ?? '').toLowerCase() === 'tenant')
        .map((contact) => {
          const contactRecord = contact.tenants?.contact
          if (!contactRecord) return null
          const combinedName = [contactRecord.first_name, contactRecord.last_name]
            .filter((part): part is string => Boolean(part))
            .join(' ')
            .trim()
          return (
            contactRecord.display_name ||
            contactRecord.company_name ||
            combinedName ||
            'Tenant'
          )
        })
        .filter((name): name is string => Boolean(name))
      return {
        ...lease,
        tenant_name: tenantNames.join(', '),
        lease_contacts: undefined
      }
    })
    const propertyIds = Array.from(
      new Set(
        mapped
          .map((lease) => lease.property_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    )
    const unitIds = Array.from(
      new Set(
        mapped
          .map((lease) => lease.unit_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    )

    type PropertySummary = {
      id: string
      name?: string | null
      address_line1?: string | null
      city?: string | null
      state?: string | null
      postal_code?: string | null
    }

    type UnitSummary = {
      id: string
      unit_number?: string | null
      unit_name?: string | null
    }

    const propertyMap = new Map<string, PropertySummary>()
    const unitMap = new Map<string, UnitSummary>()

    if (propertyIds.length > 0) {
      const { data: properties, error: propertyError } = await db
        .from('properties')
        .select('id, name, address_line1, city, state, postal_code')
        .in('id', propertyIds)
      if (propertyError) {
        logger.warn(
          { error: propertyError, propertyIds },
          'Failed to load properties for lease list'
        )
      } else {
        for (const property of properties || []) {
          if (property?.id) propertyMap.set(property.id, property)
        }
      }
    }

    if (unitIds.length > 0) {
      const { data: units, error: unitError } = await db
        .from('units')
        .select('id, unit_number, unit_name')
        .in('id', unitIds)
      if (unitError) {
        logger.warn({ error: unitError, unitIds }, 'Failed to load units for lease list')
      } else {
        for (const unit of units || []) {
          if (unit?.id) unitMap.set(unit.id, unit)
        }
      }
    }

    const enriched = mapped.map((lease) => {
      const property = lease.property_id ? propertyMap.get(lease.property_id) : undefined
      const unit = lease.unit_id ? unitMap.get(lease.unit_id) : undefined
      return {
        ...lease,
        unit_number: lease.unit_number ?? unit?.unit_number ?? null,
        property_name: property?.name ?? null,
        property_address_line1: property?.address_line1 ?? null,
        property_city: property?.city ?? null,
        property_state: property?.state ?? null,
        property_postal_code: property?.postal_code ?? null,
        unit_name: unit?.unit_name ?? null
      }
    })

    return NextResponse.json(enriched)
  } catch (e) {
    logger.error({ error: e }, 'Error listing leases from DB')
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const strict = url.searchParams.get('strict') === 'true'
    const body = await request.json()
    const syncBuildium = (url.searchParams.get('syncBuildium') === 'true') || Boolean(body?.syncBuildium)

    // Resolve local property/unit UUIDs if Buildium IDs provided
    let { property_id, unit_id } = body
    if (!property_id && body.buildium_property_id) {
      const { data } = await supabase.from('properties').select('id').eq('buildium_property_id', body.buildium_property_id).single()
      property_id = data?.id
    }
    if (!unit_id && body.buildium_unit_id) {
      const { data } = await supabase.from('units').select('id').eq('buildium_unit_id', body.buildium_unit_id).single()
      unit_id = data?.id
    }

    if (!property_id || !unit_id) {
      return NextResponse.json({ error: 'property_id and unit_id (or corresponding Buildium IDs) are required' }, { status: 400 })
    }

    const admin = getServerSupabaseClient()

    // Resolve org_id early for both payload and idempotency scoping
    const { data: propertyRowForOrg } = await (supabaseAdmin || supabase)
      .from('properties')
      .select('org_id')
      .eq('id', property_id)
      .maybeSingle()
    const resolvedOrgId = propertyRowForOrg?.org_id ?? null

    const idemKey =
      request.headers.get('Idempotency-Key') ||
      `lease:${property_id}:${unit_id}:${body.lease_from_date}:${body.lease_to_date || ''}`

    if (idemKey && resolvedOrgId) {
      const nowIso = new Date().toISOString()
      try {
        const { data: idem } = await admin
          .from('idempotency_keys')
          .select('response')
          .eq('key', idemKey)
          .eq('org_id', resolvedOrgId)
          .gte('expires_at', nowIso)
          .maybeSingle()
        if (idem?.response) {
          // Touch last_used_at but do not block response on failure
          try {
            await admin
              .from('idempotency_keys')
              .update({ last_used_at: nowIso })
              .eq('key', idemKey)
              .eq('org_id', resolvedOrgId)
          } catch {}
          return NextResponse.json(idem.response, { status: 201 })
        }
      } catch {}
    }

    const storeIdempotencyResponse = async (response: unknown) => {
      if (!idemKey || !resolvedOrgId) return
      const now = new Date()
      const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      try {
        await admin
          .from('idempotency_keys')
          .upsert(
            {
              key: idemKey,
              org_id: resolvedOrgId,
              response,
              last_used_at: now.toISOString(),
              expires_at: expires.toISOString(),
            },
            { onConflict: 'key' },
          )
      } catch {}
    }

    const payload = {
      lease: {
        property_id, unit_id,
        lease_from_date: body.lease_from_date,
        lease_to_date: body.lease_to_date ?? null,
        lease_type: body.lease_type ?? 'Fixed',
        payment_due_day: body.payment_due_day ?? null,
        security_deposit: body.security_deposit ?? null,
        rent_amount: body.rent_amount ?? null,
        lease_charges: nullIfEmpty(body.lease_charges),
        prorated_first_month_rent: body.prorated_first_month_rent ?? null,
        prorated_last_month_rent: body.prorated_last_month_rent ?? null,
        renewal_offer_status: body.renewal_offer_status ?? null,
        status: body.status || 'active',
        org_id: resolvedOrgId
      },
      contacts: Array.isArray(body.contacts) ? body.contacts : [],
      rent_schedules: Array.isArray(body.rent_schedules) ? body.rent_schedules : [],
      recurring_transactions: Array.isArray(body.recurring_transactions) ? body.recurring_transactions : [],
      documents: Array.isArray(body.documents) ? body.documents : []
    }
    // Use transactional wrapper function if available
    if (Array.isArray(body.new_people) && body.new_people.length) {
     try {
        const { data: fullRes, error: fullErr } = await admin.rpc('fn_create_lease_full', { payload, new_people: body.new_people })
        if (fullErr) throw fullErr
        const lease_id_full = fullRes?.lease_id
        const { data: lease } = await admin.from('lease').select('*').eq('id', lease_id_full).single()
        const { data: contacts } = await admin.from('lease_contacts').select('*').eq('lease_id', lease_id_full)
        const { data: schedules } = await admin.from('rent_schedules').select('*').eq('lease_id', lease_id_full)
        const { data: recurs } = await admin.from('recurring_transactions').select('*').eq('lease_id', lease_id_full)
        const { getLeaseDocumentsCompat } = await import('@/lib/files')
        const docs = await getLeaseDocumentsCompat(admin, lease_id_full)
        const response = { lease, contacts, rent_schedules: schedules, recurring_transactions: recurs, documents: docs }
        await storeIdempotencyResponse(response)
        return NextResponse.json(response, { status: 201 })
      } catch (wrapErr) {
        // Fallback to legacy aggregate if wrapper not available
        const fallbackMessage = wrapErr instanceof Error
          ? wrapErr.message
          : typeof wrapErr === 'object' && wrapErr && 'error' in wrapErr && typeof (wrapErr as { error?: { message?: string } }).error?.message === 'string'
            ? (wrapErr as { error: { message: string } }).error.message
            : JSON.stringify(wrapErr)
        logger.warn({ err: fallbackMessage, rawError: wrapErr }, 'fn_create_lease_full not available, falling back')
        const stagedPeople = (Array.isArray(body.new_people) ? body.new_people : []) as StagedPerson[]
        if (stagedPeople.length) {
          const { contacts: stagedContacts } = await createContactsForNewPeople(
            admin,
            stagedPeople,
            String(property_id),
            String(unit_id)
          )
          payload.contacts = [...(payload.contacts || []), ...stagedContacts]
        }
      }
    }
    const { data: fnRes, error: fnErr } = await admin.rpc('fn_create_lease_aggregate', { payload })

    let lease_id = fnRes?.lease_id as string | number | null
    let lease: JsonLike | null = null
    let contacts: JsonLike[] | null = null
    let schedules: JsonLike[] | null = null
    let recurs: JsonLike[] | null = null
    let docs: JsonLike[] | null = null

    if (fnErr) {
      const errorMessage = fnErr.message ?? ''
      const isSchemaMismatch = fnErr.code === '42703' || /does not exist/i.test(errorMessage)
      const isMissingOrgContext = fnErr.code === 'P0001' && /org_id cannot be null/i.test(errorMessage)
      if (isSchemaMismatch || isMissingOrgContext) {
        logger.warn(
          { err: fnErr.message, code: fnErr.code },
          isMissingOrgContext
            ? 'fn_create_lease_aggregate missing org context, attempting legacy fallback'
            : 'fn_create_lease_aggregate schema mismatch, attempting legacy fallback'
        )
        const legacyResult = await createLeaseLegacyTransactional(payload)
        lease = legacyResult.lease
        contacts = legacyResult.contacts
        schedules = legacyResult.rent_schedules
        recurs = legacyResult.recurring_transactions
        docs = legacyResult.documents
        lease_id = typeof legacyResult.lease?.id === 'string' || typeof legacyResult.lease?.id === 'number' ? legacyResult.lease.id : null
      } else {
        return NextResponse.json({ error: 'Failed creating lease', details: fnErr.message }, { status: 500 })
      }
    } else {
      const { data: leaseRow } = await admin.from('lease').select('*').eq('id', lease_id).single()
      const { data: contactRows } = await admin.from('lease_contacts').select('*').eq('lease_id', lease_id)
      const { data: scheduleRows } = await admin.from('rent_schedules').select('*').eq('lease_id', lease_id)
      const { data: recurringRows } = await admin.from('recurring_transactions').select('*').eq('lease_id', lease_id)
      const { getLeaseDocumentsCompat } = await import('@/lib/files')
      const documentRows = await getLeaseDocumentsCompat(admin, lease_id as number)
      lease = leaseRow
      contacts = contactRows
      schedules = scheduleRows
      recurs = recurringRows
      docs = documentRows
    }

    if (!lease_id || !lease) {
      throw new Error('Lease creation did not return an ID')
    }

    // Seed accounting: recurring rent template + one-time deposit/proration charges
    try {
      const orgId = (lease as any)?.org_id as string | null
      if (orgId) {
        const gl = await getOrgGlSettingsOrThrow(orgId)

        // 1) Ensure a recurring rent template exists when rent_amount is present
        const rentAmount = Number((lease as any)?.rent_amount ?? body.rent_amount ?? 0) || 0
        if (rentAmount > 0) {
          const { data: existingRecurs } = await (admin || supabase)
            .from('recurring_transactions')
            .select('id')
            .eq('lease_id', lease_id)
            .limit(1)
          if (!existingRecurs || existingRecurs.length === 0) {
            // Compute a reasonable start_date: prefer provided schedule, else anchor to payment_due_day relative to lease_from_date
            let start_date: string | null = null
            const providedStart = Array.isArray(payload.rent_schedules) && (payload.rent_schedules as any[])[0]?.start_date
            if (providedStart) start_date = String(providedStart)
            else {
              const leaseStart: string | null = (lease as any)?.lease_from_date ?? null
              const dueDay: number | null = (lease as any)?.payment_due_day ?? null
              if (leaseStart && dueDay) {
                const d = new Date(String(leaseStart) + 'T00:00:00Z')
                const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
                const anchoredDay = Math.min(dueDay, maxDay)
                const tentative = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), anchoredDay))
                const start = tentative < d
                  ? new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, Math.min(anchoredDay, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0)).getUTCDate())))
                  : tentative
                start_date = start.toISOString().slice(0, 10)
              } else if (leaseStart) {
                start_date = String(leaseStart)
              }
            }

            await (admin || supabase)
              .from('recurring_transactions')
              .insert({
                lease_id: lease_id as number,
                frequency: 'Monthly',
                amount: rentAmount,
                memo: 'Monthly rent',
                start_date: start_date || null,
              })
          }

          // Ensure a rent_schedules row exists for this lease
          const { data: existingSchedules } = await (admin || supabase)
            .from('rent_schedules')
            .select('id')
            .eq('lease_id', lease_id)
            .limit(1)
          if (!existingSchedules || existingSchedules.length === 0) {
            let scheduleStart: string | null = null
            const providedScheduleStart = Array.isArray(payload.rent_schedules) && (payload.rent_schedules as any[])[0]?.start_date
            if (providedScheduleStart) scheduleStart = String(providedScheduleStart)
            else {
              const leaseStart: string | null = (lease as any)?.lease_from_date ?? null
              scheduleStart = leaseStart ? String(leaseStart) : null
            }
            const scheduleEnd: string | null = (lease as any)?.lease_to_date ?? null
            const scheduleCycleRaw: unknown = (Array.isArray(payload.rent_schedules) && (payload.rent_schedules as any[])[0]?.rent_cycle) || 'Monthly'
            const scheduleCycle = mapRentCycleToDbEnum(scheduleCycleRaw)
            const { error: scheduleInsertError } = await (admin || supabase)
              .from('rent_schedules')
              .insert({
                lease_id: lease_id as number,
                start_date: scheduleStart,
                end_date: scheduleEnd,
                total_amount: rentAmount,
                rent_cycle: scheduleCycle,
                backdate_charges: false,
              })
            if (scheduleInsertError) {
              logger.warn({ leaseId: lease_id, error: scheduleInsertError.message }, 'Failed to insert rent schedule (enum mismatch?)')
            }
          }
        }

        // 2) One-time security deposit charge (A/R vs Deposit Liability)
        const securityDeposit = Number((lease as any)?.security_deposit ?? body.security_deposit ?? 0) || 0
        if (securityDeposit > 0) {
          const depIdem = `lease:init:deposit:${lease_id}`
          const { data: depExists } = await (admin || supabase)
            .from('transactions').select('id').eq('idempotency_key', depIdem).maybeSingle()
          if (!depExists?.id) {
            const chargeDate: string = ((lease as any)?.lease_from_date || new Date().toISOString().slice(0, 10))
            await createCharge({
              lease_id: lease_id as number,
              date: chargeDate,
              memo: 'Security deposit',
              idempotency_key: depIdem,
              lines: [
                { gl_account_id: gl.ar_lease, amount: securityDeposit, dr_cr: 'DR' },
                { gl_account_id: gl.tenant_deposit_liability, amount: securityDeposit, dr_cr: 'CR' },
              ],
            })
          }
        }

        // 3) Optional prorated first month rent (one-time)
        const prorated = Number((lease as any)?.prorated_first_month_rent ?? body.prorated_first_month_rent ?? 0) || 0
        if (prorated > 0) {
          const proIdem = `lease:init:prorate:${lease_id}`
          const { data: proExists } = await (admin || supabase)
            .from('transactions').select('id').eq('idempotency_key', proIdem).maybeSingle()
          if (!proExists?.id) {
            const chargeDate: string = ((lease as any)?.lease_from_date || new Date().toISOString().slice(0, 10))
            await createCharge({
              lease_id: lease_id as number,
              date: chargeDate,
              memo: 'Prorated first month rent',
              idempotency_key: proIdem,
              lines: [
                { gl_account_id: gl.ar_lease, amount: prorated, dr_cr: 'DR' },
                { gl_account_id: gl.rent_income, amount: prorated, dr_cr: 'CR' },
              ],
            })
          }
        }

        // 4) Generate near-term recurring charges now (idempotent to idempotency_key scheme in generator)
        await generateRecurringCharges(60)
      }
    } catch (seedErr) {
      // Do not fail lease creation if accounting seeding fails; include warning in response logs
      logger.warn({ error: seedErr instanceof Error ? seedErr.message : String(seedErr) }, 'Lease accounting seeding failed')
    }

    let buildium: BuildiumLease | null = null
    let buildiumWarning: { warning: string } | null = null
    if (syncBuildium) {
      const rentScheduleCtx = Array.isArray(payload.rent_schedules) && payload.rent_schedules.length
        ? payload.rent_schedules[0]
        : undefined
      const recurringList = Array.isArray(payload.recurring_transactions)
        ? payload.recurring_transactions
        : []
      const rentTemplateCtx = recurringList.find(
        (row: any) => typeof row?.frequency === 'string' && row.frequency.toLowerCase() !== 'onetime'
      )
      const depositTemplateCtx = recurringList.find(
        (row: any) => typeof row?.frequency === 'string' && row.frequency.toLowerCase() === 'onetime'
      )

      const syncResult = await buildiumSync.syncLeaseToBuildium({
        ...lease,
        // Default true when syncing if not explicitly provided
        send_welcome_email: (typeof body?.send_welcome_email === 'boolean') ? body.send_welcome_email : true,
      }, {
        rentTemplate: rentTemplateCtx,
        depositTemplate: depositTemplateCtx,
        rentSchedule: rentScheduleCtx
      })
      if (syncResult.success) {
        if (syncResult.buildiumId) {
          const leaseFetch = await buildiumEdgeClient.getLeaseFromBuildium(syncResult.buildiumId)
          if (leaseFetch.success && leaseFetch.data) {
            buildium = leaseFetch.data as BuildiumLease
          }
        }
      } else {
        const warningMessage = syncResult.error || 'Buildium create failed'
        buildiumWarning = { warning: warningMessage }
        await admin.from('lease').update({ sync_status: 'error', last_sync_error: warningMessage, last_sync_attempt_at: new Date().toISOString() }).eq('id', lease_id)
        await admin.from('lease_sync_queue').insert({ lease_id, idempotency_key: idemKey, last_error: warningMessage })
        if (strict) return NextResponse.json({ error: 'Buildium sync failed', details: warningMessage }, { status: 502 })
      }
    }

    const response = { lease, contacts, rent_schedules: schedules, recurring_transactions: recurs, documents: docs, ...(buildium ? { buildium } : {}), ...(buildiumWarning ? { buildiumSync: buildiumWarning } : {}) }
    await storeIdempotencyResponse(response)
    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : JSON.stringify(error)
    logger.error({ error, message }, 'Error creating lease')
    return NextResponse.json({ error: 'Internal error', details: message }, { status: 500 })
  }
}
