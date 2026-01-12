// deno-lint-ignore-file
import '../_shared/buildiumEgressGuard.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyBuildiumSignature } from '../_shared/buildiumSignature.ts';
import { insertBuildiumWebhookEventRecord } from '../_shared/webhookEvents.ts';
import { validateBuildiumEvent } from '../_shared/eventValidation.ts';
import {
  LeaseTransactionsWebhookPayloadSchema,
  deriveEventType,
  type BuildiumWebhookEvent,
  type LeaseTransactionsWebhookPayload,
  validateWebhookPayload,
} from '../_shared/webhookSchemas.ts';
import { routeLeaseTransactionWebhookEvent } from '../_shared/eventRouting.ts';
import { emitRoutingTelemetry } from '../_shared/telemetry.ts';
import { sendPagerDutyEvent } from '../_shared/pagerDuty.ts';
import { resolveLeaseWithOrg } from '../_shared/leaseResolver.ts';
import { assertBuildiumEnabledEdge } from '../_shared/buildiumGate.ts';
import { buildiumFetchEdge } from '../_shared/buildiumFetch.ts';

type BuildiumCredentials = { baseUrl: string; clientId: string; clientSecret: string };

// Buildium API Client for lease transactions
class BuildiumClient {
  private supabase: any;
  private orgId?: string;
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;

  constructor(opts?: { baseUrl?: string; clientId?: string; clientSecret?: string; supabase: any; orgId?: string }) {
    if (!opts?.clientId || !opts?.clientSecret) {
      throw new Error('Missing Buildium credentials for lease transactions');
    }
    this.supabase = opts.supabase;
    this.orgId = opts.orgId;
    this.baseUrl = (opts.baseUrl || 'https://apisandbox.buildium.com/v1').replace(/\/$/, '');
    this.clientId = opts.clientId;
    this.clientSecret = opts.clientSecret;
  }

  private async makeRequest<T>(method: string, endpoint: string): Promise<T> {
    if (!this.orgId) {
      throw new Error('orgId required for Buildium lease transaction fetch');
    }
    await assertBuildiumEnabledEdge(this.supabase, this.orgId);
    const response = await buildiumFetchEdge(
      this.supabase,
      this.orgId,
      method,
      endpoint,
      undefined,
      {
        baseUrl: this.baseUrl,
        clientId: this.clientId,
        clientSecret: this.clientSecret,
      },
    );

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async getLeaseTransaction(leaseId: number, id: number): Promise<any> {
    return this.makeRequest('GET', `/leases/${leaseId}/transactions/${id}`);
  }

  async getGLAccount(id: number): Promise<any> {
    return this.makeRequest('GET', `/glaccounts/${id}`);
  }
}

// Data mapping function for lease transactions -> transactions table
export function mapLeaseTransactionFromBuildium(buildiumTransaction: any): any {
  const txType = buildiumTransaction?.TransactionTypeEnum || buildiumTransaction?.TransactionType;
  const amount =
    typeof buildiumTransaction?.TotalAmount === 'number'
      ? buildiumTransaction.TotalAmount
      : (buildiumTransaction?.Amount ?? 0);
  const date =
    buildiumTransaction?.Date ||
    buildiumTransaction?.TransactionDate ||
    buildiumTransaction?.PostDate;
  const paymentDetail = buildiumTransaction?.PaymentDetail ?? null;
  const payee = paymentDetail?.Payee ?? null;
  const unitAgreement = buildiumTransaction?.UnitAgreement ?? null;
  const unitId =
    buildiumTransaction?.UnitId ?? buildiumTransaction?.Unit?.Id ?? buildiumTransaction?.Unit?.ID;

  return {
    buildium_transaction_id: buildiumTransaction?.Id,
    date: (date || new Date().toISOString()).slice(0, 10),
    transaction_type: txType,
    total_amount: Number(amount || 0),
    check_number: buildiumTransaction?.CheckNumber ?? null,
    memo: buildiumTransaction?.Memo || buildiumTransaction?.Journal?.Memo || null,
    buildium_lease_id: buildiumTransaction?.LeaseId ?? null,
    payee_tenant_id: buildiumTransaction?.PayeeTenantId ?? null,
    payment_method: null,
    payment_method_raw: paymentDetail?.PaymentMethod ?? buildiumTransaction?.PaymentMethod ?? null,
    payee_buildium_id: payee?.Id ?? null,
    payee_buildium_type: payee?.Type ?? null,
    payee_name: payee?.Name ?? null,
    payee_href: payee?.Href ?? null,
    is_internal_transaction: paymentDetail?.IsInternalTransaction ?? null,
    internal_transaction_is_pending: paymentDetail?.InternalTransactionStatus?.IsPending ?? null,
    internal_transaction_result_date: paymentDetail?.InternalTransactionStatus?.ResultDate ?? null,
    internal_transaction_result_code: paymentDetail?.InternalTransactionStatus?.ResultCode ?? null,
    buildium_unit_id: unitId ?? null,
    buildium_unit_number: buildiumTransaction?.UnitNumber ?? buildiumTransaction?.Unit?.Number ?? null,
    buildium_application_id: buildiumTransaction?.Application?.Id ?? null,
    unit_agreement_id: unitAgreement?.Id ?? null,
    unit_agreement_type: unitAgreement?.Type ?? null,
    unit_agreement_href: unitAgreement?.Href ?? null,
    buildium_last_updated_at: buildiumTransaction?.LastUpdatedDateTime ?? null,
    bank_gl_account_buildium_id: buildiumTransaction?.DepositDetails?.BankGLAccountId ?? null,
    updated_at: new Date().toISOString(),
  };
}

function normalizeDate(d?: string | null): string | null {
  if (!d) return null;
  // Avoid timezone shifts: prefer direct string slicing
  const s = String(d);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (s.includes('T')) return s.slice(0, 10);
  return null;
}

function resolvePostingType(line: any): 'Debit' | 'Credit' {
  const raw =
    typeof line?.PostingType === 'string'
      ? line.PostingType
      : typeof line?.posting_type === 'string'
        ? line.posting_type
        : typeof line?.PostingTypeEnum === 'string'
          ? line.PostingTypeEnum
          : typeof line?.PostingTypeString === 'string'
            ? line.PostingTypeString
            : typeof line?.postingType === 'string'
              ? line.postingType
              : null;
  const normalized = (raw || '').toLowerCase();
  if (normalized === 'debit' || normalized === 'dr' || normalized.includes('debit')) return 'Debit';
  if (normalized === 'credit' || normalized === 'cr' || normalized.includes('credit'))
    return 'Credit';
  const amountNum = Number(line?.Amount ?? 0);
  return amountNum < 0 ? 'Debit' : 'Credit';
}

async function resolveLocalPropertyId(
  supabase: any,
  buildiumPropertyId: number | null | undefined,
): Promise<string | null> {
  if (!buildiumPropertyId) return null;
  const { data, error } = await supabase
    .from('properties')
    .select('id')
    .eq('buildium_property_id', buildiumPropertyId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.id ?? null;
}

async function resolveLocalUnitId(
  supabase: any,
  buildiumUnitId: number | null | undefined,
): Promise<string | null> {
  if (!buildiumUnitId) return null;
  const { data, error } = await supabase
    .from('units')
    .select('id')
    .eq('buildium_unit_id', buildiumUnitId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.id ?? null;
}

async function resolveLocalTenantId(
  supabase: any,
  buildiumTenantId: number | null | undefined,
): Promise<{ id: number; org_id: string | null } | null> {
  if (!buildiumTenantId) return null;
  const { data, error } = await supabase
    .from('tenants')
    .select('id, org_id')
    .eq('buildium_tenant_id', buildiumTenantId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

async function resolveGLAccountId(
  supabase: any,
  buildiumClient: BuildiumClient,
  buildiumGLAccountId: number | null | undefined,
): Promise<string | null> {
  if (!buildiumGLAccountId) return null;

  const { data: existing, error: findErr } = await supabase
    .from('gl_accounts')
    .select('id')
    .eq('buildium_gl_account_id', buildiumGLAccountId)
    .single();
  if (findErr && findErr.code !== 'PGRST116') throw findErr;
  if (existing) return existing.id;

  // Fetch from Buildium and insert minimal row
  const remote = await buildiumClient.getGLAccount(buildiumGLAccountId);
  const now = new Date().toISOString();
  const row = {
    buildium_gl_account_id: remote.Id,
    account_number: remote.AccountNumber ?? null,
    name: remote.Name,
    description: remote.Description ?? null,
    type: remote.Type,
    sub_type: remote.SubType ?? null,
    is_default_gl_account: !!remote.IsDefaultGLAccount,
    default_account_name: remote.DefaultAccountName ?? null,
    is_contra_account: !!remote.IsContraAccount,
    is_bank_account: !!remote.IsBankAccount,
    cash_flow_classification: remote.CashFlowClassification ?? null,
    exclude_from_cash_balances: !!remote.ExcludeFromCashBalances,
    is_active: remote.IsActive ?? true,
    buildium_parent_gl_account_id: remote.ParentGLAccountId ?? null,
    is_credit_card_account: !!remote.IsCreditCardAccount,
    sub_accounts: null,
    created_at: now,
    updated_at: now,
  };
  const { data: inserted, error: insErr } = await supabase
    .from('gl_accounts')
    .insert(row)
    .select('id')
    .single();
  if (insErr) throw insErr;
  return inserted.id;
}

async function resolveOrgIdFromBuildiumAccount(
  supabase: any,
  accountId: number | null | undefined,
): Promise<string | null> {
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

  const globalDefault = await supabase
    .from('gl_accounts')
    .select('id')
    .ilike('default_account_name', '%undeposited funds%')
    .limit(1)
    .maybeSingle();
  if ((globalDefault.data as any)?.id) return (globalDefault.data as any).id;

  const globalName = await supabase
    .from('gl_accounts')
    .select('id')
    .ilike('name', '%undeposited funds%')
    .limit(1)
    .maybeSingle();
  if ((globalName.data as any)?.id) return (globalName.data as any).id;

  return null;
}

async function resolveApAccountId(
  supabase: any,
  orgId: string | null,
): Promise<string | null> {
  if (!orgId) return null;
  const { data, error } = await supabase.rpc('resolve_ap_gl_account_id', { p_org_id: orgId });
  if (error && error.code !== 'PGRST116') throw error;
  return (data as any) ?? null;
}

async function upsertLeaseTransactionWithLines(
  supabase: any,
  buildiumClient: BuildiumClient,
  leaseTx: any,
  buildiumAccountId?: number | null,
): Promise<string> {
  const now = new Date().toISOString();
  const paymentDetail = leaseTx?.PaymentDetail ?? null;
  const payee = paymentDetail?.Payee ?? null;
  const unitAgreement = leaseTx?.UnitAgreement ?? null;
  const unitIdRaw = leaseTx?.UnitId ?? leaseTx?.Unit?.Id ?? null;
  const bankGlBuildiumId = leaseTx?.DepositDetails?.BankGLAccountId ?? null;
  const bankGlAccountId = await resolveGLAccountId(supabase, buildiumClient, bankGlBuildiumId);

  const transactionHeader = {
    buildium_transaction_id: leaseTx.Id,
    date: normalizeDate(leaseTx.Date),
    transaction_type: leaseTx.TransactionType || leaseTx.TransactionTypeEnum || 'Lease',
    total_amount:
      typeof leaseTx.TotalAmount === 'number' ? leaseTx.TotalAmount : Number(leaseTx.Amount ?? 0),
    check_number: leaseTx.CheckNumber ?? null,
    buildium_lease_id: leaseTx.LeaseId ?? null,
    memo: leaseTx?.Journal?.Memo ?? leaseTx?.Memo ?? null,
    payment_method: null,
    payment_method_raw: paymentDetail?.PaymentMethod ?? leaseTx.PaymentMethod ?? null,
    payee_tenant_id: leaseTx.PayeeTenantId ?? (payee?.Type === 'Tenant' ? payee?.Id ?? null : null),
    payee_buildium_id: payee?.Id ?? null,
    payee_buildium_type: payee?.Type ?? null,
    payee_name: payee?.Name ?? null,
    payee_href: payee?.Href ?? null,
    is_internal_transaction: paymentDetail?.IsInternalTransaction ?? null,
    internal_transaction_is_pending: paymentDetail?.InternalTransactionStatus?.IsPending ?? null,
    internal_transaction_result_date: normalizeDate(paymentDetail?.InternalTransactionStatus?.ResultDate),
    internal_transaction_result_code: paymentDetail?.InternalTransactionStatus?.ResultCode ?? null,
    buildium_unit_id: unitIdRaw ?? null,
    buildium_unit_number: leaseTx?.UnitNumber ?? leaseTx?.Unit?.Number ?? null,
    buildium_application_id: leaseTx?.Application?.Id ?? null,
    unit_agreement_id: unitAgreement?.Id ?? null,
    unit_agreement_type: unitAgreement?.Type ?? null,
    unit_agreement_href: unitAgreement?.Href ?? null,
    bank_gl_account_id: bankGlAccountId ?? null,
    bank_gl_account_buildium_id: bankGlBuildiumId ?? null,
    buildium_last_updated_at: leaseTx?.LastUpdatedDateTime ?? null,
    updated_at: now,
  };

  // Upsert transaction header
  const { data: existing, error: findErr } = await supabase
    .from('transactions')
    .select('id')
    .eq('buildium_transaction_id', leaseTx.Id)
    .single();
  if (findErr && findErr.code !== 'PGRST116') throw findErr;

  const payeeTenantBuildiumId =
    leaseTx?.PayeeTenantId ??
    (leaseTx as any)?.PayeeTenantID ??
    (leaseTx as any)?.Payee?.TenantId ??
    null;
  const lines = Array.isArray(leaseTx?.Journal?.Lines)
    ? leaseTx.Journal.Lines
    : Array.isArray(leaseTx?.Lines)
      ? leaseTx.Lines
      : [];

  const leaseRecord = await resolveLeaseWithOrg(supabase, leaseTx.LeaseId ?? null);
  const leaseIdLocal = leaseRecord?.id ?? null;
  const leaseOrgId = leaseRecord?.org_id ?? null;
  const payeeTenantRecord = await resolveLocalTenantId(supabase, payeeTenantBuildiumId ?? null);
  const payeeTenantLocal = payeeTenantRecord?.id ?? null;
  const orgFromAccount = await resolveOrgIdFromBuildiumAccount(
    supabase,
    buildiumAccountId ?? leaseTx?.AccountId ?? null,
  );

  // Resolve property/unit context up-front (used for transaction header + later bank resolution)
  let propertyIdLocal: string | null = null;
  let defaultBuildiumPropertyId: number | null = null;
  let defaultBuildiumUnitId: number | null = null;
  let defaultUnitIdLocal: string | null = null;
  let propertyBankContext:
    | {
        operating_bank_gl_account_id?: string | null;
        deposit_trust_gl_account_id?: string | null;
        org_id?: string | null;
      }
    | null = null;

  if (leaseIdLocal) {
    const { data: leaseRow } = await supabase
      .from('lease')
      .select('property_id, unit_id, buildium_property_id, buildium_unit_id')
      .eq('id', leaseIdLocal)
      .maybeSingle();
    propertyIdLocal = (leaseRow as any)?.property_id ?? null;
    defaultBuildiumPropertyId = (leaseRow as any)?.buildium_property_id ?? null;
    defaultBuildiumUnitId = (leaseRow as any)?.buildium_unit_id ?? null;
    defaultUnitIdLocal = (leaseRow as any)?.unit_id ?? null;
  }

  if (!propertyIdLocal) {
    const firstLinePropertyId =
      (lines.find((l: any) => l?.PropertyId)?.PropertyId as number | null | undefined) ?? null;
    if (firstLinePropertyId) {
      propertyIdLocal = (await resolveLocalPropertyId(supabase, firstLinePropertyId)) ?? null;
      defaultBuildiumPropertyId = defaultBuildiumPropertyId ?? firstLinePropertyId ?? null;
    }
  }

  if (propertyIdLocal) {
    const { data: propertyRow, error: propertyErr } = await supabase
      .from('properties')
      .select('operating_bank_gl_account_id, deposit_trust_gl_account_id, org_id')
      .eq('id', propertyIdLocal)
      .maybeSingle();
    if (propertyErr && propertyErr.code !== 'PGRST116') throw propertyErr;
    propertyBankContext = propertyRow ?? null;
  }

  const propertyOrgId = (propertyBankContext as any)?.org_id ?? null;
  const unitIdLocalFromTx = await resolveLocalUnitId(supabase, unitIdRaw ?? null);
  const unitIdLocalForHeader = propertyIdLocal ? unitIdLocalFromTx ?? defaultUnitIdLocal ?? null : null;

  let bankGlOrgId: string | null = null;
  if (bankGlAccountId) {
    const { data: bankGlRow, error: bankGlErr } = await supabase
      .from('gl_accounts')
      .select('org_id')
      .eq('id', bankGlAccountId)
      .maybeSingle();
    if (bankGlErr && bankGlErr.code !== 'PGRST116') throw bankGlErr;
    bankGlOrgId = (bankGlRow as any)?.org_id ?? null;
  }

  const orgIdLocal = orgFromAccount ?? propertyOrgId ?? leaseOrgId ?? bankGlOrgId ?? null;
  if (!orgIdLocal) {
    throw new Error('Unable to resolve org_id for Buildium lease transaction');
  }

  let transactionId: string;
  if (existing?.id) {
    const { data, error } = await supabase
      .from('transactions')
      .update({
        ...transactionHeader,
        lease_id: leaseIdLocal,
        payee_tenant_id: payeeTenantBuildiumId ?? null,
        tenant_id: payeeTenantLocal ?? null,
        org_id: orgIdLocal,
        property_id: propertyIdLocal,
        unit_id: unitIdLocalForHeader,
      })
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) throw error;
    transactionId = data.id;
  } else {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        ...transactionHeader,
        lease_id: leaseIdLocal,
        payee_tenant_id: payeeTenantBuildiumId ?? null,
        tenant_id: payeeTenantLocal ?? null,
        org_id: orgIdLocal,
        property_id: propertyIdLocal,
        unit_id: unitIdLocalForHeader,
        created_at: now,
      })
      .select('id')
      .single();
    if (error) throw error;
    transactionId = data.id;
  }

  // Replace lines
  await supabase.from('transaction_lines').delete().eq('transaction_id', transactionId);

  let debit = 0,
    credit = 0;
  const pendingLineRows: any[] = [];
  const glAccountBankFlags = new Map<string, boolean>();

  const isPaymentTransaction =
    leaseTx?.TransactionType === 'Payment' ||
    leaseTx?.TransactionTypeEnum === 'Payment' ||
    transactionHeader.transaction_type === 'Payment';
  const isApplyDepositTransaction =
    leaseTx?.TransactionType === 'ApplyDeposit' ||
    leaseTx?.TransactionTypeEnum === 'ApplyDeposit' ||
    transactionHeader.transaction_type === 'ApplyDeposit';
  const isBillPaymentTransaction =
    (leaseTx?.TransactionTypeEnum || '').toString().toLowerCase().includes('billpayment') ||
    (transactionHeader.transaction_type || '').toString().toLowerCase().includes('billpayment') ||
    (leaseTx?.TransactionType || '').toString().toLowerCase().includes('billpayment');
  const isOwnerDrawTransaction =
    (leaseTx?.TransactionTypeEnum || '').toString().toLowerCase().includes('owner') ||
    (transactionHeader.transaction_type || '').toString().toLowerCase().includes('owner') ||
    (leaseTx?.TransactionType || '').toString().toLowerCase().includes('owner');
  const isVendorPayment =
    isPaymentTransaction &&
    !(leaseTx?.LeaseId || leaseIdLocal) &&
    !(leaseTx?.Unit?.Id || leaseTx?.UnitId);

  const isInflow = (isPaymentTransaction && !isVendorPayment) || isApplyDepositTransaction;
  const isOutflow = isBillPaymentTransaction || isOwnerDrawTransaction || isVendorPayment;
  const needsBankAccountLine = isInflow || isOutflow;

  // Resolve Accounts Receivable (inflow offset) and Accounts Payable (outflow offset)
  let accountsReceivableGlId: string | null = null;
  let accountsPayableGlId: string | null = null;
  {
    const { data: arGl } = await supabase
      .from('gl_accounts')
      .select('id')
      .ilike('name', 'Accounts Receivable')
      .maybeSingle();
    accountsReceivableGlId = (arGl as any)?.id ?? null;
    accountsPayableGlId = await resolveApAccountId(supabase, orgIdLocal ?? propertyOrgId ?? leaseOrgId ?? null);
  }

  for (const line of lines) {
    const amountAbs = Math.abs(Number(line?.Amount ?? 0));
    let posting = resolvePostingType(line);
    const glBuildiumId =
      typeof line?.GLAccount === 'number'
        ? line?.GLAccount
        : (line?.GLAccount?.Id ?? line?.GLAccountId ?? null);
    const glId = await resolveGLAccountId(supabase, buildiumClient, glBuildiumId);
    if (!glId) throw new Error(`GL account not found for line. BuildiumId=${glBuildiumId}`);

    // Check if this GL account is a bank account
    const { data: glAccount } = await supabase
      .from('gl_accounts')
      .select('is_bank_account')
      .eq('id', glId)
      .maybeSingle();
    const isBankAccount = Boolean((glAccount as any)?.is_bank_account);
    glAccountBankFlags.set(glId, isBankAccount);

    if (needsBankAccountLine) {
      posting = isBankAccount ? (isOutflow ? 'Credit' : 'Debit') : 'Credit';
    }

    // For inflow payments, keep original income/charge lines; only map to A/R when no non-bank lines exist.
    // For outflows, non-bank offsets -> A/P (Debit).
    let glIdForLine = glId;
    const isIncomeType = (glAccount as any)?.type?.toLowerCase() === 'income';
    if (!isBankAccount && isInflow && accountsReceivableGlId && !isIncomeType) {
      glIdForLine = accountsReceivableGlId;
    }
    if (!isBankAccount && isOutflow && accountsPayableGlId) {
      glIdForLine = accountsPayableGlId;
      posting = 'Debit';
    }

    const buildiumPropertyId = line?.PropertyId ?? null;
    const buildiumUnitId = line?.Unit?.Id ?? line?.UnitId ?? null;
    const linePropertyIdLocal =
      (await resolveLocalPropertyId(supabase, buildiumPropertyId)) ?? propertyIdLocal;
    const unitIdLocalResolved = await resolveLocalUnitId(supabase, buildiumUnitId);
    const accountingEntityTypeRaw = line?.AccountingEntity?.AccountingEntityType ?? null;
    const accountEntityType =
      (accountingEntityTypeRaw || '').toString().toLowerCase() === 'company' ? 'Company' : 'Rental';

    pendingLineRows.push({
      transaction_id: transactionId,
      gl_account_id: glIdForLine,
      amount: amountAbs,
      posting_type: posting,
      memo: line?.Memo ?? null,
      account_entity_type: accountEntityType,
      account_entity_id: buildiumPropertyId ?? defaultBuildiumPropertyId ?? null,
      date: normalizeDate(leaseTx.Date),
      created_at: now,
      updated_at: now,
      buildium_property_id: buildiumPropertyId ?? defaultBuildiumPropertyId ?? null,
      buildium_unit_id: buildiumUnitId ?? defaultBuildiumUnitId ?? null,
      buildium_lease_id: leaseTx.LeaseId ?? null,
      lease_id: leaseIdLocal,
      property_id: linePropertyIdLocal,
      unit_id: unitIdLocalResolved,
      reference_number: line?.ReferenceNumber ?? null,
      is_cash_posting: line?.IsCashPosting ?? null,
      accounting_entity_type_raw: accountingEntityTypeRaw,
    });

    if (posting === 'Debit') debit += amountAbs;
    else credit += amountAbs;
  }

  // For Bills/Charges (non-cash), ensure A/P credit line exists to balance debits
  const txTypeLower = (transactionHeader.transaction_type || '').toString().toLowerCase();
  const isBillLike = txTypeLower.includes('bill') || txTypeLower.includes('charge');
  const hasApLine = pendingLineRows.some((l) => l.gl_account_id === accountsPayableGlId);
  if (isBillLike && accountsPayableGlId && !hasApLine) {
    const totalDebits = pendingLineRows
      .filter((l) => l.posting_type === 'Debit')
      .reduce((sum, l) => sum + Math.abs(Number(l.amount) || 0), 0);
    if (totalDebits > 0) {
      pendingLineRows.push({
        transaction_id: transactionId,
        gl_account_id: accountsPayableGlId,
        amount: totalDebits,
        posting_type: 'Credit',
        memo: leaseTx?.Memo ?? leaseTx?.Journal?.Memo ?? null,
        account_entity_type: 'Rental',
        account_entity_id: defaultBuildiumPropertyId,
        date: normalizeDate(leaseTx.Date),
        created_at: now,
        updated_at: now,
        buildium_property_id: defaultBuildiumPropertyId,
        buildium_unit_id: defaultBuildiumUnitId,
        buildium_lease_id: leaseTx.LeaseId ?? null,
        lease_id: leaseIdLocal,
        property_id: propertyIdLocal,
        unit_id: defaultUnitIdLocal,
      });
      credit += totalDebits;
    }
  }

  // For Payment and ApplyDeposit transactions, ensure there's a bank account debit line
  const hasBankAccountLine = Array.from(glAccountBankFlags.values()).some((isBank) => isBank);
  const hasProvidedBankLine = bankGlAccountId
    ? pendingLineRows.some((l) => l.gl_account_id === bankGlAccountId)
    : false;
  const hasBankLikeLine = hasBankAccountLine || hasProvidedBankLine;
  let bankGlAccountIdToUse: string | null = null;

  if (needsBankAccountLine) {
    bankGlAccountIdToUse = await resolveUndepositedFundsGlAccountId(supabase, propertyOrgId);
  }

  const bankAmountNeeded = isOutflow ? debit : credit;

  if (
    needsBankAccountLine &&
    !hasBankLikeLine &&
    bankAmountNeeded > 0 &&
    propertyIdLocal &&
    !bankGlAccountIdToUse
  ) {
    const bankGlAccountIdResolved =
      (propertyBankContext as any)?.operating_bank_gl_account_id ??
      (propertyBankContext as any)?.deposit_trust_gl_account_id ??
      null;
    if (bankGlAccountIdResolved) {
      bankGlAccountIdToUse = bankGlAccountIdResolved;
    }
  }

  if (needsBankAccountLine && !hasBankLikeLine && bankGlAccountIdToUse && bankAmountNeeded > 0) {
    // Add bank line in the correct direction: inflows debit cash, outflows credit cash.
    const bankPosting = isOutflow ? 'Credit' : 'Debit';
    pendingLineRows.push({
      transaction_id: transactionId,
      gl_account_id: bankGlAccountIdToUse,
      amount: bankAmountNeeded,
      posting_type: bankPosting,
      memo: leaseTx?.Memo ?? leaseTx?.Journal?.Memo ?? null,
      account_entity_type: 'Rental',
      account_entity_id: defaultBuildiumPropertyId,
      date: normalizeDate(leaseTx.Date),
      created_at: now,
      updated_at: now,
      buildium_property_id: defaultBuildiumPropertyId,
      buildium_unit_id: defaultBuildiumUnitId,
      buildium_lease_id: leaseTx.LeaseId ?? null,
      lease_id: leaseIdLocal,
      property_id: propertyIdLocal,
      unit_id: defaultUnitIdLocal,
    });
    if (bankPosting === 'Debit') debit += bankAmountNeeded;
    else credit += bankAmountNeeded;
  }

  // Replace deposit/payment splits (DepositDetails.PaymentTransactions)
  await supabase.from('transaction_payment_transactions').delete().eq('transaction_id', transactionId);
  const paymentSplits = Array.isArray(leaseTx?.DepositDetails?.PaymentTransactions)
    ? leaseTx.DepositDetails.PaymentTransactions
    : [];
  if (paymentSplits.length > 0) {
    const splitRows = paymentSplits.map((pt: any) => ({
      transaction_id: transactionId,
      buildium_payment_transaction_id: pt?.Id ?? null,
      accounting_entity_id: pt?.AccountingEntity?.Id ?? null,
      accounting_entity_type: pt?.AccountingEntity?.AccountingEntityType ?? null,
      accounting_entity_href: pt?.AccountingEntity?.Href ?? null,
      accounting_unit_id:
        pt?.AccountingEntity?.Unit?.Id ?? pt?.AccountingEntity?.Unit?.ID ?? pt?.AccountingEntity?.UnitId ?? null,
      accounting_unit_href: pt?.AccountingEntity?.Unit?.Href ?? null,
      amount: pt?.Amount ?? null,
      created_at: now,
      updated_at: now,
    }));
    const { error: splitErr } = await supabase.from('transaction_payment_transactions').insert(splitRows);
    if (splitErr) throw splitErr;
  }

  // Safeguard: for tenant inflow payments, ensure we have both A/R credit and bank debit
  if (isInflow) {
    const isBankLine = (glAccountId: unknown): boolean => {
      const id = glAccountId != null ? String(glAccountId) : null;
      if (!id) return false;
      if (bankGlAccountIdToUse && id === String(bankGlAccountIdToUse)) return true;
      return glAccountBankFlags.get(id) === true;
    };

    const hasNonBank = pendingLineRows.some((l) => l.gl_account_id && !isBankLine(l.gl_account_id));
    const hasAr = pendingLineRows.some((l) => l.gl_account_id === accountsReceivableGlId);
    const hasBank = pendingLineRows.some((l) => l.gl_account_id === bankGlAccountIdToUse);
    const totalAmountAbs = Math.abs(Number(transactionHeader.total_amount) || 0);
    const lineDate = normalizeDate(leaseTx.Date);

    if (!hasNonBank && !hasAr && accountsReceivableGlId && totalAmountAbs > 0) {
      pendingLineRows.push({
        transaction_id: transactionId,
        gl_account_id: accountsReceivableGlId,
        amount: totalAmountAbs,
        posting_type: 'Credit',
        memo: leaseTx?.Memo ?? leaseTx?.Journal?.Memo ?? null,
        account_entity_type: 'Rental',
        account_entity_id: defaultBuildiumPropertyId,
        date: lineDate,
        created_at: now,
        updated_at: now,
        buildium_property_id: defaultBuildiumPropertyId,
        buildium_unit_id: defaultBuildiumUnitId,
        buildium_lease_id: leaseTx.LeaseId ?? null,
        lease_id: leaseIdLocal,
        property_id: propertyIdLocal,
        unit_id: defaultUnitIdLocal,
      });
    }

    if (!hasBank && bankGlAccountIdToUse && totalAmountAbs > 0) {
      pendingLineRows.push({
        transaction_id: transactionId,
        gl_account_id: bankGlAccountIdToUse,
        amount: totalAmountAbs,
        posting_type: 'Debit',
        memo: leaseTx?.Memo ?? leaseTx?.Journal?.Memo ?? null,
        account_entity_type: 'Rental',
        account_entity_id: defaultBuildiumPropertyId,
        date: lineDate,
        created_at: now,
        updated_at: now,
        buildium_property_id: defaultBuildiumPropertyId,
        buildium_unit_id: defaultBuildiumUnitId,
        buildium_lease_id: leaseTx.LeaseId ?? null,
        lease_id: leaseIdLocal,
        property_id: propertyIdLocal,
        unit_id: defaultUnitIdLocal,
      });
    }
  }

  // Insert all lines at once
  if (pendingLineRows.length > 0) {
    const { error } = await supabase.from('transaction_lines').insert(pendingLineRows);
    if (error) throw error;
  }

  if (debit > 0 && credit > 0 && Math.abs(debit - credit) > 0.0001) {
    throw new Error(`Double-entry integrity violation: debits (${debit}) != credits (${credit})`);
  }

  const finalBankGlAccountId = bankGlAccountIdToUse ?? bankGlAccountId ?? null;
  if (finalBankGlAccountId && finalBankGlAccountId !== bankGlAccountId) {
    const { error: bankUpdateErr } = await supabase
      .from('transactions')
      .update({ bank_gl_account_id: finalBankGlAccountId, updated_at: now })
      .eq('id', transactionId);
    if (bankUpdateErr) throw bankUpdateErr;
  }

  return transactionId;
}

const leaseTransactionsSignatureCache = new Map<string, number>();
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeLeaseTransactionsPayload(body: unknown): {
  Events: BuildiumWebhookEvent[];
  credentials?: LeaseTransactionsWebhookPayload['credentials'];
} | null {
  const raw = body as any;
  if (!raw || typeof raw !== 'object') return null;

  if (Array.isArray(raw.Events)) {
    return { Events: raw.Events as BuildiumWebhookEvent[], credentials: raw.credentials };
  }

  if (raw.Event && typeof raw.Event === 'object') {
    return { Events: [raw.Event as BuildiumWebhookEvent], credentials: raw.credentials };
  }

  const looksLikeSingleEvent =
    typeof raw.EventType === 'string' ||
    typeof raw.EventName === 'string' ||
    raw.Id != null ||
    raw.EventId != null ||
    raw.TransactionId != null ||
    raw.LeaseId != null ||
    raw.EntityId != null;

  if (looksLikeSingleEvent) {
    return { Events: [raw as BuildiumWebhookEvent], credentials: raw.credentials };
  }

  return null;
}

// Main handler
serve(async (req) => {
  try {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      });
    }

    const rawBody = await req.text();

    const verification = await verifyBuildiumSignature(req.headers, rawBody, {
      replayCache: leaseTransactionsSignatureCache,
    });
    if (!verification.ok) {
      console.warn('buildium-lease-transactions signature rejected', {
        reason: verification.reason,
        status: verification.status,
        timestamp: verification.timestamp ?? null,
        signaturePreview: verification.signature ? verification.signature.slice(0, 12) : null,
        metric: 'buildium_lease_transactions.signature_failure',
      });
      return new Response(
        JSON.stringify({ error: 'Invalid signature', reason: verification.reason }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: verification.status,
        },
      );
    }

    // Parse webhook payload
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody || '');
    } catch (parseError) {
      console.error('Failed to parse webhook payload:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const normalizedPayload = normalizeLeaseTransactionsPayload(parsedBody);
    if (!normalizedPayload) {
      console.warn('buildium-lease-transactions payload missing events', {
        hasEventsArray: Array.isArray((parsedBody as any)?.Events),
        keys: parsedBody && typeof parsedBody === 'object' ? Object.keys(parsedBody as any) : [],
      });
      return new Response(JSON.stringify({ error: 'No webhook events found in payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const payloadResult = validateWebhookPayload(
      normalizedPayload,
      LeaseTransactionsWebhookPayloadSchema,
    );
    if (!payloadResult.ok) {
      console.warn('buildium-lease-transactions schema validation failed', {
        errors: payloadResult.errors,
        eventTypes: normalizedPayload.Events.map((evt: any) => deriveEventType(evt)),
      });
      await sendPagerDutyEvent({
        summary: 'Buildium lease-transactions webhook schema validation failed',
        severity: 'warning',
        custom_details: {
          errors: payloadResult.errors,
          eventTypes: normalizedPayload.Events.map((evt: any) => deriveEventType(evt)),
        },
      });
      return new Response(
        JSON.stringify({ error: 'Invalid payload', details: payloadResult.errors }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    const payload: LeaseTransactionsWebhookPayload = payloadResult.data;

    const validationFailures = payload.Events.map((event, idx) => {
      const validation = validateBuildiumEvent(event);
      if (validation.ok) return null;
      return {
        index: idx,
        eventType: deriveEventType(event as Record<string, unknown>),
        eventId: event.Id ?? event.EventId ?? null,
        errors: validation.errors,
      };
    }).filter(Boolean) as Array<{
      index: number;
      eventType: string;
      eventId: unknown;
      errors: string[];
    }>;

    if (validationFailures.length) {
      console.warn('buildium-lease-transactions payload validation failed', {
        failures: validationFailures,
      });
      await sendPagerDutyEvent({
        summary: 'Buildium lease-transactions webhook payload validation failed',
        severity: 'warning',
        custom_details: { failures: validationFailures },
      });
      return new Response(
        JSON.stringify({ error: 'Invalid payload', details: validationFailures }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!payload.credentials?.clientId || !payload.credentials?.clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Missing Buildium credentials' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Resolve orgId (required for gating). Prefer explicit payload field; fallback to Buildium AccountId lookup.
    let orgId =
      typeof (payload as any)?.orgId === 'string'
        ? (payload as any).orgId
        : (typeof (payload as any)?.org_id === 'string' ? (payload as any).org_id : null);

    if (!orgId) {
      const accountIdRaw =
        (payload as any)?.accountId ??
        (payload as any)?.AccountId ??
        (payload as any)?.account_id ??
        (payload.Events[0] as any)?.AccountId ??
        null;
      const accountIdNum = Number(accountIdRaw);
      if (Number.isFinite(accountIdNum) && accountIdNum > 0) {
        orgId = (await resolveOrgIdFromBuildiumAccount(supabase, accountIdNum)) ?? null;
      }
    }

    if (!orgId) {
      return new Response(
        JSON.stringify({ error: 'orgId is required for Buildium lease transaction processing' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Initialize Buildium client (allow per-request override for testing/local)
    const buildiumClient = new BuildiumClient({
      ...(payload.credentials as BuildiumCredentials),
      supabase,
      orgId,
    });

    const markEventsIgnoredDisabled = async (eventsToIgnore: BuildiumWebhookEvent[]) => {
      for (const event of eventsToIgnore) {
        try {
          const storeResult = await insertBuildiumWebhookEventRecord(supabase, event, {
            webhookType: 'lease-transactions',
            signature: verification.signature ?? null,
          });

          if (storeResult.status === 'inserted' || storeResult.status === 'duplicate') {
            await supabase
              .from('buildium_webhook_events')
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
                status: 'ignored_disabled',
                retry_count: 0,
                error_message: 'Buildium integration is disabled',
              })
              .eq('buildium_webhook_id', storeResult.normalized.buildiumWebhookId)
              .eq('event_name', storeResult.normalized.eventName)
              .eq('event_created_at', storeResult.normalized.eventCreatedAt);
          }
        } catch (err) {
          console.warn('buildium-lease-transactions ignored-disabled storage failed', {
            error: (err as Error)?.message,
          });
        }
      }
    };

    // Log webhook event
    console.log('Received lease transaction webhook with', payload.Events.length, 'events');

    // Process webhook events (only lease transaction events) with idempotent insert
    const results = [];
    for (let idx = 0; idx < payload.Events.length; idx++) {
      const event = payload.Events[idx];

      try {
        await assertBuildiumEnabledEdge(supabase, orgId);
      } catch (error) {
        await markEventsIgnoredDisabled(payload.Events.slice(idx));
        return new Response(
          JSON.stringify({ ignored: true, reason: 'integration_disabled' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          },
        );
      }
      const eventType = deriveEventType(event as Record<string, unknown>);

      const storeResult = await insertBuildiumWebhookEventRecord(supabase, event, {
        webhookType: 'lease-transactions',
        signature: verification.signature ?? null,
      });

      if (storeResult.status === 'invalid') {
        console.warn('buildium-lease-transactions normalization failed', {
          errors: storeResult.errors,
          eventType: event?.EventType,
        });
        results.push({
          eventId: null,
          success: false,
          error: 'invalid-normalization',
          details: storeResult.errors,
          eventType,
        });
        continue;
      }

      if (storeResult.status === 'duplicate') {
        console.warn('buildium-lease-transactions duplicate delivery', {
          webhookId: storeResult.normalized.buildiumWebhookId,
          eventName: storeResult.normalized.eventName,
          eventCreatedAt: storeResult.normalized.eventCreatedAt,
        });
        results.push({
          eventId: storeResult.normalized.buildiumWebhookId,
          success: true,
          duplicate: true,
          eventType,
        });
        continue;
      }

      const routingDecision = routeLeaseTransactionWebhookEvent(eventType);
      if (routingDecision !== 'process') {
        const status = routingDecision === 'dead-letter' ? 'dead-letter' : 'skipped';
        await emitRoutingTelemetry(
          'buildium-lease-transactions',
          routingDecision,
          storeResult.normalized,
          eventType,
        );
        await supabase
          .from('buildium_webhook_events')
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            status,
            retry_count: 0,
            error_message: routingDecision === 'dead-letter' ? 'unsupported_event_type' : null,
          })
          .eq('buildium_webhook_id', storeResult.normalized.buildiumWebhookId)
          .eq('event_name', storeResult.normalized.eventName)
          .eq('event_created_at', storeResult.normalized.eventCreatedAt);

        console.warn('buildium-lease-transactions routing skipped event', {
          eventType,
          routingDecision,
          webhookId: storeResult.normalized.buildiumWebhookId,
        });
        results.push({
          eventId: storeResult.normalized.buildiumWebhookId,
          success: routingDecision === 'skip',
          skipped: routingDecision === 'skip',
          deadLetter: routingDecision === 'dead-letter',
          eventType,
        });
        continue;
      }

      let attempt = 0;
      let processed = false;
      let lastError: any = null;
      while (attempt < MAX_RETRIES && !processed) {
        attempt++;
        try {
          const result = await processLeaseTransactionEvent(
            event,
            eventType,
            buildiumClient,
            supabase,
          );
          results.push({
            eventId: storeResult.normalized.buildiumWebhookId,
            success: result.success,
            error: result.error,
            eventType,
          });

          if (result.success) {
            await supabase
              .from('buildium_webhook_events')
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
                status: 'processed',
                retry_count: attempt - 1,
                error_message: null,
              })
              .eq('buildium_webhook_id', storeResult.normalized.buildiumWebhookId)
              .eq('event_name', storeResult.normalized.eventName)
              .eq('event_created_at', storeResult.normalized.eventCreatedAt);
            processed = true;
          } else {
            throw new Error(result.error || 'Unknown processing failure');
          }
        } catch (error: unknown) {
          lastError = error;
          const errorMessage =
            error instanceof Error ? error.message : String(error ?? 'Unknown error');
          console.error('buildium-lease-transactions processing failed', {
            eventId: storeResult.normalized.buildiumWebhookId,
            eventName: storeResult.normalized.eventName,
            attempt,
            error: errorMessage,
          });
          const isLastAttempt = attempt >= MAX_RETRIES;
          await supabase
            .from('buildium_webhook_events')
            .update({
              retry_count: attempt,
              error_message: errorMessage,
              status: isLastAttempt ? 'dead-letter' : 'retrying',
              processed: isLastAttempt ? false : false,
            })
            .eq('buildium_webhook_id', storeResult.normalized.buildiumWebhookId)
            .eq('event_name', storeResult.normalized.eventName)
            .eq('event_created_at', storeResult.normalized.eventCreatedAt);

          if (!isLastAttempt) {
            const backoffMs = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
            await sleep(backoffMs);
          }
        }
      }

      if (!processed) {
        results.push({
          eventId: storeResult.normalized.buildiumWebhookId,
          success: false,
          error: (lastError as any)?.message || 'failed after retries',
          deadLetter: true,
        });
      }
    }

    // Emit backlog metric
    try {
      const { count: backlogCount } = await supabase
        .from('buildium_webhook_events')
        .select('id', { count: 'exact', head: true })
        .eq('processed', false);
      console.log('buildium-lease-transactions backlog depth', { backlogCount });
    } catch (e) {
      console.warn('buildium-lease-transactions backlog metric failed', {
        error: (e as any)?.message,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    console.log('Lease transaction webhook processing completed:', {
      totalEvents: results.length,
      successCount,
      failureCount,
    });

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        successful: successCount,
        failed: failureCount,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    console.error('Error in buildium-lease-transactions webhook function:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage || 'Internal server error',
      }),
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Content-Type': 'application/json',
        },
        status: 500,
      },
    );
  }
});

async function processLeaseTransactionEvent(
  event: BuildiumWebhookEvent,
  eventType: string,
  buildiumClient: BuildiumClient,
  supabase: any,
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('Processing lease transaction event:', eventType, 'for entity:', event.EntityId);

    if (eventType === 'LeaseTransactionDeleted' || eventType === 'LeaseTransaction.Deleted') {
      const transactionId =
        (event as any)?.Data?.TransactionId ?? (event as any)?.TransactionId ?? event.EntityId;
      const { data: existingTransaction } = await supabase
        .from('transactions')
        .select('id')
        .eq('buildium_transaction_id', transactionId)
        .single();

      if (existingTransaction?.id) {
        await supabase
          .from('transaction_lines')
          .delete()
          .eq('transaction_id', existingTransaction.id);
        await supabase.from('transactions').delete().eq('id', existingTransaction.id);
        console.log('Lease transaction deleted locally:', existingTransaction.id);
      } else {
        console.log('Lease transaction delete received but not found locally:', transactionId);
      }
      return { success: true };
    }

    // Use provided transaction (if forwarded) or fetch from Buildium
    const leaseId = (event as any)?.Data?.LeaseId ?? (event as any)?.LeaseId ?? null;
    const transactionId =
      (event as any)?.Data?.TransactionId ?? (event as any)?.TransactionId ?? event.EntityId;
    const forwardedTx = (event as any)?.Data?.FullTransaction || (event as any)?.Data?.Transaction;
    let transaction = forwardedTx;
    if (!transaction) {
      if (!leaseId) {
        console.warn('LeaseId missing on webhook event; cannot fetch transaction', event);
        return { success: false, error: 'LeaseId missing on webhook event' };
      }
      transaction = await buildiumClient.getLeaseTransaction(leaseId, transactionId);
    }

    // Map + upsert transaction header and lines
    await upsertLeaseTransactionWithLines(
      supabase,
      buildiumClient,
      transaction,
      (event as any)?.AccountId ?? (event as any)?.Data?.AccountId ?? null,
    );
    console.log('Lease transaction synced from Buildium with lines:', transaction.Id);
    return { success: true };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : String(error ?? 'Unknown error');
    console.error('Error processing lease transaction event:', errorMessage);
    return { success: false, error: errorMessage };
  }
}
