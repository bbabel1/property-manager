import { supabaseAdmin } from '@/lib/db';
import { buildiumFetch } from '@/lib/buildium-http';
import type { Database } from '@/types/database';
import { buildCanonicalTransactionPatch, type ComputePartiesParams } from '@/lib/transaction-canonical';

type BankTxDetail = {
  Id?: number;
  Date?: string;
  TransactionType?: string;
  TransactionTypeEnum?: string;
  TotalAmount?: number;
  Memo?: string | null;
  CheckNumber?: string | null;
  PaymentDetail?: {
    Payee?: {
      Id?: number;
      Type?: string;
      Name?: string;
      Href?: string;
    } | null;
    PaymentMethod?: string | null;
  } | null;
  DepositDetails?: {
    BankGLAccountId?: number | null;
    PaymentTransactions?: Array<{
      Id?: number | null;
      AccountingEntity?: {
        Id?: number | null;
        AccountingEntityType?: string | null;
        Href?: string | null;
        Unit?: { Id?: number | null; Href?: string | null } | null;
      } | null;
      Amount?: number | null;
    }> | null;
  } | null;
};

async function fetchBuildiumBankTransactionDetail(
  bankAccountId: number | string,
  transactionId: number | string,
  orgId?: string,
): Promise<BankTxDetail> {
  const response = await buildiumFetch('GET', `/bankaccounts/${bankAccountId}/transactions/${transactionId}`, undefined, undefined, orgId);
  if (!response.ok) {
    throw new Error(`Buildium detail fetch failed: ${response.status} ${response.statusText}`);
  }
  return (response.json ?? {}) as BankTxDetail;
}

function mapPaymentTransactions(detail: BankTxDetail, transactionId: string, now: string) {
  const splits = detail?.DepositDetails?.PaymentTransactions || [];
  return splits
    .filter(Boolean)
    .map((pt) => ({
      transaction_id: transactionId,
      buildium_payment_transaction_id: pt?.Id ?? null,
      accounting_entity_id: pt?.AccountingEntity?.Id ?? null,
      accounting_entity_type: pt?.AccountingEntity?.AccountingEntityType ?? null,
      accounting_entity_href: pt?.AccountingEntity?.Href ?? null,
      accounting_unit_id: pt?.AccountingEntity?.Unit?.Id ?? null,
      accounting_unit_href: pt?.AccountingEntity?.Unit?.Href ?? null,
      amount: pt?.Amount ?? null,
      created_at: now,
      updated_at: now,
    }))
    .filter((row) => row.transaction_id);
}

function buildCanonicalCandidates(detail: BankTxDetail, tenantId?: string | null) {
  const paidByCandidates: ComputePartiesParams['paidByCandidates'] =
    detail?.DepositDetails?.PaymentTransactions?.map((pt) => ({
      accountingEntityId: pt?.AccountingEntity?.Id ?? null,
      accountingEntityType: pt?.AccountingEntity?.AccountingEntityType ?? null,
      accountingEntityHref: pt?.AccountingEntity?.Href ?? null,
      accountingUnitId: pt?.AccountingEntity?.Unit?.Id ?? null,
      accountingUnitHref: pt?.AccountingEntity?.Unit?.Href ?? null,
      amount: pt?.Amount ?? null,
    })) ?? [];

  const payee = detail?.PaymentDetail?.Payee;
  const paidToCandidates: ComputePartiesParams['paidToCandidates'] = payee
    ? [
        {
          buildiumId: payee?.Id ?? null,
          type: payee?.Type ?? null,
          name: payee?.Name ?? null,
          href: payee?.Href ?? null,
          tenantId: tenantId ?? null,
          vendorId: null,
          amount: detail?.TotalAmount ?? null,
        },
      ]
    : [];

  return { paidByCandidates, paidToCandidates };
}

export async function canonicalUpsertBuildiumBankTransaction(params: {
  bankAccountId: number | string;
  transactionId: number | string;
  tenantId?: string | null;
  orgId?: string;
}) {
  // Resolve orgId from bank account if not provided
  let orgId = params.orgId;
  if (!orgId) {
    const bankGlAccountId = typeof params.bankAccountId === 'number' ? params.bankAccountId : Number(params.bankAccountId);
    if (Number.isFinite(bankGlAccountId)) {
      const { data: glAccount } = await supabaseAdmin
        .from('gl_accounts')
        .select('org_id')
        .eq('buildium_gl_account_id', bankGlAccountId)
        .maybeSingle();
      if (glAccount?.org_id) {
        orgId = glAccount.org_id;
      }
    }
  }

  const detail = await fetchBuildiumBankTransactionDetail(
    params.bankAccountId,
    params.transactionId,
    orgId,
  );

  const db = supabaseAdmin;
  const now = new Date().toISOString();
  type TransactionInsert = Database['public']['Tables']['transactions']['Insert'];
  type TransactionType = TransactionInsert['transaction_type'];

  const dateStr = detail?.Date ? String(detail.Date) : undefined;
  const transactionTypeRaw = detail?.TransactionType ?? detail?.TransactionTypeEnum;
  const buildiumTransactionId = Number(detail?.Id ?? params.transactionId);
  if (!Number.isFinite(buildiumTransactionId)) {
    throw new Error('Missing Buildium transaction id');
  }
  const bankGlAccountId = detail?.DepositDetails?.BankGLAccountId;

  const txHeaderNormalized: TransactionInsert = {
    buildium_transaction_id: buildiumTransactionId,
    date: dateStr ?? now,
    transaction_type:
      typeof transactionTypeRaw === 'string'
        ? (transactionTypeRaw as TransactionType)
        : ('Other' as TransactionType),
    total_amount: detail?.TotalAmount ?? undefined,
    memo: detail?.Memo ?? undefined,
    check_number: detail?.CheckNumber ?? undefined,
    bank_gl_account_buildium_id: bankGlAccountId ?? undefined,
    updated_at: now,
  };

  // Upsert transaction header (minimal; lines are not available here).
  const { data: existing } = await db
    .from('transactions')
    .select('id')
    .eq('buildium_transaction_id', buildiumTransactionId as number)
    .maybeSingle();

  let transactionIdLocal: string;
  if (existing?.id) {
    const { data: updated, error: updErr } = await db
      .from('transactions')
      .update(txHeaderNormalized)
      .eq('id', existing.id)
      .select('id')
      .maybeSingle();
    if (updErr) throw updErr;
    transactionIdLocal = updated?.id ?? existing.id;
  } else {
    const insertPayload: TransactionInsert = { ...txHeaderNormalized };
    const { data: inserted, error: insErr } = await db
      .from('transactions')
      .insert(insertPayload)
      .select('id')
      .maybeSingle();
    if (insErr) throw insErr;
    transactionIdLocal = inserted?.id as string;
  }

  // Upsert payment splits.
  await db.from('transaction_payment_transactions').delete().eq('transaction_id', transactionIdLocal);
  const splitRows = mapPaymentTransactions(detail, transactionIdLocal, now);
  if (splitRows.length) {
    const { error: splitErr } = await db.from('transaction_payment_transactions').insert(splitRows);
    if (splitErr) throw splitErr;
  }

  // Canonical PaidBy/PaidTo patch.
  const { paidByCandidates, paidToCandidates } = buildCanonicalCandidates(detail, params.tenantId);
  const canonicalPatch = buildCanonicalTransactionPatch({
    paidByCandidates,
    paidToCandidates,
    labelContext: {
      propertyName: null,
      unitLabel: null,
    },
  });

  await db.from('transactions').update(canonicalPatch).eq('id', transactionIdLocal);

  return { transactionId: transactionIdLocal, buildiumTransactionId: txHeaderNormalized.buildium_transaction_id };
}
