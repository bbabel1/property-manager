import { NextResponse } from 'next/server'

import { supabase, supabaseAdmin } from '@/lib/db'

export async function PATCH(request: Request, { params }: { params: Promise<{ vendorId: string }> }) {
  const { vendorId } = params
  const payload = await request.json().catch(() => ({}))

  const {
    contactId,
    firstName,
    lastName,
    companyName,
    isCompany,
    categoryId,
    accountNumber,
    website,
    notes,
    phone,
    workPhone,
    email,
    addressLine1,
    addressLine2,
    addressCity,
    addressState,
    addressPostalCode,
    expenseAccountId,
    taxId,
    taxPayerName1,
    taxPayerName2,
    taxPayerType,
    include1099,
    taxAddressLine1,
    taxAddressLine2,
    taxAddressLine3,
    taxAddressCity,
    taxAddressState,
    taxAddressPostalCode,
    taxAddressCountry,
    insuranceProvider,
    insurancePolicyNumber,
    insuranceExpirationDate,
  } = payload as {
    contactId?: number | null
    firstName?: string
    lastName?: string
    companyName?: string | null
    isCompany?: boolean
    categoryId?: string | null
    accountNumber?: string | null
    website?: string | null
    notes?: string | null
    phone?: string | null
    workPhone?: string | null
    email?: string | null
    addressLine1?: string | null
    addressLine2?: string | null
    addressCity?: string | null
    addressState?: string | null
    addressPostalCode?: string | null
    expenseAccountId?: number | null
    taxId?: string | null
    taxPayerName1?: string | null
    taxPayerName2?: string | null
    taxPayerType?: string | null
    include1099?: boolean | null
    taxAddressLine1?: string | null
    taxAddressLine2?: string | null
    taxAddressLine3?: string | null
    taxAddressCity?: string | null
    taxAddressState?: string | null
    taxAddressPostalCode?: string | null
    taxAddressCountry?: string | null
    insuranceProvider?: string | null
    insurancePolicyNumber?: string | null
    insuranceExpirationDate?: string | null
  }

  const db = supabaseAdmin || supabase
  if (!db) {
    return NextResponse.json({ error: 'Supabase client unavailable' }, { status: 500 })
  }

  const nowIso = new Date().toISOString()

  if (contactId) {
    const contactUpdates: Record<string, unknown> = {
      first_name: firstName ?? null,
      last_name: lastName ?? null,
      company_name: companyName ?? null,
      display_name: companyName ?? null,
      primary_phone: phone ?? null,
      primary_email: email ?? null,
      primary_address_line_1: addressLine1 ?? null,
      primary_address_line_2: addressLine2 ?? null,
      primary_city: addressCity ?? null,
      primary_state: addressState ?? null,
      primary_postal_code: addressPostalCode ?? null,
      updated_at: nowIso,
    }

    if (workPhone !== undefined) {
      contactUpdates.alt_phone = workPhone ?? null
    }

    if (typeof isCompany === 'boolean') {
      contactUpdates.is_company = isCompany
    }

    const { error: contactError } = await db
      .from('contacts')
      .update(contactUpdates)
      .eq('id', contactId)

    if (contactError) {
      return NextResponse.json({ error: contactError.message }, { status: 500 })
    }
  }

  const vendorUpdates: Record<string, unknown> = {}

  if (categoryId !== undefined) {
    vendorUpdates.vendor_category = categoryId ?? null
  }
  if (accountNumber !== undefined) {
    vendorUpdates.account_number = accountNumber ?? null
  }
  if (expenseAccountId !== undefined) {
    vendorUpdates.expense_gl_account_id = expenseAccountId ?? null
  }
  if (website !== undefined) {
    vendorUpdates.website = website ?? null
  }
  if (notes !== undefined) {
    vendorUpdates.notes = notes ?? null
  }
  if (taxId !== undefined) {
    vendorUpdates.tax_id = taxId ?? null
  }
  if (taxPayerName1 !== undefined) {
    vendorUpdates.tax_payer_name1 = taxPayerName1 ?? null
  }
  if (taxPayerName2 !== undefined) {
    vendorUpdates.tax_payer_name2 = taxPayerName2 ?? null
  }
  if (taxPayerType !== undefined) {
    vendorUpdates.tax_payer_type = taxPayerType ?? null
  }
  if (include1099 !== undefined) {
    vendorUpdates.include_1099 = include1099
  }
  if (taxAddressLine1 !== undefined) {
    vendorUpdates.tax_address_line1 = taxAddressLine1 ?? null
  }
  if (taxAddressLine2 !== undefined) {
    vendorUpdates.tax_address_line2 = taxAddressLine2 ?? null
  }
  if (taxAddressLine3 !== undefined) {
    vendorUpdates.tax_address_line3 = taxAddressLine3 ?? null
  }
  if (taxAddressCity !== undefined) {
    vendorUpdates.tax_address_city = taxAddressCity ?? null
  }
  if (taxAddressState !== undefined) {
    vendorUpdates.tax_address_state = taxAddressState ?? null
  }
  if (taxAddressPostalCode !== undefined) {
    vendorUpdates.tax_address_postal_code = taxAddressPostalCode ?? null
  }
  if (taxAddressCountry !== undefined) {
    vendorUpdates.tax_address_country = taxAddressCountry ?? null
  }
  if (insuranceProvider !== undefined) {
    vendorUpdates.insurance_provider = insuranceProvider ?? null
  }
  if (insurancePolicyNumber !== undefined) {
    vendorUpdates.insurance_policy_number = insurancePolicyNumber ?? null
  }
  if (insuranceExpirationDate !== undefined) {
    vendorUpdates.insurance_expiration_date = insuranceExpirationDate ? insuranceExpirationDate : null
  }

  if (Object.keys(vendorUpdates).length > 0) {
    vendorUpdates.updated_at = nowIso
    const { error: vendorError } = await db
      .from('vendors')
      .update(vendorUpdates)
      .eq('id', vendorId)

    if (vendorError) {
      return NextResponse.json({ error: vendorError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
