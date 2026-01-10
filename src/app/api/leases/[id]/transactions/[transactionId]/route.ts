import { NextResponse } from 'next/server'
import { z } from 'zod'
import { LeaseTransactionService } from '@/lib/lease-transaction-service'
import { supabaseAdmin } from '@/lib/db'
import { getServerSupabaseClient, requireSupabaseAdmin } from '@/lib/supabase-client'

const UpdateSchema = z.object({
  transaction_type: z.enum(['Charge', 'Payment']),
  date: z.string().min(1),
  amount: z.number().nonnegative(),
  memo: z.string().nullable().optional(),
  allocations: z.array(z.object({ account_id: z.string().min(1), amount: z.number().nonnegative(), memo: z.string().optional().nullable() })),
})

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; transactionId: string }> }
) {
  const { id, transactionId: txIdRaw } = await context.params
  const leaseId = Number(id)
  if (!Number.isFinite(leaseId)) {
    return NextResponse.json({ error: 'Invalid lease id' }, { status: 400 })
  }

  const uuidLike = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  const isUuid = uuidLike.test(String(txIdRaw))
  const txNumeric = Number(txIdRaw)
  const isNumeric = Number.isFinite(txNumeric)
  if (!isUuid && !isNumeric) {
    return NextResponse.json({ error: 'Invalid transaction reference' }, { status: 400 })
  }

  try {
    let buildiumLeaseId: number | null = null
    try {
      const db = supabaseAdmin || (await getServerSupabaseClient())
      if (db) {
        const { data: leaseRow } = await (db as any)
          .from('lease')
          .select('buildium_lease_id')
          .eq('id', leaseId)
          .maybeSingle()
        const raw = leaseRow?.buildium_lease_id
        if (raw != null && !Number.isNaN(Number(raw))) {
          buildiumLeaseId = Number(raw)
        }
      }
    } catch {}

    if (supabaseAdmin) {
      const query = supabaseAdmin
        .from('transactions')
        .select(
          [
            'id',
            'date',
            'total_amount',
            'memo',
            'transaction_type',
            'check_number',
            'payment_method',
            'payment_method_raw',
            'payee_buildium_id',
            'payee_buildium_type',
            'payee_name',
            'payee_href',
            'is_internal_transaction',
            'internal_transaction_is_pending',
            'internal_transaction_result_date',
            'internal_transaction_result_code',
            'buildium_unit_id',
            'unit_id',
            'buildium_application_id',
            'unit_agreement_id',
            'unit_agreement_type',
            'bank_gl_account_id',
            'bank_gl_account_buildium_id',
            'buildium_last_updated_at',
            'buildium_lease_id',
            'transaction_lines ( gl_account_id, amount, memo, reference_number, is_cash_posting, posting_type, buildium_property_id, buildium_unit_id )',
            'transaction_payment_transactions ( buildium_payment_transaction_id, accounting_entity_id, accounting_entity_type, accounting_entity_href, accounting_unit_id, accounting_unit_href, amount )',
          ].join(', '),
        )
        .eq(isUuid ? 'id' : 'buildium_transaction_id', isUuid ? txIdRaw : txNumeric)
        .maybeSingle();

      const { data: localTx, error: localErr } = await query;
      if (localErr && localErr.code !== 'PGRST116') {
        throw localErr;
      }

      if (localTx && 'id' in localTx) {
        const splits = Array.isArray((localTx as any).transaction_payment_transactions)
          ? (localTx as any).transaction_payment_transactions
          : [];
        const lines = Array.isArray((localTx as any).transaction_lines)
          ? (localTx as any).transaction_lines
          : [];

        const payload = {
          Id: (localTx as any).id,
          Date: (localTx as any).date,
          TotalAmount: (localTx as any).total_amount,
          Memo: (localTx as any).memo,
          TransactionTypeEnum: (localTx as any).transaction_type,
          CheckNumber: (localTx as any).check_number ?? undefined,
          UnitId: (localTx as any).buildium_unit_id ?? undefined,
          PaymentDetail: {
            PaymentMethod:
              (localTx as any).payment_method_raw ??
              (localTx as any).payment_method ??
              undefined,
            Payee:
              (localTx as any).payee_buildium_id != null
                ? {
                    Id: (localTx as any).payee_buildium_id,
                    Type: (localTx as any).payee_buildium_type ?? undefined,
                    Name: (localTx as any).payee_name ?? undefined,
                    Href: (localTx as any).payee_href ?? undefined,
                  }
                : undefined,
            IsInternalTransaction: (localTx as any).is_internal_transaction ?? undefined,
            InternalTransactionStatus:
              (localTx as any).internal_transaction_is_pending != null ||
              (localTx as any).internal_transaction_result_date ||
              (localTx as any).internal_transaction_result_code
                ? {
                    IsPending: (localTx as any).internal_transaction_is_pending ?? undefined,
                    ResultDate: (localTx as any).internal_transaction_result_date ?? undefined,
                    ResultCode: (localTx as any).internal_transaction_result_code ?? undefined,
                  }
                : undefined,
          },
          UnitAgreement:
            (localTx as any).unit_agreement_id != null
              ? {
                  Id: (localTx as any).unit_agreement_id,
                  Type: (localTx as any).unit_agreement_type ?? undefined,
                }
              : undefined,
          DepositDetails:
            (localTx as any).bank_gl_account_buildium_id || splits.length
              ? {
                  BankGLAccountId: (localTx as any).bank_gl_account_buildium_id ?? undefined,
                  PaymentTransactions: splits.map((pt: any) => ({
                    Id: pt?.buildium_payment_transaction_id ?? undefined,
                    AccountingEntity:
                      pt?.accounting_entity_id || pt?.accounting_entity_type
                        ? {
                            Id: pt?.accounting_entity_id ?? undefined,
                            AccountingEntityType: pt?.accounting_entity_type ?? undefined,
                            Href: pt?.accounting_entity_href ?? undefined,
                            Unit:
                              pt?.accounting_unit_id || pt?.accounting_unit_href
                                ? {
                                    Id: pt?.accounting_unit_id ?? undefined,
                                    Href: pt?.accounting_unit_href ?? undefined,
                                  }
                                : undefined,
                          }
                        : undefined,
                    Amount: pt?.amount ?? undefined,
                  })),
                }
              : undefined,
          Lines: lines.map((line: any) => ({
            GLAccountId: line?.gl_account_id,
            Amount: line?.amount,
            Memo: line?.memo,
            ReferenceNumber: line?.reference_number ?? undefined,
            IsCashPosting: line?.is_cash_posting ?? undefined,
            PostingType: line?.posting_type ?? undefined,
            PropertyId: line?.buildium_property_id ?? undefined,
            UnitId: line?.buildium_unit_id ?? undefined,
          })),
        };
        return NextResponse.json({ data: payload });
      }
    }

    const tx = isNumeric
      ? await LeaseTransactionService.getFromBuildium(
          buildiumLeaseId != null && Number.isFinite(buildiumLeaseId) ? buildiumLeaseId : leaseId,
          txNumeric,
          false,
        )
      : null
    if (!tx) {
      return NextResponse.json({ error: `Transaction not found for lease ${leaseId} and reference ${txIdRaw}` }, { status: 404 })
    }
    return NextResponse.json({ data: tx })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load transaction' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string; transactionId: string }> }
) {
  const { id, transactionId: txId } = await context.params
  const leaseId = Number(id)
  const transactionId = Number(txId)
  if (!Number.isFinite(leaseId) || !Number.isFinite(transactionId)) {
    return NextResponse.json({ error: 'Invalid identifiers' }, { status: 400 })
  }

  const json = await request.json().catch(() => undefined)
  const parsed = UpdateSchema.safeParse(json)
  if (!parsed.success) {
    const issue = parsed.error.issues?.[0]
    return NextResponse.json({ error: issue?.message ?? 'Invalid payload' }, { status: 400 })
  }

  if (parsed.data.transaction_type !== 'Charge') {
    return NextResponse.json({ error: 'Only charge transactions can be edited at this time' }, { status: 400 })
  }

  try {
    const lines = parsed.data.allocations
      .map((line) => ({
        GLAccountId: Number(line.account_id),
        Amount: line.amount,
        Memo: line.memo ?? undefined,
      }))
      .filter((line) => Number.isFinite(line.GLAccountId))

    if (!lines.length) {
      return NextResponse.json({ error: 'At least one allocation is required' }, { status: 400 })
    }

    const payload = {
      TransactionType: 'Charge' as const,
      TransactionDate: parsed.data.date,
      Amount: parsed.data.amount,
      Memo: parsed.data.memo ?? undefined,
      Lines: lines,
    }
    const result = await LeaseTransactionService.updateInBuildiumAndDB(leaseId, transactionId, payload)

    return NextResponse.json({ data: result.buildium })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update transaction' }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; transactionId: string }> }
) {
  const { id, transactionId: txIdRaw } = await context.params
  const leaseId = Number(id)
  if (!Number.isFinite(leaseId)) {
    return NextResponse.json({ error: 'Invalid lease id' }, { status: 400 })
  }

  try {
    const db = requireSupabaseAdmin('transactions:delete')
    const raw = String(txIdRaw ?? '').trim()
    console.log('[DELETE transaction]', { leaseId, raw })
    const uuidLike = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/.test(raw)

    let txIdLocal: string | null = null

    if (uuidLike) {
      const { data: existing } = await db
        .from('transactions')
        .select('id, lease_id')
        .eq('id', raw)
        .maybeSingle()
      console.log('[DELETE lookup uuid]', { existing })
      if (existing?.id) {
        const assignedLeaseId = typeof existing.lease_id === 'string' ? Number(existing.lease_id) : existing.lease_id
        if (!Number.isFinite(assignedLeaseId) || assignedLeaseId !== leaseId) {
          // Guard against deleting another lease's transaction
          return NextResponse.json({ error: 'Transaction does not belong to this lease' }, { status: 403 })
        }
        txIdLocal = existing.id
      }
    }

    if (!txIdLocal) {
      const n = Number(raw)
      if (Number.isFinite(n)) {
        const { data: existing } = await db
          .from('transactions')
          .select('id, lease_id')
          .eq('buildium_transaction_id', n)
          .maybeSingle()
        console.log('[DELETE lookup buildium]', { existing })
        if (existing?.id) {
          const assignedLeaseId = typeof existing.lease_id === 'string' ? Number(existing.lease_id) : existing.lease_id
          if (!Number.isFinite(assignedLeaseId) || assignedLeaseId !== leaseId) {
            return NextResponse.json({ error: 'Transaction does not belong to this lease' }, { status: 403 })
          }
          txIdLocal = existing.id
        }
      }
    }

    if (txIdLocal) {
      // Remove overlays that block transaction deletion via restrictive FKs
      const { error: depositDeleteErr } = await db
        .from('deposit_items')
        .delete()
        .eq('payment_transaction_id', txIdLocal)
      if (depositDeleteErr) throw depositDeleteErr

      const { error: paymentDeleteErr } = await db.from('payment').delete().eq('transaction_id', txIdLocal)
      if (paymentDeleteErr) throw paymentDeleteErr

      // Delete the transaction (lines/journal entries cascade); disable balance trigger via helper
      const { error: delErr } = await db.rpc('delete_transaction_safe', { p_transaction_id: txIdLocal })
      if (delErr) throw delErr
    }

    return NextResponse.json({ ok: true, deleted: Boolean(txIdLocal) }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to delete transaction' }, { status: 500 })
  }
}
