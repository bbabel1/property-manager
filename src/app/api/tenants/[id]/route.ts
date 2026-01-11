import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/db'
import { requireAuth } from '@/lib/auth/guards'
import { resolveResourceOrg, requireOrgAdmin } from '@/lib/auth/org-guards'
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client'
import type { BuildiumTenant } from '@/types/buildium'
import { mapCountryToBuildium } from '@/lib/buildium-mappers'

type AllowedTenantFields =
  | 'tax_id'
  | 'comment'
  | 'emergency_contact_name'
  | 'emergency_contact_email'
  | 'emergency_contact_phone'
  | 'emergency_contact_relationship'

const ALLOWED_FIELDS: AllowedTenantFields[] = [
  'tax_id',
  'comment',
  'emergency_contact_name',
  'emergency_contact_email',
  'emergency_contact_phone',
  'emergency_contact_relationship'
]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing tenant id' }, { status: 400 })
    }

    // Resolve org and enforce admin-level access for writes
    const resolvedOrg = await resolveResourceOrg(auth.supabase, 'tenant', id)
    if (!resolvedOrg.ok) {
      return NextResponse.json({ success: false, error: resolvedOrg.error }, { status: 404 })
    }
    await requireOrgAdmin({
      client: auth.supabase,
      adminClient: supabaseAdmin,
      userId: auth.user.id,
      orgId: resolvedOrg.orgId,
      orgRoles: auth.orgRoles,
      roles: auth.roles
    })

    const payload = (await request.json()) as Record<string, unknown>
    const updates: Record<string, unknown> = {}

    for (const field of ALLOWED_FIELDS) {
      if (field in payload) {
        const value = payload[field]
        updates[field] = value ?? null
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields provided' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    // Fetch tenant with contact info for FirstName/LastName (required fields)
    const { data: updatedTenant, error } = await supabaseAdmin
      .from('tenants')
      .update(updates)
      .eq('id', id)
      .eq('org_id', resolvedOrg.orgId)
      .select(`
        id, 
        buildium_tenant_id, 
        tax_id, 
        comment, 
        emergency_contact_name, 
        emergency_contact_email, 
        emergency_contact_phone, 
        emergency_contact_relationship,
        sms_opt_in_status,
        contact:contacts!tenants_contact_id_fkey (
          first_name,
          last_name,
          primary_email,
          alt_email,
          primary_phone,
          alt_phone,
          date_of_birth,
          primary_address_line_1,
          primary_address_line_2,
          primary_address_line_3,
          primary_city,
          primary_state,
          primary_postal_code,
          primary_country,
          alt_address_line_1,
          alt_address_line_2,
          alt_address_line_3,
          alt_city,
          alt_state,
          alt_postal_code,
          alt_country
        )
      `)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    let buildiumSyncError: string | null = null
    if (updatedTenant?.buildium_tenant_id) {
      const edgeClient = await getOrgScopedBuildiumEdgeClient(resolvedOrg.orgId)

      const contact = (updatedTenant as any)?.contact || {}
      const firstName = contact.first_name?.trim() || ''
      const lastName = contact.last_name?.trim() || ''
      if (!firstName || !lastName) {
        buildiumSyncError = 'FirstName and LastName are required but not found in local database'
        console.error('Missing required fields for Buildium update:', {
          tenantId: id,
          buildiumTenantId: updatedTenant.buildium_tenant_id,
          firstName,
          lastName
        })
      } else {
        const normalizePhone = (raw: unknown): string | null => {
          if (!raw) return null
          const digits = String(raw).replace(/\D+/g, '')
          if (!digits) return null
          if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1)
          return digits.length >= 10 && digits.length <= 20 ? digits : null
        }

        const normalizeString = (value: unknown): string | null => {
          if (value === null || value === undefined) return null
          const t = String(value).trim()
          return t ? t : null
        }

        const normalizeCountry = (country: unknown) => mapCountryToBuildium(normalizeString(country))

        const buildAddressFromContact = (c: Record<string, unknown>) => {
          const addr = {
            AddressLine1: normalizeString(c.primary_address_line_1),
            AddressLine2: normalizeString(c.primary_address_line_2),
            AddressLine3: normalizeString(c.primary_address_line_3),
            City: normalizeString(c.primary_city),
            State: normalizeString(c.primary_state),
            PostalCode: normalizeString(c.primary_postal_code),
            Country: normalizeCountry(c.primary_country),
          }
          return addr
        }

        const buildAltAddressFromContact = (c: Record<string, unknown>) => {
          const addr = {
            AddressLine1: normalizeString(c.alt_address_line_1),
            AddressLine2: normalizeString(c.alt_address_line_2),
            AddressLine3: normalizeString(c.alt_address_line_3),
            City: normalizeString(c.alt_city),
            State: normalizeString(c.alt_state),
            PostalCode: normalizeString(c.alt_postal_code),
            Country: normalizeCountry(c.alt_country),
          }
          return addr
        }

        // Build payload entirely from local database data (no GET request)
        const basePayload: Record<string, unknown> = {
          FirstName: firstName,
          LastName: lastName,
          Email: normalizeString(contact.primary_email),
          AlternateEmail: normalizeString(contact.alt_email),
        }

        // Build PhoneNumbers from local contact data
        const phoneNumbers: Record<string, string> = {}
        const mobile = normalizePhone(contact.primary_phone)
        const work = normalizePhone(contact.alt_phone)
        if (mobile) phoneNumbers.Mobile = mobile
        if (work) phoneNumbers.Work = work
        if (Object.keys(phoneNumbers).length) basePayload.PhoneNumbers = phoneNumbers

        // DateOfBirth
        if (contact.date_of_birth) {
          const dob = new Date(String(contact.date_of_birth))
          if (!Number.isNaN(dob.getTime())) {
            basePayload.DateOfBirth = dob.toISOString().slice(0, 10)
          }
        }

        // SMSOptInStatus
        basePayload.SMSOptInStatus =
          typeof updatedTenant.sms_opt_in_status === 'boolean'
            ? updatedTenant.sms_opt_in_status
            : null

        // Address (required)
        const primaryAddress = buildAddressFromContact(contact)
        const hasPrimaryAddress = Boolean(primaryAddress.AddressLine1 && primaryAddress.City && primaryAddress.PostalCode && primaryAddress.Country)
        if (hasPrimaryAddress) {
          const mappedCountry = normalizeCountry(primaryAddress.Country) ?? 'UnitedStates'
          basePayload.Address = {
            AddressLine1: primaryAddress.AddressLine1,
            AddressLine2: primaryAddress.AddressLine2,
            AddressLine3: primaryAddress.AddressLine3,
            City: primaryAddress.City,
            State: primaryAddress.State,
            PostalCode: primaryAddress.PostalCode,
            Country: mappedCountry
          }
          basePayload.MailingPreference = 'PrimaryAddress'
        } else {
          buildiumSyncError = 'Address is required for Buildium tenant update; contact is missing primary address'
        }

        // AlternateAddress (optional)
        const alternateAddress = buildAltAddressFromContact(contact)
        const hasAlternateAddress = Boolean(alternateAddress.AddressLine1)
        if (hasAlternateAddress) {
          basePayload.AlternateAddress = {
            AddressLine1: alternateAddress.AddressLine1,
            AddressLine2: alternateAddress.AddressLine2,
            AddressLine3: alternateAddress.AddressLine3,
            City: alternateAddress.City,
            State: alternateAddress.State,
            PostalCode: alternateAddress.PostalCode,
            Country: normalizeCountry(alternateAddress.Country) ?? 'UnitedStates'
          }
        }

        if ('tax_id' in updates) {
          const taxIdValue = updates.tax_id
          basePayload.TaxId =
            taxIdValue !== null && taxIdValue !== undefined && String(taxIdValue).trim()
              ? String(taxIdValue).trim()
              : null
        }

        if ('comment' in updates) {
          const commentValue = updates.comment
          basePayload.Comment =
            commentValue !== null && commentValue !== undefined && String(commentValue).trim()
              ? String(commentValue).trim()
              : null
        }

        const hasEmergencyContactUpdate =
          'emergency_contact_name' in updates ||
          'emergency_contact_email' in updates ||
          'emergency_contact_phone' in updates ||
          'emergency_contact_relationship' in updates

        if (hasEmergencyContactUpdate) {
          const emergencyContact: Record<string, unknown> = {}
          if ('emergency_contact_name' in updates) {
            emergencyContact.Name = updates.emergency_contact_name ? String(updates.emergency_contact_name).trim() : null
          }
          if ('emergency_contact_email' in updates) {
            emergencyContact.Email = updates.emergency_contact_email ? String(updates.emergency_contact_email).trim() : null
          }
          if ('emergency_contact_phone' in updates) {
            const phone = normalizePhone(updates.emergency_contact_phone)
            emergencyContact.Phone = phone ?? (updates.emergency_contact_phone ? String(updates.emergency_contact_phone).trim() : null)
          }
          if ('emergency_contact_relationship' in updates) {
            emergencyContact.RelationshipDescription = updates.emergency_contact_relationship
              ? String(updates.emergency_contact_relationship).trim()
              : null
          }

          // Remove undefined values, but keep null for explicit clears
          const cleaned = Object.fromEntries(
            Object.entries(emergencyContact).filter(([, v]) => v !== undefined)
          )
          
          // Only include EmergencyContact if it has at least one non-null field
          // If all fields are null, set to null to clear the emergency contact
          if (Object.keys(cleaned).length > 0 && Object.values(cleaned).some(v => v !== null)) {
            basePayload.EmergencyContact = cleaned
          } else {
            // All fields are null - clear the emergency contact
            basePayload.EmergencyContact = null
          }
        }

      const clean = (obj: Record<string, unknown>) =>
          Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
        const payloadClean = clean(basePayload)

        // Ensure country normalization on final payload to avoid Buildium enum errors
        if (payloadClean.Address && typeof payloadClean.Address === 'object') {
          const addr = payloadClean.Address as Record<string, unknown>
          addr.Country = normalizeCountry(addr.Country) ?? 'UnitedStates'
          addr.AddressLine2 = normalizeString(addr.AddressLine2)
          addr.AddressLine3 = normalizeString(addr.AddressLine3)
        }
        if (payloadClean.AlternateAddress && typeof payloadClean.AlternateAddress === 'object') {
          const addr = payloadClean.AlternateAddress as Record<string, unknown>
          addr.Country = normalizeCountry(addr.Country) ?? 'UnitedStates'
          addr.AddressLine2 = normalizeString(addr.AddressLine2)
          addr.AddressLine3 = normalizeString(addr.AddressLine3)
        }

        if (!payloadClean.Address || !payloadClean.FirstName || !payloadClean.LastName) {
          buildiumSyncError =
            buildiumSyncError ||
            'Missing required fields (FirstName, LastName, Address) for Buildium tenant update'
        } else {
        const res = await edgeClient.updateTenantInBuildium(
          Number(updatedTenant.buildium_tenant_id),
          payloadClean
        )

        if (!res.success) {
          buildiumSyncError = res.error || 'Failed to sync tenant to Buildium'
            console.error('Buildium tenant update failed:', {
              tenantId: id,
              buildiumTenantId: updatedTenant.buildium_tenant_id,
              payload: JSON.stringify(payloadClean, null, 2),
              error: res.error
            })
          }
        }
      }
    }

    return NextResponse.json(
      { success: true, buildium_sync_error: buildiumSyncError || undefined },
      { status: 200 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
