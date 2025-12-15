import { notFound } from 'next/navigation'
import { supabase, supabaseAdmin } from '@/lib/db'
import BillEditForm from '@/components/bills/BillEditForm'

type BillRow = {
  id: string
  date: string | null
  due_date: string | null
  memo: string | null
  reference_number: string | null
  vendor_id: string | null
  transaction_type: string | null
}

type VendorRow = {
  id: string
  contacts?: { display_name?: string | null; company_name?: string | null } | null
}

type LineRow = {
  id: string
  amount: number | null
  memo: string | null
  posting_type: 'Debit' | 'Credit' | null
  property_id: string | null
  unit_id: string | null
  gl_account_id: string | null
  properties?: { name?: string | null } | null
  units?: { unit_number?: string | null; unit_name?: string | null } | null
  gl_accounts?: { name?: string | null; account_number?: string | null } | null
}

type PropertyRow = { id: string; name: string | null; address_line1: string | null }
type UnitRow = { id: string; property_id: string | null; unit_number: string | null; unit_name: string | null }
type AccountRow = { id: string; name: string | null; account_number: string | null; type: string | null }

export default async function EditBillPage({ params }: { params: { billId: string } }) {
  const { billId } = params
  const db = supabaseAdmin || supabase

  const billRes = await db
    .from('transactions')
    .select('id, date, due_date, memo, reference_number, vendor_id, transaction_type')
    .eq('id', billId)
    .maybeSingle<BillRow>()
  const bill = billRes?.data
  if (!bill || bill.transaction_type !== 'Bill') notFound()

  const [vendorRowsRes, linesRes, propsRes, unitsRes, accountsRes] = await Promise.all([
    db
      .from('vendors')
      .select('id, contacts(display_name, company_name)')
      .order('id', { ascending: true }),
    db
      .from('transaction_lines')
      .select(
        `id, amount, memo, posting_type, property_id, unit_id, gl_account_id,
         properties(name),
         units(unit_number, unit_name),
         gl_accounts(name, account_number)`
      )
      .eq('transaction_id', billId)
      .order('created_at', { ascending: true }),
    db
      .from('properties')
      .select('id, name, address_line1')
      .order('name', { ascending: true }),
    db
      .from('units')
      .select('id, property_id, unit_number, unit_name')
      .order('unit_number', { ascending: true }),
    db
      .from('gl_accounts')
      .select('id, name, account_number, type')
      .order('name', { ascending: true })
  ])

  const vendors = ((vendorRowsRes?.data || []) as VendorRow[]).map((row) => {
    const c = row?.contacts || {}
    const label = c?.display_name || c?.company_name || 'Vendor'
    return { id: String(row.id), label }
  })

  const lines = ((linesRes?.data || []) as LineRow[]).map((l) => {
    const propertyName = l?.properties?.name || '—'
    const unit = l?.units
    const unitLabel = unit?.unit_number || unit?.unit_name || 'Property level'
    const ga = l?.gl_accounts || {}
    const accountLabel = ga?.name || ga?.account_number || 'Account'
    return {
      id: String(l.id),
      property_id: l?.property_id || null,
      unit_id: l?.unit_id || null,
      gl_account_id: l?.gl_account_id ? String(l.gl_account_id) : '',
      posting_type: (l?.posting_type as 'Debit' | 'Credit') || 'Debit',
      propertyName,
      unitLabel,
      accountLabel,
      description: l?.memo || bill?.memo || '—',
      amount: Number(l?.amount || 0)
    }
  })

  const properties = ((propsRes?.data || []) as PropertyRow[]).map((p) => ({ id: String(p.id), label: p.name || p.address_line1 || 'Property' }))
  const units = ((unitsRes?.data || []) as UnitRow[]).map((u) => ({ id: String(u.id), label: u.unit_number || u.unit_name || 'Unit', property_id: u.property_id ? String(u.property_id) : null }))
  const accounts = ((accountsRes?.data || []) as AccountRow[]).map((a) => ({
    id: String(a.id),
    label: a.name || a.account_number || 'Account',
    type: a?.type || null,
  }))

  return (
    <BillEditForm
      billId={billId}
      initial={{
        date: bill.date ?? '',
        due_date: bill.due_date,
        vendor_id: bill.vendor_id,
        reference_number: bill.reference_number,
        memo: bill.memo,
      }}
      vendors={vendors}
      properties={properties}
      units={units}
      accounts={accounts}
      lines={lines}
    />
  )
}
