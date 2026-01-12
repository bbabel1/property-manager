/**
 * Backfill canonical PaidBy/PaidTo for bank transactions by fetching Buildium detail.
 *
 * For each transaction with both bank_gl_account_buildium_id and buildium_transaction_id:
 * - GET /bankaccounts/{bankAccountId}/transactions/{transactionId}
 * - Derive canonical PaidBy/PaidTo using transaction-canonical helpers
 * - Update transactions row (does not touch lines/splits)
 *
 * Safe-by-default: only writes the canonical fields; does not alter totals or line items.
 */

import 'dotenv/config';
import { createClient, type PostgrestSingleResponse } from '@supabase/supabase-js';
import { inspect } from 'node:util';
import { computeCanonicalParties } from '@/lib/transaction-canonical';
import { ensureBuildiumEnabledForScript } from './ensure-enabled';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUILDUM_BASE_URL = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1';
const BUILDUM_CLIENT_ID = process.env.BUILDIUM_CLIENT_ID || '';
const BUILDUM_CLIENT_SECRET = process.env.BUILDIUM_CLIENT_SECRET || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase service-role credentials');
}
if (!BUILDUM_CLIENT_ID || !BUILDUM_CLIENT_SECRET) {
  throw new Error('Missing Buildium credentials');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const writeLine = (stream: NodeJS.WritableStream, value: unknown) => {
  const text = typeof value === 'string' ? value : inspect(value, { depth: 6 });
  stream.write(`${text}\n`);
};

const logError = (message: string, detail?: unknown) => {
  const suffix = detail !== undefined ? ` ${inspect(detail, { depth: 4 })}` : '';
  writeLine(process.stderr, `${message}${suffix}`);
};

const logInfo = (value: unknown) => writeLine(process.stdout, value);

type TxRow = {
  id: string;
  buildium_transaction_id: number | null;
  bank_gl_account_buildium_id: number | null;
};

type BuildiumBankTxDetail = {
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
  PaidBy?: Array<{
    AccountingEntity?: {
      Id?: number | null;
      AccountingEntityType?: string | null;
      Href?: string | null;
      Unit?: { Id?: number | null; Href?: string | null } | null;
    } | null;
    Amount?: number | null;
  }> | null;
};

async function fetchDetail(bankAccountId: number, transactionId: number): Promise<BuildiumBankTxDetail> {
  const url = `${BUILDUM_BASE_URL}/bankaccounts/${bankAccountId}/transactions/${transactionId}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'x-buildium-client-id': BUILDUM_CLIENT_ID,
      'x-buildium-client-secret': BUILDUM_CLIENT_SECRET,
      'x-buildium-egress-allowed': '1',
    },
  });
  if (!res.ok) {
    throw new Error(`Buildium detail fetch failed ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as BuildiumBankTxDetail;
}

function buildCandidates(detail: BuildiumBankTxDetail) {
  const paidByCandidatesFromPaymentTransactions =
    detail?.DepositDetails?.PaymentTransactions?.map((pt) => ({
      accountingEntityId: pt?.AccountingEntity?.Id ?? null,
      accountingEntityType: pt?.AccountingEntity?.AccountingEntityType ?? null,
      accountingEntityHref: pt?.AccountingEntity?.Href ?? null,
      accountingUnitId: pt?.AccountingEntity?.Unit?.Id ?? null,
      accountingUnitHref: pt?.AccountingEntity?.Unit?.Href ?? null,
      amount: pt?.Amount ?? null,
    })) ?? [];

  // Fallback: Buildium transaction detail PaidBy array (e.g., GET bankaccounts/{id}/transactions/{id})
  const paidByCandidatesFromPaidBy =
    detail?.PaidBy?.map((pb: any) => ({
      accountingEntityId: pb?.AccountingEntity?.Id ?? null,
      accountingEntityType: pb?.AccountingEntity?.AccountingEntityType ?? null,
      accountingEntityHref: pb?.AccountingEntity?.Href ?? null,
      accountingUnitId: pb?.AccountingEntity?.Unit?.Id ?? null,
      accountingUnitHref: pb?.AccountingEntity?.Unit?.Href ?? null,
      amount: pb?.Amount ?? null,
    })) ?? [];

  const paidByCandidates =
    paidByCandidatesFromPaymentTransactions.length > 0
      ? paidByCandidatesFromPaymentTransactions
      : paidByCandidatesFromPaidBy;

  const payee = detail?.PaymentDetail?.Payee;
  const paidToCandidates = payee
    ? [
        {
          buildiumId: payee?.Id ?? null,
          type: payee?.Type ?? null,
          name: payee?.Name ?? null,
          href: payee?.Href ?? null,
          vendorId: null,
          tenantId: null,
          amount: detail?.TotalAmount ?? null,
        },
      ]
    : [];

  return { paidByCandidates, paidToCandidates };
}

async function resolvePaidByLabelContext(
  candidates: Array<{ accountingEntityId?: number | null; accountingUnitId?: number | null }>,
): Promise<{ propertyName: string | null; unitLabel: string | null }> {
  const propertyId =
    candidates.find((c) => c.accountingEntityId !== null && c.accountingEntityId !== undefined)
      ?.accountingEntityId ?? null;
  const unitId =
    candidates.find((c) => c.accountingUnitId !== null && c.accountingUnitId !== undefined)
      ?.accountingUnitId ?? null;

  let propertyName: string | null = null;
  let unitLabel: string | null = null;

  if (propertyId) {
    const { data } = await supabase
      .from('properties')
      .select('name')
      .eq('buildium_property_id', propertyId)
      .maybeSingle();
    propertyName = data?.name ?? null;
  }

  if (unitId) {
    const { data } = await supabase
      .from('units')
      .select('unit_number')
      .eq('buildium_unit_id', unitId)
      .maybeSingle();
    unitLabel = data?.unit_number ?? null;
  }

  return { propertyName, unitLabel };
}

async function updateCanonical(id: string, detail: BuildiumBankTxDetail) {
  const { paidByCandidates, paidToCandidates } = buildCandidates(detail);
  const labelContext = await resolvePaidByLabelContext(paidByCandidates);
  const canonical = computeCanonicalParties({
    paidByCandidates,
    paidToCandidates,
    labelContext,
  });

  const patch = {
    paid_by_accounting_entity_id: canonical.paidBy?.paid_by_accounting_entity_id ?? null,
    paid_by_accounting_entity_type: canonical.paidBy?.paid_by_accounting_entity_type ?? null,
    paid_by_accounting_entity_href: canonical.paidBy?.paid_by_accounting_entity_href ?? null,
    paid_by_accounting_unit_id: canonical.paidBy?.paid_by_accounting_unit_id ?? null,
    paid_by_accounting_unit_href: canonical.paidBy?.paid_by_accounting_unit_href ?? null,
    paid_by_label: canonical.paidBy?.paid_by_label ?? null,

    paid_to_buildium_id: canonical.paidTo?.paid_to_buildium_id ?? null,
    paid_to_type: canonical.paidTo?.paid_to_type ?? null,
    paid_to_name: canonical.paidTo?.paid_to_name ?? null,
    paid_to_href: canonical.paidTo?.paid_to_href ?? null,
    paid_to_vendor_id: canonical.paidTo?.paid_to_vendor_id ?? null,
    paid_to_tenant_id: canonical.paidTo?.paid_to_tenant_id ?? null,
  };

  const { error } = await supabase.from('transactions').update(patch).eq('id', id);
  if (error) throw error;
}

async function fetchBatch(offset: number, limit: number): Promise<TxRow[]> {
  const { data, error }: PostgrestSingleResponse<TxRow[]> = await supabase
    .from('transactions')
    .select('id, buildium_transaction_id, bank_gl_account_buildium_id')
    .not('bank_gl_account_buildium_id', 'is', null)
    .not('buildium_transaction_id', 'is', null)
    .order('date', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return data ?? [];
}

async function main() {
  await ensureBuildiumEnabledForScript(process.env.DEFAULT_ORG_ID ?? null);
  const limit = 50;
  let offset = 0;
  let processed = 0;
  let errors = 0;

  for (;;) {
    const batch = await fetchBatch(offset, limit);
    if (!batch.length) break;

    for (const row of batch) {
      if (!row.bank_gl_account_buildium_id || !row.buildium_transaction_id) continue;
      try {
        const detail = await fetchDetail(
          row.bank_gl_account_buildium_id,
          row.buildium_transaction_id,
        );
        await updateCanonical(row.id, detail);
        processed += 1;
      } catch (err) {
        errors += 1;
        logError('Failed backfill', { id: row.id, err });
      }
      // Be kind to Buildium API
      await new Promise((r) => setTimeout(r, 250));
    }

    offset += limit;
  }

  logInfo(
    JSON.stringify(
      {
        processed,
        errors,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  logError('Unhandled error', err);
  process.exit(1);
});
