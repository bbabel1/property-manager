import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

import { mapVendorFromBuildiumWithCategory } from '@/lib/buildium-mappers'
import { rateLimitedBuildiumRequest } from '@/lib/buildium-rate-limiter'
import type { BuildiumVendor } from '@/types/buildium'
import type { Database } from '@/types/database'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Supabase environment variables are missing. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.')
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

async function fetchBuildiumVendor(vendorId: number): Promise<BuildiumVendor> {
  console.log(`🔍 Fetching Buildium vendor ${vendorId}...`)

  return rateLimitedBuildiumRequest(async () => {
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/vendors/${vendorId}`
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID ?? '',
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET ?? '',
      },
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`Failed to fetch vendor from Buildium: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const vendor = (await response.json()) as BuildiumVendor
    const name = vendor.CompanyName || vendor.ContactName || vendor.Name || `Vendor ${vendor.Id}`
    console.log(`✅ Retrieved Buildium vendor ${vendor.Id}: ${name}`)
    return vendor
  })
}

async function fetchAndAddBuildiumVendor(vendorId: number) {
  try {
    const buildiumVendor = await fetchBuildiumVendor(vendorId)

    const { data: existingVendor, error: findError } = await supabase
      .from('vendors')
      .select('id')
      .eq('buildium_vendor_id', vendorId)
      .maybeSingle()

    if (findError) {
      throw findError
    }

    console.log('🔄 Mapping Buildium vendor payload into local schema...')
    const localData = await mapVendorFromBuildiumWithCategory(buildiumVendor, supabase)
    const now = new Date().toISOString()

    if (localData.contact_id == null) {
      throw new Error('Mapped vendor is missing contact_id; cannot upsert without contact reference')
    }
    const contactId = localData.contact_id
    const taxPayerType: 'SSN' | 'EIN' | null = localData.tax_payer_type === 'SSN' || localData.tax_payer_type === 'EIN'
      ? localData.tax_payer_type
      : null
    const normalizedData = { ...localData, contact_id: contactId, tax_payer_type: taxPayerType }

    if (existingVendor) {
      console.log(`✏️ Vendor already exists (id: ${existingVendor.id}). Updating record...`)
      const updatePayload = { ...normalizedData, updated_at: now }
      const { data: updated, error: updateError } = await supabase
        .from('vendors')
        .update(updatePayload)
        .eq('id', existingVendor.id)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }

      console.log('✅ Vendor updated successfully:', {
        id: updated.id,
        buildium_vendor_id: updated.buildium_vendor_id,
        vendor_category: updated.vendor_category,
        contact_id: updated.contact_id,
        insurance_expiration_date: updated.insurance_expiration_date,
      })

      return updated
    }

    console.log('➕ Vendor not found locally. Creating new record...')
    const insertPayload = { ...normalizedData, created_at: now, updated_at: now }
    const { data: created, error: insertError } = await supabase
      .from('vendors')
      .insert(insertPayload)
      .select()
      .single()

    if (insertError) {
      throw insertError
    }

    console.log('✅ Vendor created successfully:', {
      id: created.id,
      buildium_vendor_id: created.buildium_vendor_id,
      vendor_category: created.vendor_category,
      contact_id: created.contact_id,
      insurance_expiration_date: created.insurance_expiration_date,
    })

    return created
  } catch (error) {
    console.error('❌ Failed to import Buildium vendor:', error)
    throw error
  }
}

if (require.main === module) {
  const [idArg] = process.argv.slice(2)
  const vendorId = Number.parseInt(idArg ?? '', 10)

  if (!Number.isFinite(vendorId)) {
    console.error('❌ Invalid vendor ID. Usage: npx tsx scripts/buildium/create/fetch-and-add-buildium-vendor.ts <vendorId>')
    process.exit(1)
  }

  fetchAndAddBuildiumVendor(vendorId)
    .then(() => {
      console.log('🎯 Vendor import script completed successfully.')
      process.exit(0)
    })
    .catch(() => {
      console.error('💥 Vendor import script failed.')
      process.exit(1)
    })
}

export { fetchAndAddBuildiumVendor }
