// @ts-nocheck
import { supabaseAdmin } from '@/lib/db';
import { buildCanonicalTransactionPatch, type ComputePartiesParams } from '@/lib/transaction-canonical';

type BuildiumAuth = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
};

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
  auth: BuildiumAuth,
  bankAccountId: number | string,
  transactionId: number | string,
): Promise<BankTxDetail> {
  const url = `${auth.baseUrl}/bankaccounts/${bankAccountId}/transactions/${transactionId}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-buildium-client-id': auth.clientId,
      'x-buildium-client-secret': auth.clientSecret,
    },
  });
  if (!res.ok) {
    throw new Error(`Buildium detail fetch failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as BankTxDetail;
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
}) {
  const auth: BuildiumAuth = {
    baseUrl: process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1',
    clientId: process.env.BUILDIUM_CLIENT_ID || '',
    clientSecret: process.env.BUILDIUM_CLIENT_SECRET || '',
  };

  if (!auth.clientId || !auth.clientSecret) {
    throw new Error('Buildium credentials are missing');
  }

  const detail = await fetchBuildiumBankTransactionDetail(
    auth,
    params.bankAccountId,
    params.transactionId,
  );

  const db = supabaseAdmin;
  const now = new Date().toISOString();
  const txHeader = {
    buildium_transaction_id: detail?.Id ?? Number(params.transactionId) ?? null,
    date: detail?.Date ?? null,
    transaction_type: detail?.TransactionType ?? detail?.TransactionTypeEnum ?? null,
    total_amount: detail?.TotalAmount ?? null,
    memo: detail?.Memo ?? null,
    check_number: detail?.CheckNumber ?? null,
    bank_gl_account_buildium_id: detail?.DepositDetails?.BankGLAccountId ?? null,
    updated_at: now,
  };

  // Upsert transaction header (minimal; lines are not available here).
  const { data: existing } = await db
    .from('transactions')
    .select('id')
    .eq('buildium_transaction_id', txHeader.buildium_transaction_id)
    .maybeSingle();

  let transactionIdLocal: string;
  if (existing?.id) {
    const { data: updated, error: updErr } = await db
      .from('transactions')
      .update(txHeader)
      .eq('id', existing.id)
      .select('id')
      .maybeSingle();
    if (updErr) throw updErr;
    transactionIdLocal = updated?.id ?? existing.id;
  } else {
    const { data: inserted, error: insErr } = await db
      .from('transactions')
      .insert({ ...txHeader, created_at: now })
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

  return { transactionId: transactionIdLocal, buildiumTransactionId: txHeader.buildium_transaction_id };
}
