import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import { rollupFinances, classifyLine } from '@/lib/finance/model';
import type { FinanceRollupResult } from '@/lib/finance/model';
import { logger } from '@/lib/logger';

type SupabaseClientLike = TypedSupabaseClient;
type TransactionLine = {
  id?: string | number | null;
  transaction_id?: string | number | null;
  lease_id?: string | number | null;
  unit_id?: string | null;
  property_id?: string | null;
  buildium_lease_id?: string | number | null;
  date?: string | null;
  amount?: number | null;
  posting_type?: string | null;
  gl_account_id?: string | null;
  gl_accounts?: {
    name?: string | null;
    type?: string | null;
    sub_type?: string | null;
    is_bank_account?: boolean | null;
    is_security_deposit_liability?: boolean | null;
    exclude_from_cash_balances?: boolean | null;
  } | null;
};

type Transaction = {
  id?: string | number | null;
  total_amount?: number | null;
  transaction_type?: string | null;
  buildium_transaction_id?: string | number | null;
  buildium_lease_id?: string | number | null;
  lease_id?: string | number | null;
  date?: string | null;
};

type RollupResult = {
  fin: FinanceRollupResult['fin'];
  debug?: FinanceRollupResult['debug'] & { rpcFin?: unknown };
};

export async function fetchPropertyFinancials(
  propertyId: string,
  asOf: string,
  db: SupabaseClientLike = supabaseAdmin,
): Promise<RollupResult> {
  // 1) Try RPC for telemetry (do not trust cached values for UI)
  let rpcFin: unknown = null;
  try {
    const { data, error } = await db.rpc('get_property_financials', {
      p_property_id: propertyId,
      p_as_of: asOf,
    });
    if (error) {
      logger.error({ error, propertyId, asOf }, '[property-finance] RPC error');
    } else {
      rpcFin = data;
    }
  } catch (e) {
    logger.error({ error: e, propertyId, asOf }, '[property-finance] RPC call failed');
  }

  // 2) Derive via shared rollup (bank/payment/deposit/prepay)
  const { data: property, error: propertyError } = await db
    .from('properties')
    .select('id, reserve, operating_bank_gl_account_id, deposit_trust_gl_account_id')
    .eq('id', propertyId)
    .single();
  if (propertyError) {
    logger.warn({ error: propertyError, propertyId }, '[property-finance] property fetch error');
  }

  const { data: unitRows } = await db.from('units').select('id').eq('property_id', propertyId);
  const unitIds =
    Array.isArray(unitRows) && unitRows.length
      ? unitRows
          .map((u) => (u?.id != null ? String(u.id) : null))
          .filter((v): v is string => !!v)
      : [];

  const { data: leaseRows } = await db
    .from('lease')
    .select('id, buildium_lease_id')
    .eq('property_id', propertyId);
  const leaseIds =
    Array.isArray(leaseRows) && leaseRows.length
      ? leaseRows
          .map((l) => (l?.id != null ? String(l.id) : null))
          .filter((v): v is string => !!v)
      : [];
  const buildiumLeaseIds =
    Array.isArray(leaseRows) && leaseRows.length
      ? leaseRows
          .map((l) => l?.buildium_lease_id)
          .filter((v): v is number => typeof v === 'number')
      : [];

  const lineSelect =
    'id, transaction_id, lease_id, unit_id, property_id, buildium_lease_id, date, amount, posting_type, gl_account_id, gl_accounts(name, type, sub_type, is_bank_account, is_security_deposit_liability, exclude_from_cash_balances)';
  const lineMap = new Map<string, TransactionLine>();
  const collectLines = (rows?: TransactionLine[] | null) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      if (row?.gl_accounts?.exclude_from_cash_balances === true) continue;
      const key =
        row?.id != null
          ? String(row.id)
          : `${row?.transaction_id ?? ''}:${row?.gl_account_id ?? ''}:${row?.amount ?? ''}:${row?.posting_type ?? ''}`;
      if (!lineMap.has(key)) lineMap.set(key, row);
    }
  };

  const { data: propertyLines } = await db
    .from('transaction_lines')
    .select(lineSelect)
    .eq('property_id', propertyId)
    .lte('date', asOf);
  collectLines(propertyLines);

  if (unitIds.length) {
    const { data: unitLines } = await db
      .from('transaction_lines')
      .select(lineSelect)
      .in('unit_id', unitIds)
      .lte('date', asOf);
    collectLines(unitLines);
  }

  if (leaseIds.length) {
    const { data: leaseLines } = await db
      .from('transaction_lines')
      .select(lineSelect)
      .in('lease_id', leaseIds)
      .lte('date', asOf);
    collectLines(leaseLines);
  }

  if (buildiumLeaseIds.length) {
    const { data: buildiumLines } = await db
      .from('transaction_lines')
      .select(lineSelect)
      .in('buildium_lease_id', buildiumLeaseIds)
      .lte('date', asOf);
    collectLines(buildiumLines);
  }

  // Include bank lines tied to the property's configured bank GL accounts even if property_id/unit_id are null.
  // Include both operating bank account and deposit/trust account for deposits/prepayments
  const propertyBankGlAccounts = [
    property?.operating_bank_gl_account_id ?? null,
    property?.deposit_trust_gl_account_id ?? null,
  ]
    .filter(Boolean)
    .map((id) => String(id));

  if (propertyBankGlAccounts.length) {
    const { data: bankLines } = await db
      .from('transaction_lines')
      .select(lineSelect)
      .in('gl_account_id', propertyBankGlAccounts)
      .lte('date', asOf);

    collectLines(bankLines);
  }

  const transactionLines = Array.from(lineMap.values());

  const bankLinesIncluded = transactionLines
    .map((l) => {
      const { bankSigned, flags } = classifyLine(l);
      if (!flags.bank) return null;
      return {
        id: l.id ?? null,
        transaction_id: l.transaction_id ?? null,
        gl_account_id: l.gl_account_id ?? null,
        gl_account_name: l.gl_accounts?.name ?? null,
        amount: l.amount ?? null,
        posting_type: l.posting_type ?? null,
        signed: bankSigned,
        date: l.date ?? null,
        property_id: l.property_id ?? null,
        unit_id: l.unit_id ?? null,
        lease_id: l.lease_id ?? null,
      };
    })
    .filter(Boolean)
    // Avoid extremely large logs while keeping useful visibility
    .slice(0, 200);

  const txMap = new Map<string, Transaction>();
  const addTx = (rows?: Transaction[] | null) => {
    if (!Array.isArray(rows)) return;
    for (const row of rows) {
      const key =
        row?.id != null
          ? `id:${row.id}`
          : row?.buildium_transaction_id != null
            ? `buildium:${row.buildium_transaction_id}`
            : Math.random().toString();
      if (!txMap.has(key)) txMap.set(key, row);
    }
  };

  if (leaseIds.length) {
    const { data: leaseTx } = await db
      .from('transactions')
      .select(
        'id, total_amount, transaction_type, buildium_transaction_id, buildium_lease_id, lease_id, date',
      )
      .in('lease_id', leaseIds)
      .lte('date', asOf);
    addTx(leaseTx);
  }

  if (buildiumLeaseIds.length) {
    const { data: buildiumTx } = await db
      .from('transactions')
      .select(
        'id, total_amount, transaction_type, buildium_transaction_id, buildium_lease_id, lease_id, date',
      )
      .in('buildium_lease_id', buildiumLeaseIds)
      .lte('date', asOf);
    addTx(buildiumTx);
  }

  // Backfill transactions referenced by transaction_lines that aren't tied to leases (e.g., property-only)
  const lineTxIds = Array.from(
    new Set(
      transactionLines
        .map((l) => {
          const raw = l?.transaction_id;
          if (raw == null) return null;
          return String(raw);
        })
        .filter(Boolean),
    ),
  );
  if (lineTxIds.length) {
    const missingIds = lineTxIds.filter((id): id is string => {
      if (!id) return false;
      return !Array.from(txMap.keys()).some(
        (key) => key === `id:${id}` || key.includes(String(id)),
      );
    });
    if (missingIds.length) {
      const { data: extraTx } = await db
        .from('transactions')
        .select(
          'id, total_amount, transaction_type, buildium_transaction_id, buildium_lease_id, lease_id, date',
        )
        .in('id', missingIds);
      addTx(extraTx);
    }
  }

  // Synthesize payment-like transactions from lines when no real transactions exist for those IDs
  const txIdsInLines = Array.from(
    new Set(
      transactionLines
        .map((l) => (l?.transaction_id != null ? String(l.transaction_id) : null))
        .filter(Boolean),
    ),
  );
  for (const txId of txIdsInLines) {
    const hasTx = Array.from(txMap.keys()).some((key) => key === `id:${txId}` || key === txId);
    if (hasTx) continue;
    const totalFromLines = transactionLines
      .filter((l) => String(l?.transaction_id || '') === txId)
      .reduce((sum: number, l) => sum + Math.abs(Number(l?.amount) || 0), 0);
    if (totalFromLines) {
      txMap.set(`synth:${txId}`, {
        id: txId,
        total_amount: totalFromLines,
        transaction_type: 'PaymentFromLines',
      });
    }
  }

  const transactions = Array.from(txMap.values());

  const { fin: derivedFin, debug } = rollupFinances({
    transactionLines,
    transactions,
    unitBalances: {
      balance: 0,
      deposits_held_balance: 0, // Properties don't have deposits_held_balance; calculated from transaction lines
      prepayments_balance: 0, // Properties don't have prepayments_balance; calculated from transaction lines
    },
    propertyReserve: property?.reserve ?? 0,
    today: new Date(asOf),
  });

  // Ensure as_of is set to the requested date
  derivedFin.as_of = asOf;

  if (debug?.incompleteBankLines) {
    logger.warn(
      {
        propertyId,
        asOf,
        bankTotal: debug?.totals?.bank,
        paymentsTotal: debug?.totals?.payments,
        bankLineCount: debug?.bankLineCount,
      },
      '[property-finance] Incomplete bank lines detected',
    );
  }

  logger.info(
    {
      propertyId,
      asOf,
      usedBankBalance: debug?.usedBankBalance,
      usedPaymentFallback: debug?.usedPaymentFallback,
      bankTotal: debug?.totals?.bank,
      bankLineCount: debug?.bankLineCount,
      bankLinesIncluded,
      note: bankLinesIncluded.length === 200 ? 'truncated at 200 lines' : undefined,
    },
    '[property-finance] Cash balance transaction_lines used',
  );

  return { fin: derivedFin, debug: { ...debug, rpcFin } };
}
