import { NextResponse } from 'next/server'
import { requireSupabaseAdmin } from '@/lib/supabase-client'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const payload = await request.json().catch(() => null)
  if (!payload) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })

  const admin = requireSupabaseAdmin('update bill')

  const update: Record<string, unknown> = {}
  if ('date' in payload) update.date = payload.date || null
  if ('due_date' in payload) update.due_date = payload.due_date || null
  if ('vendor_id' in payload) update.vendor_id = payload.vendor_id || null
  if ('reference_number' in payload) update.reference_number = payload.reference_number || null
  if ('memo' in payload) update.memo = payload.memo || null
  update.updated_at = new Date().toISOString()

  const { data: header, error } = await admin
    .from('transactions')
    .update(update)
    .eq('id', id)
    .select('id, date, due_date, vendor_id, reference_number, memo')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (Array.isArray(payload?.lines)) {
    const { data: existingCredit } = await admin
      .from('transaction_lines')
      .select('gl_account_id, memo, account_entity_type, account_entity_id, property_id, unit_id, buildium_property_id, buildium_unit_id')
      .eq('transaction_id', id)
      .eq('posting_type', 'Credit')
      .limit(1)

    await admin.from('transaction_lines').delete().eq('transaction_id', id)

    const nowIso = new Date().toISOString()
    const txDate = payload?.date || header?.date || new Date().toISOString().slice(0, 10)
    const debitRows = payload.lines.map((l: any) => ({
      transaction_id: id,
      gl_account_id: l.gl_account_id,
      amount: Math.abs(Number(l.amount || 0)),
      posting_type: 'Debit',
      memo: l.memo ?? null,
      account_entity_type: 'Rental',
      account_entity_id: null,
      date: txDate,
      created_at: nowIso,
      updated_at: nowIso,
      property_id: l.property_id || null,
      unit_id: l.unit_id || null,
      buildium_property_id: null,
      buildium_unit_id: null,
      buildium_lease_id: null,
    }))
    if (debitRows.length) {
      await admin.from('transaction_lines').insert(debitRows)
    }

    const debitTotal = debitRows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
    const template = existingCredit?.[0] || null
    if (debitTotal > 0 && template) {
      await admin.from('transaction_lines').insert({
        transaction_id: id,
        gl_account_id: template.gl_account_id,
        amount: debitTotal,
        posting_type: 'Credit',
        memo: template.memo ?? payload?.memo ?? null,
        account_entity_type: template.account_entity_type || 'Company',
        account_entity_id: template.account_entity_id ?? null,
        date: txDate,
        created_at: nowIso,
        updated_at: nowIso,
        property_id: template.property_id ?? debitRows[0]?.property_id ?? null,
        unit_id: template.unit_id ?? debitRows[0]?.unit_id ?? null,
        buildium_property_id: template.buildium_property_id ?? null,
        buildium_unit_id: template.buildium_unit_id ?? null,
        buildium_lease_id: null,
      })
    }
  }

  return NextResponse.json({ data: header })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const admin = requireSupabaseAdmin('delete bill')

  const { data: bill, error } = await admin
    .from('transactions')
    .select('id, transaction_type')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!bill) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 })
  }

  if (bill.transaction_type !== 'Bill') {
    return NextResponse.json({ error: 'Transaction is not a bill' }, { status: 400 })
  }

  const { error: deleteLinesError } = await admin
    .from('transaction_lines')
    .delete()
    .eq('transaction_id', id)

  if (deleteLinesError) {
    return NextResponse.json({ error: deleteLinesError.message }, { status: 500 })
  }

  const { error: deleteBillError } = await admin.from('transactions').delete().eq('id', id)

  if (deleteBillError) {
    return NextResponse.json({ error: deleteBillError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
