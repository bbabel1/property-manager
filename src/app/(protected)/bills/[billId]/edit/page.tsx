import { notFound } from 'next/navigation'
import { supabase, supabaseAdmin } from '@/lib/db'
import BillEditForm from '@/components/bills/BillEditForm'

export default async function EditBillPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params
  const db = supabaseAdmin || supabase

  const billRes = await (db as any)
    .from('transactions')
    .select('id, date, due_date, memo, reference_number, vendor_id, transaction_type')
    .eq('id', billId)
    .maybeSingle()
  const bill = billRes?.data
  if (!bill || bill.transaction_type !== 'Bill') notFound()

  const [vendorRowsRes, linesRes, propsRes, unitsRes, accountsRes] = await Promise.all([
    (db as any)
      .from('vendors')
      .select('id, contacts(display_name, company_name)')
      .order('id', { ascending: true }),
    (db as any)
      .from('transaction_lines')
      .select(
        `id, amount, memo, posting_type, property_id, unit_id, gl_account_id,
         properties(name),
         units(unit_number, unit_name),
         gl_accounts(name, account_number)`
      )
      .eq('transaction_id', billId)
      .order('created_at', { ascending: true }),
    (db as any)
      .from('properties')
      .select('id, name, address_line1')
      .order('name', { ascending: true }),
    (db as any)
      .from('units')
      .select('id, property_id, unit_number, unit_name')
      .order('unit_number', { ascending: true }),
    (db as any)
      .from('gl_accounts')
      .select('id, name, account_number, type')
      .order('name', { ascending: true })
  ])

  const vendors = (vendorRowsRes?.data || []).map((row: any) => {
    const c = row?.contacts || {}
    const label = c?.display_name || c?.company_name || 'Vendor'
    return { id: String(row.id), label }
  })

  const lines = (linesRes?.data || []).map((l: any) => {
    const propertyName = l?.properties?.name || '—'
    const unit = l?.units
    const unitLabel = unit?.unit_number || unit?.unit_name || 'Property level'
    const ga = l?.gl_accounts || {}
    const accountLabel = ga?.name || ga?.account_number || 'Account'
    return {
      id: String(l.id),
      property_id: l?.property_id || null,
      unit_id: l?.unit_id || null,
      gl_account_id: l?.gl_account_id,
      posting_type: (l?.posting_type as 'Debit' | 'Credit') || 'Debit',
      propertyName,
      unitLabel,
      accountLabel,
      description: l?.memo || bill?.memo || '—',
      amount: Number(l?.amount || 0)
    }
  })

  const properties = (propsRes?.data || []).map((p: any) => ({ id: String(p.id), label: p.name || p.address_line1 || 'Property' }))
  const units = (unitsRes?.data || []).map((u: any) => ({ id: String(u.id), label: u.unit_number || u.unit_name || 'Unit', property_id: u.property_id ? String(u.property_id) : null }))
  const accounts = (accountsRes?.data || []).map((a: any) => ({
    id: String(a.id),
    label: a.name || a.account_number || 'Account',
    type: a?.type || null,
  }))

  return (
    <BillEditForm
      billId={billId}
      initial={{
        date: bill.date,
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
