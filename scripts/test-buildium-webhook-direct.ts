/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/**
 * Direct test script to process a Buildium webhook event
 * Simulates the edge function processing logic for BankAccount.Transaction.Created
 */

// Load environment variables BEFORE any imports
import { config } from 'dotenv';
import { resolve } from 'path';

// Try loading .env.local first, then .env
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const WEBHOOK_EVENT = {
  AccountId: 514306,
  EventName: 'BankAccount.Transaction.Created',
  BankAccountId: 10407,
  EventDateTime: '2025-12-21T01:31:55.2592027Z',
  TransactionId: 974932,
  TransactionType: 'Deposit',
};

async function resolveOrgIdFromBuildiumAccount(supabase: any, accountId?: number | null) {
  if (!accountId) return null;
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('buildium_org_id', accountId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.id ?? null;
}

async function resolveUndepositedFundsGlAccountId(
  supabase: any,
  orgId: string | null,
): Promise<string | null> {
  const lookup = async (column: 'default_account_name' | 'name'): Promise<string | null> => {
    let query = supabase.from('gl_accounts').select('id').ilike(column, '%undeposited funds%');
    if (orgId) query = query.eq('org_id', orgId);
    const { data, error } = await query.limit(1).maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return (data as any)?.id ?? null;
  };

  const scopedDefault = await lookup('default_account_name');
  if (scopedDefault) return scopedDefault;
  const scopedName = await lookup('name');
  if (scopedName) return scopedName;

  const { data: globalDefault } = await supabase
    .from('gl_accounts')
    .select('id')
    .ilike('default_account_name', '%undeposited funds%')
    .limit(1)
    .maybeSingle();
  if ((globalDefault as any)?.id) return (globalDefault as any).id;

  const { data: globalName } = await supabase
    .from('gl_accounts')
    .select('id')
    .ilike('name', '%undeposited funds%')
    .limit(1)
    .maybeSingle();
  if ((globalName as any)?.id) return (globalName as any).id;

  return null;
}

async function ensureBankGlAccount(
  supabase: any,
  bankAccount: any,
  orgId: string | null,
): Promise<{ glAccountId: string | null; glAccountBuildiumId: number | null }> {
  const bankAccountId = bankAccount?.Id ?? bankAccount?.BankAccountId ?? null;
  const glBuildiumId =
    bankAccount?.GLAccount?.Id ?? bankAccount?.GLAccountId ?? bankAccount?.GLAccountID ?? null;

  // In this schema, bank accounts are represented by `gl_accounts` where `buildium_gl_account_id`
  // stores the Buildium *BankAccountId* (from the webhook payload).
  if (bankAccountId) {
    let byBankAccountIdQuery = supabase
      .from('gl_accounts')
      .select('id, buildium_gl_account_id')
      .eq('buildium_gl_account_id', bankAccountId)
      .eq('is_bank_account', true)
      .limit(1);
    if (orgId) byBankAccountIdQuery = byBankAccountIdQuery.eq('org_id', orgId);
    const { data: existingByBankAccountId } = await byBankAccountIdQuery.maybeSingle();
    if ((existingByBankAccountId as any)?.id) {
      return {
        glAccountId: (existingByBankAccountId as any).id,
        glAccountBuildiumId: bankAccountId,
      };
    }
  }

  // Secondary: try nested GLAccount.Id if present (some envs store true GL ids here).
  if (glBuildiumId) {
    let byGlQuery = supabase
      .from('gl_accounts')
      .select('id, buildium_gl_account_id')
      .eq('buildium_gl_account_id', glBuildiumId)
      .limit(1);
    if (orgId) byGlQuery = byGlQuery.eq('org_id', orgId);
    const { data: existingByGl } = await byGlQuery.maybeSingle();
    if ((existingByGl as any)?.id) {
      return {
        glAccountId: (existingByGl as any).id,
        glAccountBuildiumId: glBuildiumId,
      };
    }
  }

  if (!bankAccount) {
    return { glAccountId: null, glAccountBuildiumId: glBuildiumId ?? null };
  }

  // If we don't have a GL account ID, we cannot create the GL account (it's required)
  const buildiumIdForRow = bankAccountId ?? glBuildiumId ?? null;
  if (!buildiumIdForRow) {
    console.warn(
      `⚠️  Bank account ${bankAccountId} has no GL account ID, cannot create GL account record`,
    );
    return { glAccountId: null, glAccountBuildiumId: null };
  }

  const now = new Date().toISOString();
  const insertPayload: any = {
    name: bankAccount?.Name ?? 'Bank Account',
    description: bankAccount?.Description ?? null,
    bank_account_number: bankAccount?.AccountNumberUnmasked ?? bankAccount?.AccountNumber ?? null,
    type: (bankAccount?.GLAccount?.Type as any) || 'asset',
    sub_type: bankAccount?.GLAccount?.SubType ?? null,
    is_active: bankAccount?.IsActive ?? true,
    is_bank_account: true,
    buildium_gl_account_id: buildiumIdForRow, // For bank accounts, prefer BankAccountId
    cash_flow_classification: bankAccount?.GLAccount?.CashFlowClassification ?? null,
    exclude_from_cash_balances: bankAccount?.ExcludeFromCashBalances ?? false,
    org_id: orgId ?? null,
    created_at: now,
    updated_at: now,
  };

  const { data: created, error: insErr } = await supabase
    .from('gl_accounts')
    .insert(insertPayload)
    .select('id')
    .maybeSingle();
  if (insErr) throw insErr;

  return { glAccountId: (created as any)?.id ?? null, glAccountBuildiumId: buildiumIdForRow };
}

async function fetchBankDeposit(bankAccountId: number, depositId: number) {
  const baseUrl = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1';
  const clientId = process.env.BUILDIUM_CLIENT_ID;
  const clientSecret = process.env.BUILDIUM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('BUILDIUM_CLIENT_ID and BUILDIUM_CLIENT_SECRET must be set');
  }

  const url = `${baseUrl}/bankaccounts/${bankAccountId}/deposits/${depositId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-buildium-client-id': clientId,
      'x-buildium-client-secret': clientSecret,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Buildium API error: ${response.status} ${response.statusText}. ${errorText}`);
  }

  return response.json();
}

async function fetchBankAccount(bankAccountId: number) {
  const baseUrl = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1';
  const clientId = process.env.BUILDIUM_CLIENT_ID;
  const clientSecret = process.env.BUILDIUM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('BUILDIUM_CLIENT_ID and BUILDIUM_CLIENT_SECRET must be set');
  }

  const url = `${baseUrl}/bankaccounts/${bankAccountId}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-buildium-client-id': clientId,
      'x-buildium-client-secret': clientSecret,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Buildium API error: ${response.status} ${response.statusText}. ${errorText}`);
  }

  return response.json();
}

async function fetchGeneralLedgerTransaction(transactionId: number) {
  const baseUrl = process.env.BUILDIUM_BASE_URL || 'https://apisandbox.buildium.com/v1';
  const clientId = process.env.BUILDIUM_CLIENT_ID;
  const clientSecret = process.env.BUILDIUM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('BUILDIUM_CLIENT_ID and BUILDIUM_CLIENT_SECRET must be set');
  }

  // NOTE: The authoritative source for this endpoint is "Open API, powered by Buildium (v1)".
  // This code tries `/generalledger/transactions/{id}` first (as referenced in the webhook handler),
  // and falls back to `/gltransactions/{id}` if the first path 404s.
  const candidates = [
    `${baseUrl}/generalledger/transactions/${transactionId}`,
    `${baseUrl}/gltransactions/${transactionId}`,
  ];

  let lastErr: Error | null = null;
  for (const url of candidates) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-buildium-client-id': clientId,
        'x-buildium-client-secret': clientSecret,
      },
    });

    if (response.ok) return response.json();

    if (response.status === 404) {
      lastErr = new Error(`Not found: ${url}`);
      continue;
    }

    const errorText = await response.text().catch(() => '');
    throw new Error(`Buildium API error: ${response.status} ${response.statusText}. ${errorText}`);
  }

  throw lastErr ?? new Error('Failed to fetch GL transaction');
}

export async function processBankAccountTransactionEvent(supabase: any, event: any) {
  console.log('\n📦 Processing BankAccount.Transaction.Created event...');
  console.log('Event details:', {
    AccountId: event.AccountId,
    BankAccountId: event.BankAccountId,
    TransactionId: event.TransactionId,
    TransactionType: event.TransactionType,
  });

  const bankAccountId =
    event?.BankAccountId ?? event?.Data?.BankAccountId ?? event?.EntityId ?? null;
  const depositId = event?.TransactionId ?? event?.Data?.TransactionId ?? null;
  const accountId = event?.AccountId ?? event?.Data?.AccountId ?? null;
  const transactionTypeRaw = event?.TransactionType ?? event?.Data?.TransactionType ?? null;

  if (!bankAccountId || !depositId) {
    throw new Error('Missing BankAccountId or TransactionId on webhook event');
  }

  // Guard: this handler currently supports deposit fetch + reconciliation only.
  if (
    transactionTypeRaw &&
    String(transactionTypeRaw).trim().length > 0 &&
    String(transactionTypeRaw).toLowerCase() !== 'deposit'
  ) {
    console.log('⚠️  Skipping non-deposit transaction');
    return { success: true, skipped: true, reason: 'non-deposit-transaction' };
  }

  console.log('✅ Transaction type is Deposit, proceeding...');

  const orgId = await resolveOrgIdFromBuildiumAccount(supabase, accountId);
  console.log(`📍 Resolved org_id: ${orgId || 'null'}`);

  console.log(`\n🔍 Fetching deposit from Buildium API...`);
  console.log(`   BankAccountId: ${bankAccountId}, DepositId: ${depositId}`);
  let deposit: any = null;
  try {
    deposit = await fetchBankDeposit(Number(bankAccountId), Number(depositId));
    console.log('✅ Deposit fetched successfully');
    console.log(
      `   Amount: ${deposit?.Amount ?? deposit?.TotalAmount ?? deposit?.DepositAmount ?? 'N/A'}`,
    );
    console.log(
      `   Date: ${deposit?.Date ?? deposit?.CreatedDate ?? deposit?.DepositDate ?? 'N/A'}`,
    );
  } catch (err: any) {
    const message = err?.message || 'Failed to fetch bank deposit';
    console.error('❌ Failed to fetch deposit:', message);
    return { success: false, error: message };
  }

  // Fetch full bank account details to get GL account information
  let bankAccountPayload = deposit?.BankAccount ?? deposit;
  if (!bankAccountPayload?.GLAccount?.Id && !bankAccountPayload?.GLAccountId) {
    console.log(`   Bank account details missing GL account, fetching full bank account...`);
    try {
      bankAccountPayload = await fetchBankAccount(Number(bankAccountId));
      console.log(`   ✅ Fetched bank account details`);
    } catch (err: any) {
      console.warn(
        `   ⚠️  Could not fetch bank account details: ${err?.message || 'unknown error'}`,
      );
    }
  }

  console.log(`\n🏦 Resolving bank GL account...`);
  const { glAccountId: bankGlAccountId, glAccountBuildiumId } = await ensureBankGlAccount(
    supabase,
    bankAccountPayload,
    orgId ?? null,
  );
  if (!bankGlAccountId) {
    console.error('❌ Bank GL account not resolved');
    return { success: false, error: 'Bank GL account not resolved for bank account transaction' };
  }
  console.log(`✅ Bank GL account resolved: ${bankGlAccountId}`);

  console.log(`\n💵 Resolving Undeposited Funds GL account...`);
  const udfGlAccountId = await resolveUndepositedFundsGlAccountId(supabase, orgId ?? null);
  if (!udfGlAccountId) {
    console.error('❌ Undeposited Funds GL account not found');
    return { success: false, error: 'Undeposited Funds GL account not found' };
  }
  console.log(`✅ Undeposited Funds GL account resolved: ${udfGlAccountId}`);

  const now = new Date().toISOString();
  const headerDate =
    deposit?.Date ??
    deposit?.CreatedDate ??
    deposit?.DepositDate ??
    new Date().toISOString().slice(0, 10);

  // Build a normalized list of payment components for this deposit:
  // Prefer PaymentTransactions (with amounts), else fall back to PaymentTransactionIds.
  let rawPaymentTransactions: any[] = Array.isArray(deposit?.PaymentTransactions)
    ? deposit.PaymentTransactions
    : Array.isArray(deposit?.DepositDetails?.PaymentTransactions)
      ? deposit.DepositDetails.PaymentTransactions
      : [];

  if (!rawPaymentTransactions.length) {
    try {
      const depositGlTx = await fetchGeneralLedgerTransaction(Number(depositId));
      const glPts = Array.isArray(depositGlTx?.DepositDetails?.PaymentTransactions)
        ? depositGlTx.DepositDetails.PaymentTransactions
        : [];
      if (glPts.length) rawPaymentTransactions = glPts;
    } catch (err: any) {
      console.warn('⚠️  Failed to fetch GL transaction for deposit to resolve payment splits', {
        depositId,
        err: err?.message ?? String(err),
      });
    }
  }

  const rawPaymentTransactionIds: number[] = Array.from(
    new Set<number>(
      [
        ...(Array.isArray((deposit as any)?.PaymentTransactionIds)
          ? (deposit as any).PaymentTransactionIds
          : []),
        ...(Array.isArray((deposit as any)?.PaymentTransactionIDs)
          ? (deposit as any).PaymentTransactionIDs
          : []),
        ...(Array.isArray((deposit as any)?.DepositDetails?.PaymentTransactionIds)
          ? (deposit as any).DepositDetails.PaymentTransactionIds
          : []),
        ...(Array.isArray((deposit as any)?.DepositDetails?.PaymentTransactionIDs)
          ? (deposit as any).DepositDetails.PaymentTransactionIDs
          : []),
      ]
        .map((n: any) => Number(n))
        .filter((n: any) => Number.isFinite(n)),
    ),
  );

  const paymentParts: Array<{ id: number; amount: number | null; raw?: any }> = [];
  if (rawPaymentTransactions.length > 0) {
    for (const pt of rawPaymentTransactions) {
      const id = Number(pt?.Id ?? pt?.ID ?? pt?.PaymentTransactionId ?? pt?.PaymentTransactionID);
      if (!Number.isFinite(id)) continue;
      const amtRaw = pt?.Amount;
      const amount = amtRaw != null && Number.isFinite(Number(amtRaw)) ? Number(amtRaw) : null;
      paymentParts.push({ id, amount, raw: pt });
    }
  } else if (rawPaymentTransactionIds.length > 0) {
    for (const id of rawPaymentTransactionIds) {
      paymentParts.push({ id, amount: null });
    }
  }

  console.log(
    `\n🔎 Deposit payment references (from payload/GL fallback): ${paymentParts.length} id(s)`,
    paymentParts.map((p) => p.id),
  );

  // Resolve per-payment property/unit context from the underlying payment transaction rows.
  const resolvedSplits: Array<{
    paymentId: number;
    amount: number;
    property_id: string | null;
    unit_id: string | null;
    lease_id: string | null;
    buildium_property_id: number | null;
    buildium_unit_id: number | null;
    buildium_lease_id: number | null;
  }> = [];

  const resolvePropertyIdFromBuildium = async (
    buildiumPropId: number | null | undefined,
  ): Promise<string | null> => {
    if (!buildiumPropId) return null;
    const { data, error } = await supabase
      .from('properties')
      .select('id')
      .eq('buildium_property_id', buildiumPropId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return (data as any)?.id ?? null;
  };

  const resolveUnitIdFromBuildium = async (
    buildiumUnitId: number | null | undefined,
  ): Promise<string | null> => {
    if (!buildiumUnitId) return null;
    const { data, error } = await supabase
      .from('units')
      .select('id')
      .eq('buildium_unit_id', buildiumUnitId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return (data as any)?.id ?? null;
  };

  for (const part of paymentParts) {
    const { data: txRow, error: txErr } = await supabase
      .from('transactions')
      .select(
        // NOTE: some deployments do not have property_id on transactions; property context lives on transaction_lines.
        'id, total_amount',
      )
      .eq('buildium_transaction_id', part.id)
      .maybeSingle();
    if (txErr && txErr.code !== 'PGRST116') throw txErr;
    if (!(txRow as any)?.id) {
      // Fallback: use AccountingEntity from raw payment transaction when local tx not found.
      if (part.raw?.AccountingEntity?.AccountingEntityType === 'Rental') {
        const buildiumRentalId = Number(part.raw?.AccountingEntity?.Id);
        const amount =
          part.amount != null && Number.isFinite(part.amount) ? Math.abs(part.amount) : null;
        const propertyId = Number.isFinite(buildiumRentalId)
          ? await resolvePropertyIdFromBuildium(buildiumRentalId)
          : null;
        if (propertyId && amount != null && Number.isFinite(amount) && amount > 0) {
          resolvedSplits.push({
            paymentId: part.id,
            amount,
            property_id: propertyId,
            unit_id: null,
            lease_id: null,
            buildium_property_id: buildiumRentalId,
            buildium_unit_id: null,
            buildium_lease_id: null,
          });
        }
      }
      continue;
    }

    const paymentTransactionLocalId = (txRow as any).id;
    const { data: ctxLines, error: ctxErr } = await supabase
      .from('transaction_lines')
      .select(
        'property_id, unit_id, lease_id, buildium_property_id, buildium_unit_id, buildium_lease_id, amount, posting_type',
      )
      .eq('transaction_id', paymentTransactionLocalId)
      .limit(50);
    if (ctxErr && ctxErr.code !== 'PGRST116') throw ctxErr;

    const lineList = Array.isArray(ctxLines) ? ctxLines : ctxLines ? [ctxLines] : [];
    const bestLine =
      lineList.find((l: any) => l?.property_id != null) ??
      lineList.find((l: any) => l?.buildium_property_id != null) ??
      lineList[0] ??
      null;

    const derivedAmount =
      part.amount != null && Number.isFinite(part.amount)
        ? Math.abs(part.amount)
        : (() => {
            const totalFromTx = Math.abs(Number((txRow as any)?.total_amount ?? 0) || 0);
            const lineAmt = Math.abs(Number((bestLine as any)?.amount ?? 0) || 0);
            return lineAmt > 0 ? lineAmt : totalFromTx;
          })();
    if (!Number.isFinite(derivedAmount) || derivedAmount <= 0) continue;

    let propertyId: string | null = (bestLine as any)?.property_id ?? null;
    let unitId: string | null = (bestLine as any)?.unit_id ?? null;
    const leaseId: string | null = (bestLine as any)?.lease_id ?? null;
    const buildiumPropertyId: number | null = (bestLine as any)?.buildium_property_id ?? null;
    const buildiumUnitId: number | null = (bestLine as any)?.buildium_unit_id ?? null;
    const buildiumLeaseId: number | null = (bestLine as any)?.buildium_lease_id ?? null;

    if (!propertyId && buildiumPropertyId) {
      propertyId = await resolvePropertyIdFromBuildium(buildiumPropertyId);
    }
    if (!unitId && buildiumUnitId) {
      unitId = await resolveUnitIdFromBuildium(buildiumUnitId);
    }

    resolvedSplits.push({
      paymentId: part.id,
      amount: derivedAmount,
      property_id: propertyId,
      unit_id: unitId,
      lease_id: leaseId,
      buildium_property_id: buildiumPropertyId,
      buildium_unit_id: buildiumUnitId,
      buildium_lease_id: buildiumLeaseId,
    });
  }

  console.log(
    `Resolved splits: ${resolvedSplits.length} (property_id set on ${resolvedSplits.filter((s) => s.property_id != null).length})`,
  );

  const totalFromResolvedSplits = resolvedSplits.reduce(
    (sum, s) => sum + (Number.isFinite(s.amount) ? s.amount : 0),
    0,
  );
  const headerTotalFromDeposit =
    Number(deposit?.Amount ?? deposit?.TotalAmount ?? deposit?.DepositAmount ?? 0) || 0;
  const totalAmount =
    totalFromResolvedSplits > 0
      ? totalFromResolvedSplits
      : headerTotalFromDeposit ||
        rawPaymentTransactions.reduce((sum: number, pt: any) => {
          const amt = Number(pt?.Amount ?? 0);
          return sum + (Number.isFinite(amt) ? amt : 0);
        }, 0);

  const header = {
    buildium_transaction_id: depositId,
    transaction_type: 'Deposit',
    total_amount: totalAmount,
    date: headerDate,
    memo: deposit?.Memo ?? deposit?.Description ?? null,
    bank_gl_account_id: bankGlAccountId,
    bank_gl_account_buildium_id: glAccountBuildiumId ?? null,
    org_id: orgId ?? null,
    updated_at: now,
  };

  console.log(`\n💾 Upserting transaction record...`);
  console.log(`   Transaction ID (Buildium): ${depositId}`);
  console.log(`   Total Amount: ${totalAmount}`);
  console.log(`   Date: ${headerDate}`);

  const { data: existingTx, error: findTxErr } = await supabase
    .from('transactions')
    .select('id, created_at')
    .eq('buildium_transaction_id', depositId)
    .maybeSingle();
  if (findTxErr && findTxErr.code !== 'PGRST116') throw findTxErr;

  let transactionIdLocal: string;
  if ((existingTx as any)?.id) {
    console.log(`   Found existing transaction: ${(existingTx as any).id}`);
    const { data: updated, error: updErr } = await supabase
      .from('transactions')
      .update(header)
      .eq('id', (existingTx as any).id)
      .select('id')
      .maybeSingle();
    if (updErr) throw updErr;
    transactionIdLocal = (updated as any)?.id ?? (existingTx as any).id;
    console.log(`   ✅ Updated existing transaction`);
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('transactions')
      .insert({ ...header, created_at: now })
      .select('id')
      .maybeSingle();
    if (insErr) throw insErr;
    transactionIdLocal = (inserted as any)?.id;
    console.log(`   ✅ Created new transaction: ${transactionIdLocal}`);
  }

  // Replace all existing lines / split link rows for idempotency.
  await supabase.from('transaction_lines').delete().eq('transaction_id', transactionIdLocal);
  await supabase
    .from('transaction_payment_transactions')
    .delete()
    .eq('transaction_id', transactionIdLocal);

  const baseLineFields = {
    transaction_id: transactionIdLocal,
    memo: deposit?.Memo ?? null,
    account_entity_type: 'Rental',
    account_entity_id: deposit?.AccountId ?? null,
    date: headerDate,
    created_at: now,
    updated_at: now,
  };

  console.log(`\n📝 Creating transaction lines...`);
  if (resolvedSplits.length > 0) {
    console.log(
      `   Building ${resolvedSplits.length} per-payment split(s) with property context...`,
    );
    const linesToInsert: any[] = [];
    const splitRows: any[] = [];

    for (const s of resolvedSplits) {
      linesToInsert.push({
        ...baseLineFields,
        gl_account_id: bankGlAccountId,
        amount: s.amount,
        posting_type: 'Debit',
        buildium_property_id: s.buildium_property_id,
        buildium_unit_id: s.buildium_unit_id,
        buildium_lease_id: s.buildium_lease_id,
        lease_id: s.lease_id,
        property_id: s.property_id,
        unit_id: s.unit_id,
      });
      linesToInsert.push({
        ...baseLineFields,
        gl_account_id: udfGlAccountId,
        amount: s.amount,
        posting_type: 'Credit',
        buildium_property_id: s.buildium_property_id,
        buildium_unit_id: s.buildium_unit_id,
        buildium_lease_id: s.buildium_lease_id,
        lease_id: s.lease_id,
        property_id: s.property_id,
        unit_id: s.unit_id,
      });

      splitRows.push({
        transaction_id: transactionIdLocal,
        buildium_payment_transaction_id: s.paymentId,
        accounting_entity_id: null,
        accounting_entity_type: null,
        accounting_entity_href: null,
        accounting_unit_id: null,
        accounting_unit_href: null,
        amount: s.amount,
        created_at: now,
        updated_at: now,
      });
    }

    const { error: linesErr } = await supabase.from('transaction_lines').insert(linesToInsert);
    if (linesErr) throw linesErr;
    console.log(
      `   ✅ Created ${linesToInsert.length} transaction lines (Bank debit + UDF credit per payment)`,
    );

    const { error: splitErr } = await supabase
      .from('transaction_payment_transactions')
      .insert(splitRows);
    if (splitErr) throw splitErr;
    console.log(`   ✅ Created ${splitRows.length} payment transaction linkage row(s)`);
  } else {
    console.log(
      `   ⚠️  No resolvable payment/property context; inserting a single bank/UDF pair (property_id null).`,
    );
    const amountAbs = Math.abs(Number(totalAmount) || 0);
    const { error: linesErr } = await supabase.from('transaction_lines').insert([
      {
        ...baseLineFields,
        gl_account_id: bankGlAccountId,
        amount: amountAbs,
        posting_type: 'Debit',
        buildium_property_id: null,
        buildium_unit_id: null,
        buildium_lease_id: null,
        lease_id: null,
        property_id: null,
        unit_id: null,
      },
      {
        ...baseLineFields,
        gl_account_id: udfGlAccountId,
        amount: amountAbs,
        posting_type: 'Credit',
        buildium_property_id: null,
        buildium_unit_id: null,
        buildium_lease_id: null,
        lease_id: null,
        property_id: null,
        unit_id: null,
      },
    ]);
    if (linesErr) throw linesErr;
    console.log(`   ✅ Created 2 transaction lines (Debit: Bank, Credit: Undeposited Funds)`);

    if (paymentParts.length > 0) {
      console.log(`\n🔗 Persisting payment transaction linkage (no property context available)...`);
      const splitRows = paymentParts.map((p) => ({
        transaction_id: transactionIdLocal,
        buildium_payment_transaction_id: p.id,
        accounting_entity_id: p.raw?.AccountingEntity?.Id ?? null,
        accounting_entity_type: p.raw?.AccountingEntity?.AccountingEntityType ?? null,
        accounting_entity_href: p.raw?.AccountingEntity?.Href ?? null,
        accounting_unit_id:
          p.raw?.AccountingEntity?.Unit?.Id ??
          p.raw?.AccountingEntity?.Unit?.ID ??
          p.raw?.AccountingEntity?.UnitId ??
          null,
        accounting_unit_href: p.raw?.AccountingEntity?.Unit?.Href ?? null,
        amount: p.amount ?? null,
        created_at: now,
        updated_at: now,
      }));
      const { error: splitErr } = await supabase
        .from('transaction_payment_transactions')
        .insert(splitRows);
      if (splitErr) throw splitErr;
      console.log(`   ✅ Created ${splitRows.length} payment transaction linkage row(s)`);
    } else {
      console.log(`\n🔗 No payment transactions to link`);
    }
  }

  console.log(`\n✅ Transaction processing completed successfully!`);
  return {
    success: true,
    transactionId: transactionIdLocal,
    totalAmount,
    date: headerDate,
    paymentTransactionsCount: paymentParts.length,
  };
}

async function testWebhook() {
  console.log('='.repeat(60));
  console.log('Testing Buildium Webhook Event Processing');
  console.log('='.repeat(60));
  console.log('\nEvent Payload:');
  console.log(JSON.stringify(WEBHOOK_EVENT, null, 2));

  // Dynamic import to ensure env vars are loaded first
  const { supabaseAdmin } = await import('../src/lib/db.js');

  try {
    const result = await processBankAccountTransactionEvent(supabaseAdmin, WEBHOOK_EVENT);

    console.log('\n' + '='.repeat(60));
    console.log('Final Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('='.repeat(60));

    if (result.success) {
      console.log('\n✅ Webhook event processed successfully!');
      if ('transactionId' in result) {
        console.log(`\nTransaction ID: ${result.transactionId}`);
        console.log(`Total Amount: ${result.totalAmount}`);
        console.log(`Date: ${result.date}`);
        if ('paymentTransactionsCount' in result) {
          console.log(`Payment Transactions: ${result.paymentTransactionsCount}`);
        }

        // Confirm deposit lines are property-scoped (or not) by querying transaction_lines
        const { data: lineRows, error: linesErr } = await supabaseAdmin
          .from('transaction_lines')
          .select('gl_account_id, posting_type, amount, property_id, unit_id')
          .eq('transaction_id', result.transactionId)
          .order('posting_type', { ascending: true })
          .order('amount', { ascending: false });
        if (linesErr) throw linesErr;

        const lines = (lineRows as any[]) ?? [];
        const scopedCount = lines.filter((l) => l?.property_id != null).length;
        console.log(
          '\nDeposit transaction_lines (gl_account_id, posting_type, amount, property_id, unit_id):',
        );
        console.log(JSON.stringify(lines, null, 2));
        console.log(
          `\nProperty-scoped lines: ${scopedCount}/${lines.length} (property_id != null)`,
        );

        // Print GL account names for the line GL ids (this is what drives ledger groupings).
        const glIds = Array.from(
          new Set(
            lines.map((l) => l?.gl_account_id).filter((v) => typeof v === 'string' && v.length),
          ),
        ) as string[];
        if (glIds.length) {
          const { data: glRows, error: glErr } = await supabaseAdmin
            .from('gl_accounts')
            .select('id, name, default_account_name, org_id, buildium_gl_account_id')
            .in('id', glIds);
          if (glErr) throw glErr;
          console.log('\nGL account details for transaction_lines gl_account_id(s):');
          console.log(JSON.stringify(glRows ?? [], null, 2));
        }
      }
    } else {
      console.log('\n❌ Webhook event processing failed!');
      if ('error' in result) {
        console.log(`Error: ${result.error}`);
      }
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Error processing webhook:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testWebhook()
  .then(() => {
    console.log('\n✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
