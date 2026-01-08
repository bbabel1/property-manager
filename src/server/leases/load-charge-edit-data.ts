import { supabase, supabaseAdmin } from '@/lib/db';
import type { LeaseAccountOption } from '@/components/leases/types';
import { loadChargeFormData } from './load-charge-form-data';
import { fetchTransactionWithLines } from '@/lib/lease-transaction-helpers';

type ChargeEditPrefill = {
  leaseId: string;
  accountOptions: LeaseAccountOption[];
  leaseSummary: {
    propertyUnit?: string | null;
    tenants?: string | null;
  };
  transactionId: number;
  initialValues: {
    date: string | null;
    amount: number;
    memo?: string | null;
    allocations: Array<{ account_id: string; amount: number; memo?: string | null }>;
  };
};

export type ChargeEditPrefillResult =
  | { ok: true; data: ChargeEditPrefill }
  | { ok: false; error: string };

export async function loadChargeEditData(
  leaseIdInput: string | number,
  transactionIdInput: string | number | undefined,
): Promise<ChargeEditPrefillResult> {
  const leaseIdNum = Number(leaseIdInput);
  const txIdNum = Number(transactionIdInput);
  if (!Number.isFinite(leaseIdNum) || !Number.isFinite(txIdNum)) {
    return { ok: false, error: 'Invalid lease or transaction id' };
  }

  const db = supabaseAdmin || supabase;
  if (!db) {
    return { ok: false, error: 'Database unavailable' };
  }

  try {
    const base = await loadChargeFormData(leaseIdNum);
    if (!base.ok) return base;

    const txRecord = await fetchTransactionWithLines(String(txIdNum), db);
    if (!txRecord || !txRecord.transaction) {
      return { ok: false, error: 'Transaction not found' };
    }

    const tx = txRecord.transaction;
    if ((tx.transaction_type || '').toLowerCase() !== 'charge') {
      return { ok: false, error: 'Transaction is not a charge' };
    }
    if (tx.lease_id && Number(tx.lease_id) !== leaseIdNum) {
      return { ok: false, error: 'Transaction does not belong to this lease' };
    }

    const allocations =
      (txRecord.lines || [])
        .filter((line) => line?.gl_account_id)
        .map((line) => ({
          account_id: String(line.gl_account_id),
          amount: Math.abs(Number(line.amount ?? 0)),
          memo: line.memo ?? undefined,
        }))
        .filter((line) => Number.isFinite(line.amount) && line.amount > 0) || [];

    const initialValues = {
      date: (tx.date ? String(tx.date) : null) ?? null,
      amount: Number(tx.total_amount ?? 0) || 0,
      memo: tx.memo ?? null,
      allocations: allocations.length ? allocations : [{ account_id: '', amount: 0, memo: null }],
    };

    return {
      ok: true,
      data: {
        leaseId: base.data.leaseId,
        accountOptions: base.data.accountOptions,
        leaseSummary: base.data.leaseSummary,
        transactionId: txIdNum,
        initialValues,
      },
    };
  } catch (error) {
    console.error('Failed to load charge edit data', error);
    return { ok: false, error: 'Unable to load charge for editing.' };
  }
}
