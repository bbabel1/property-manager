// deno-lint-ignore-file
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/v135/@supabase/supabase-js@2.45.4?dts';
import { verifyBuildiumSignature } from '../_shared/buildiumSignature.ts';
import { insertBuildiumWebhookEventRecord } from '../_shared/webhookEvents.ts';
import { validateBuildiumEvent } from '../_shared/eventValidation.ts';
import {
  BuildiumWebhookPayloadSchema,
  deriveEventType,
  type BuildiumWebhookEvent,
  type BuildiumWebhookPayload,
  validateWebhookPayload,
} from '../_shared/webhookSchemas.ts';
import { routeGeneralWebhookEvent } from '../_shared/eventRouting.ts';
import { emitRoutingTelemetry } from '../_shared/telemetry.ts';
import { sendPagerDutyEvent } from '../_shared/pagerDuty.ts';
import {
  buildCanonicalTransactionPatch,
  type PaidByCandidate,
  type PaidToCandidate,
} from '../_shared/transaction-canonical.ts';
import type { BuildiumWebhookEventLike } from '../_shared/eventValidation.ts';
type BuildiumCredentials = { baseUrl: string; clientId: string; clientSecret: string };

async function resolvePaidByLabelContext(
  supabase: any,
  candidates: PaidByCandidate[],
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

// Buildium API Client (simplified for webhook processing)
class BuildiumClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;

  constructor(creds?: BuildiumCredentials | null) {
    const envBase = Deno.env.get('BUILDIUM_BASE_URL') || 'https://apisandbox.buildium.com/v1';
    const envClientId = Deno.env.get('BUILDIUM_CLIENT_ID') || '';
    const envClientSecret = Deno.env.get('BUILDIUM_CLIENT_SECRET') || '';
    this.baseUrl = (creds?.baseUrl || envBase).replace(/\/$/, '');
    this.clientId = creds?.clientId || envClientId;
    this.clientSecret = creds?.clientSecret || envClientSecret;
  }

  private async makeRequest<T>(method: string, endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      // Buildium Open API authentication (client id + secret headers).
      'x-buildium-client-id': this.clientId,
      'x-buildium-client-secret': this.clientSecret,
    };

    const response = await fetch(url, { method, headers });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `Buildium API error: ${response.status} ${response.statusText}${body ? `. ${body}` : ''}`,
      );
    }

    return response.json();
  }

  async getProperty(id: number): Promise<any> {
    return this.makeRequest('GET', `/properties/${id}`);
  }

  async getOwner(id: number): Promise<any> {
    return this.makeRequest('GET', `/owners/${id}`);
  }

  async getLease(id: number): Promise<any> {
    return this.makeRequest('GET', `/leases/${id}`);
  }

  async getBankAccount(id: number): Promise<any> {
    return this.makeRequest('GET', `/bankaccounts/${id}`);
  }

  async getBankDeposit(bankAccountId: number, depositId: number): Promise<any> {
    return this.makeRequest('GET', `/bankaccounts/${bankAccountId}/deposits/${depositId}`);
  }

  async getBankTransaction(bankAccountId: number, transactionId: number): Promise<any> {
    return this.makeRequest('GET', `/bankaccounts/${bankAccountId}/transactions/${transactionId}`);
  }

  async getGeneralLedgerTransaction(id: number): Promise<any> {
    return this.makeRequest('GET', `/generalledger/transactions/${id}`);
  }
}

async function resolveOrgIdFromBuildiumAccountEdge(supabase: any, accountId?: number | null) {
  if (!accountId) return null;
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('buildium_org_id', accountId)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  return data?.id ?? null;
}

async function resolveUndepositedFundsGlAccountIdEdge(
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

async function ensureBankGlAccountEdge(
  supabase: any,
  bankAccount: any,
  orgId: string | null,
): Promise<{ glAccountId: string | null; glAccountBuildiumId: number | null }> {
  const normalizeBankAccountType = (value?: string | null): string | null => {
    if (!value || typeof value !== 'string') return null;
    const v = value.trim().toLowerCase().replace(/\s+/g, '_');
    const map: Record<string, string> = {
      checking: 'checking',
      savings: 'savings',
      money_market: 'money_market',
      moneymarket: 'money_market',
      certificate_of_deposit: 'certificate_of_deposit',
      certificateofdeposit: 'certificate_of_deposit',
    };
    return map[v] ?? null;
  };

  const normalizeCountry = (value?: string | null): string | null => {
    if (!value || typeof value !== 'string') return null;
    const spaced = value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .trim();
    if (!spaced) return null;
    const titled = spaced
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    return titled || null;
  };

  const mapBankFields = (acct: any) => ({
    name: acct?.Name ?? 'Bank Account',
    description: acct?.Description ?? null,
    type: (acct?.GLAccount?.Type as any) || 'asset',
    sub_type: acct?.GLAccount?.SubType ?? null,
    is_default_gl_account: acct?.GLAccount?.IsDefaultGLAccount ?? false,
    default_account_name: acct?.GLAccount?.DefaultAccountName ?? null,
    is_contra_account: acct?.GLAccount?.IsContraAccount ?? false,
    is_active: acct?.IsActive ?? true,
    is_bank_account: true,
    is_credit_card_account: acct?.GLAccount?.IsCreditCardAccount ?? false,
    buildium_parent_gl_account_id: acct?.GLAccount?.ParentGLAccountId ?? null,
    cash_flow_classification: acct?.GLAccount?.CashFlowClassification ?? null,
    exclude_from_cash_balances: acct?.ExcludeFromCashBalances ?? false,
    bank_account_type: normalizeBankAccountType(acct?.BankAccountType),
    bank_account_number: acct?.AccountNumberUnmasked ?? acct?.AccountNumber ?? null,
    bank_routing_number: acct?.RoutingNumber ?? null,
    bank_country: normalizeCountry(acct?.Country),
    bank_check_printing_info: acct?.CheckPrintingInfo ?? null,
    bank_electronic_payments: acct?.ElectronicPayments ?? null,
    bank_buildium_balance: acct?.Balance ?? null,
    bank_balance: acct?.Balance ?? null,
    updated_at: new Date().toISOString(),
  });

  const bankAccountId = bankAccount?.Id ?? bankAccount?.BankAccountId ?? null;
  const glBuildiumId =
    bankAccount?.GLAccount?.Id ??
    bankAccount?.GLAccountId ??
    bankAccount?.GLAccountId ??
    bankAccount?.GLAccountID ??
    null;

  // In this schema, bank accounts are represented by `gl_accounts` where `buildium_gl_account_id`
  // stores the Buildium *BankAccountId* (from the webhook payload), not the nested GLAccount.Id.
  // Resolve by payload bank account id first (org-scoped), to avoid mistakenly hitting "Default Bank Account GL".
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
      const patch = mapBankFields(bankAccount);
      await supabase
        .from('gl_accounts')
        .update(patch)
        .eq('id', (existingByBankAccountId as any).id);
      return {
        glAccountId: (existingByBankAccountId as any).id,
        glAccountBuildiumId: bankAccountId,
      };
    }
  }

  // Secondary: if the bank account payload includes a nested GLAccount.Id, try that too.
  // Some tenants may store true Buildium GL account ids in buildium_gl_account_id.
  if (glBuildiumId) {
    let byGlQuery = supabase
      .from('gl_accounts')
      .select('id, buildium_gl_account_id')
      .eq('buildium_gl_account_id', glBuildiumId)
      .limit(1);
    if (orgId) byGlQuery = byGlQuery.eq('org_id', orgId);
    const { data: existingByGl } = await byGlQuery.maybeSingle();
    if ((existingByGl as any)?.id) {
      const patch = mapBankFields(bankAccount);
      await supabase
        .from('gl_accounts')
        .update(patch)
        .eq('id', (existingByGl as any).id);
      return {
        glAccountId: (existingByGl as any).id,
        glAccountBuildiumId: glBuildiumId,
      };
    }
  }

  if (!bankAccount) {
    return { glAccountId: null, glAccountBuildiumId: glBuildiumId ?? null };
  }

  // buildium_gl_account_id is required in our schema. For bank accounts, prefer BankAccountId.
  const buildiumIdForRow = bankAccountId ?? glBuildiumId ?? null;
  if (!buildiumIdForRow) {
    return { glAccountId: null, glAccountBuildiumId: null };
  }

  const now = new Date().toISOString();
  const insertPayload: any = {
    name: bankAccount?.Name ?? 'Bank Account',
    description: bankAccount?.Description ?? null,
    type: (bankAccount?.GLAccount?.Type as any) || 'asset',
    sub_type: bankAccount?.GLAccount?.SubType ?? null,
    is_default_gl_account: bankAccount?.GLAccount?.IsDefaultGLAccount ?? false,
    default_account_name: bankAccount?.GLAccount?.DefaultAccountName ?? null,
    is_contra_account: bankAccount?.GLAccount?.IsContraAccount ?? false,
    is_active: bankAccount?.IsActive ?? true,
    is_bank_account: true,
    is_credit_card_account: bankAccount?.GLAccount?.IsCreditCardAccount ?? false,
    buildium_gl_account_id: buildiumIdForRow,
    buildium_parent_gl_account_id: bankAccount?.GLAccount?.ParentGLAccountId ?? null,
    cash_flow_classification: bankAccount?.GLAccount?.CashFlowClassification ?? null,
    exclude_from_cash_balances: bankAccount?.ExcludeFromCashBalances ?? false,
    bank_account_type: bankAccount?.BankAccountType ?? null,
    bank_account_number: bankAccount?.AccountNumberUnmasked ?? bankAccount?.AccountNumber ?? null,
    bank_routing_number: bankAccount?.RoutingNumber ?? null,
    bank_country: bankAccount?.Country ?? null,
    bank_check_printing_info: bankAccount?.CheckPrintingInfo ?? null,
    bank_electronic_payments: bankAccount?.ElectronicPayments ?? null,
    bank_buildium_balance: bankAccount?.Balance ?? null,
    bank_balance: bankAccount?.Balance ?? null,
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

async function ensureGlAccountFromGlLineEdge(
  supabase: any,
  glAccount: any,
  orgId: string | null,
): Promise<{ glAccountId: string | null; glAccountBuildiumId: number | null }> {
  const glId = glAccount?.Id ?? glAccount?.GLAccountId ?? glAccount?.GLAccountID ?? null;
  if (!glId) return { glAccountId: null, glAccountBuildiumId: null };

  let query = supabase.from('gl_accounts').select('id').eq('buildium_gl_account_id', glId).limit(1);
  if (orgId) query = query.eq('org_id', orgId);
  const { data: existing, error } = await query.maybeSingle();
  if (error && error.code !== 'PGRST116') throw error;
  if ((existing as any)?.id)
    return { glAccountId: (existing as any).id, glAccountBuildiumId: glId };

  const now = new Date().toISOString();
  const insertPayload: any = {
    name: glAccount?.Name ?? 'GL Account',
    description: glAccount?.Description ?? null,
    type: glAccount?.Type ?? glAccount?.GLAccountType ?? null,
    sub_type: glAccount?.SubType ?? null,
    is_active: glAccount?.IsActive ?? true,
    is_bank_account: glAccount?.IsBankAccount ?? false,
    is_credit_card_account: glAccount?.IsCreditCardAccount ?? false,
    buildium_gl_account_id: glId,
    buildium_parent_gl_account_id: glAccount?.ParentGLAccountId ?? null,
    bank_account_type: glAccount?.BankAccountType ?? null,
    bank_account_number: glAccount?.AccountNumber ?? null,
    bank_routing_number: glAccount?.RoutingNumber ?? null,
    bank_country: glAccount?.Country ?? null,
    bank_check_printing_info: glAccount?.CheckPrintingInfo ?? null,
    bank_electronic_payments: glAccount?.ElectronicPayments ?? null,
    cash_flow_classification: glAccount?.CashFlowClassification ?? null,
    exclude_from_cash_balances: glAccount?.ExcludeFromCashBalances ?? false,
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

  return { glAccountId: (created as any)?.id ?? null, glAccountBuildiumId: glId };
}

// Data mapping functions
async function mapPropertyFromBuildiumWithBankAccount(
  buildiumProperty: any,
  supabase: any,
): Promise<any> {
  const baseProperty = {
    name: buildiumProperty.Name,
    rental_sub_type: mapPropertyTypeFromBuildium(buildiumProperty.PropertyType),
    address_line1: buildiumProperty.Address.AddressLine1,
    address_line2: buildiumProperty.Address.AddressLine2,
    city: buildiumProperty.Address.City,
    state: buildiumProperty.Address.State,
    postal_code: buildiumProperty.Address.PostalCode,
    country: buildiumProperty.Address.Country,
    year_built: buildiumProperty.YearBuilt,
    square_footage: buildiumProperty.SquareFootage,
    bedrooms: buildiumProperty.Bedrooms,
    bathrooms: buildiumProperty.Bathrooms,
    is_active: buildiumProperty.IsActive,
    buildium_property_id: buildiumProperty.Id,
    buildium_created_at: buildiumProperty.CreatedDate,
    buildium_updated_at: buildiumProperty.ModifiedDate,
  };

  // Resolve bank GL account id if OperatingBankAccountId exists (Phase 4: source of truth is gl_accounts)
  let operatingBankGlAccountId = null;
  if (buildiumProperty.OperatingBankAccountId) {
    try {
      const { data: existingGl } = await supabase
        .from('gl_accounts')
        .select('id')
        .eq('buildium_gl_account_id', buildiumProperty.OperatingBankAccountId)
        .limit(1)
        .maybeSingle();

      if (existingGl) {
        operatingBankGlAccountId = existingGl.id;
      } else {
        console.log(
          `Bank GL account for Buildium bank account ${buildiumProperty.OperatingBankAccountId} not found locally - skipping relationship`,
        );
        // Note: In webhook context, we don't fetch missing bank accounts to avoid complexity
        // A full sync process should handle creating missing GL/bank info.
      }
    } catch (error) {
      console.warn('Error resolving bank GL account:', error);
    }
  }

  return {
    ...baseProperty,
    operating_bank_gl_account_id: operatingBankGlAccountId,
  };
}

function mapCountryFromBuildium(country?: string | null): string | null {
  if (!country) return null;
  return country.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function mapOwnerToContactFromBuildium(o: any) {
  return {
    is_company: !!o.IsCompany,
    first_name: o.IsCompany ? null : o.FirstName || null,
    last_name: o.IsCompany ? null : o.LastName || null,
    company_name: o.IsCompany ? o.CompanyName || null : null,
    primary_email: o.Email || null,
    alt_email: o.AlternateEmail || null,
    primary_phone: o.PhoneNumbers?.Mobile || o.PhoneNumbers?.Home || o.PhoneNumbers?.Work || null,
    alt_phone: o.PhoneNumbers?.Work || o.PhoneNumbers?.Home || null,
    date_of_birth: o.DateOfBirth || null,
    primary_address_line_1: o.Address?.AddressLine1 || null,
    primary_address_line_2: o.Address?.AddressLine2 || null,
    primary_address_line_3: o.Address?.AddressLine3 || null,
    primary_city: o.Address?.City || null,
    primary_state: o.Address?.State || null,
    primary_postal_code: o.Address?.PostalCode || null,
    primary_country: mapCountryFromBuildium(o.Address?.Country),
    alt_address_line_1: null,
    alt_address_line_2: null,
    alt_address_line_3: null,
    alt_city: null,
    alt_state: null,
    alt_postal_code: null,
    alt_country: null,
    mailing_preference: 'primary',
  };
}

async function findOrCreateOwnerContactEdge(o: any, supabase: any): Promise<number> {
  const email = o.Email || null;
  if (email) {
    const { data: existing, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('primary_email', email)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    if (existing) {
      const mapped = mapOwnerToContactFromBuildium(o);
      const patch: Record<string, any> = {};
      for (const [k, v] of Object.entries(mapped)) {
        if (v !== null && v !== '' && (existing as any)[k] == null) patch[k] = v;
      }
      if (Object.keys(patch).length) {
        const { error: updErr } = await supabase
          .from('contacts')
          .update(patch)
          .eq('id', existing.id);
        if (updErr) throw updErr;
      }
      return existing.id;
    }
  }
  const now = new Date().toISOString();
  const payload = mapOwnerToContactFromBuildium(o);
  const { data: created, error: insErr } = await supabase
    .from('contacts')
    .insert({ ...payload, created_at: now, updated_at: now })
    .select('id')
    .single();
  if (insErr) throw insErr;
  return created.id;
}

async function upsertOwnerFromBuildiumEdge(
  o: any,
  supabase: any,
): Promise<{ ownerId: string; created: boolean }> {
  const contactId = await findOrCreateOwnerContactEdge(o, supabase);
  const now = new Date().toISOString();
  const base: any = {
    contact_id: contactId,
    is_active: true,
    management_agreement_start_date: o.ManagementAgreementStartDate || null,
    management_agreement_end_date: o.ManagementAgreementEndDate || null,
    tax_address_line_1: o.TaxInformation?.Address?.AddressLine1 || null,
    tax_address_line_2: o.TaxInformation?.Address?.AddressLine2 || null,
    tax_address_line_3: o.TaxInformation?.Address?.AddressLine3 || null,
    tax_city: o.TaxInformation?.Address?.City || null,
    tax_state: o.TaxInformation?.Address?.State || null,
    tax_postal_code: o.TaxInformation?.Address?.PostalCode || null,
    tax_country: mapCountryFromBuildium(o.TaxInformation?.Address?.Country),
    tax_payer_id: o.TaxInformation?.TaxPayerId || o.TaxId || null,
    tax_payer_name1: o.TaxInformation?.TaxPayerName1 || null,
    tax_payer_name2: o.TaxInformation?.TaxPayerName2 || null,
    tax_include1099:
      typeof o.TaxInformation?.IncludeIn1099 === 'boolean' ? o.TaxInformation.IncludeIn1099 : null,
    buildium_owner_id: o.Id,
    buildium_created_at: o.CreatedDate || null,
    buildium_updated_at: o.ModifiedDate || null,
    updated_at: now,
  };

  const { data: existing, error } = await supabase
    .from('owners')
    .select('id')
    .eq('buildium_owner_id', o.Id)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  if (existing) {
    const { error: updErr } = await supabase.from('owners').update(base).eq('id', existing.id);
    if (updErr) throw updErr;
    return { ownerId: existing.id, created: false };
  } else {
    const insertPayload = { ...base, created_at: now };
    const { data: created, error: insErr2 } = await supabase
      .from('owners')
      .insert(insertPayload)
      .select('id')
      .single();
    if (insErr2) throw insErr2;
    return { ownerId: created.id, created: true };
  }
}

function mapPropertyTypeFromBuildium(buildiumType: string): string {
  switch (buildiumType) {
    case 'Commercial':
      return 'Office';
    case 'Association':
      return 'Rental';
    default:
      return 'Rental';
  }
}

const buildiumSignatureCache = new Map<string, number>();
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBuildiumWebhookPayload(body: unknown): BuildiumWebhookPayload | null {
  const raw = body as any;
  if (!raw || typeof raw !== 'object') return null;

  if (Array.isArray(raw.Events)) {
    return { Events: raw.Events as BuildiumWebhookEvent[] };
  }

  if (raw.Event && typeof raw.Event === 'object') {
    return { Events: [raw.Event as BuildiumWebhookEvent] };
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
    return { Events: [raw as BuildiumWebhookEvent] };
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
      replayCache: buildiumSignatureCache,
    });
    if (!verification.ok) {
      console.warn('buildium-webhook signature rejected', {
        reason: verification.reason,
        status: verification.status,
        timestamp: verification.timestamp ?? null,
        signaturePreview: verification.signature ? verification.signature.slice(0, 12) : null,
        metric: 'buildium_webhook.signature_failure',
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

    const normalizedPayload = normalizeBuildiumWebhookPayload(parsedBody);
    if (!normalizedPayload) {
      console.warn('buildium-webhook payload missing events', {
        hasEventsArray: Array.isArray((parsedBody as any)?.Events),
        keys: parsedBody && typeof parsedBody === 'object' ? Object.keys(parsedBody as any) : [],
      });
      return new Response(JSON.stringify({ error: 'No webhook events found in payload' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const payloadResult = validateWebhookPayload(normalizedPayload, BuildiumWebhookPayloadSchema);
    if (!payloadResult.ok) {
      console.warn('buildium-webhook schema validation failed', {
        errors: payloadResult.errors,
        eventTypes: normalizedPayload.Events.map((evt: any) => deriveEventType(evt)),
      });
      await sendPagerDutyEvent({
        summary: 'Buildium webhook schema validation failed',
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

    const payload: BuildiumWebhookPayload = payloadResult.data;

    const validationFailures = payload.Events.map((event, idx) => {
      const eventForValidation: BuildiumWebhookEventLike = {
        ...event,
        Id: event.Id != null ? String(event.Id) : undefined,
        EventId: event.EventId != null ? String(event.EventId) : undefined,
        EventDate: event.EventDate != null ? String(event.EventDate) : undefined,
        EventDateTime: event.EventDateTime != null ? String(event.EventDateTime) : undefined,
        EntityId:
          typeof event.EntityId === 'number'
            ? event.EntityId
            : event.EntityId != null
              ? Number(event.EntityId)
              : undefined,
      };

      const validation = validateBuildiumEvent(eventForValidation);
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
      console.warn('buildium-webhook payload validation failed', { failures: validationFailures });
      await sendPagerDutyEvent({
        summary: 'Buildium webhook payload validation failed',
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

    // Initialize Buildium client
    const rawCreds = (payload as any)?.credentials as Partial<BuildiumCredentials> | undefined;
    const buildiumClient = new BuildiumClient(
      rawCreds?.clientId && rawCreds?.clientSecret
        ? {
            baseUrl: (rawCreds.baseUrl || 'https://apisandbox.buildium.com/v1').replace(/\/$/, ''),
            clientId: rawCreds.clientId,
            clientSecret: rawCreds.clientSecret,
          }
        : null,
    );

    // Log webhook event
    console.log('Received webhook with', payload.Events.length, 'events');

    // Process webhook events with idempotent insert + conflict logging
    const results = [];
    let processingErrors = 0;
    for (const event of payload.Events) {
      const eventType = deriveEventType(event as Record<string, unknown>);

      const storeResult = await insertBuildiumWebhookEventRecord(supabase, event, {
        webhookType: 'buildium-webhook',
        signature: verification.signature ?? null,
      });

      if (storeResult.status === 'invalid') {
        console.warn('buildium-webhook normalization failed', {
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
        console.warn('buildium-webhook duplicate delivery', {
          webhookId: storeResult.normalized.buildiumWebhookId,
          eventName: storeResult.normalized.eventName,
          eventCreatedAt: storeResult.normalized.eventCreatedAt,
        });
        // Repair path: if Next.js ingested the webhook record but did not perform the downstream work
        // (e.g., BankAccount.Transaction.Created previously marked "processed" without creating ledger rows),
        // allow re-processing when the target transaction is still missing.
        if (eventType === 'BankAccount.Transaction.Created') {
          const depositId =
            (event as any)?.TransactionId ?? (event as any)?.Data?.TransactionId ?? null;
          const depositIdNum = Number(depositId);
          if (Number.isFinite(depositIdNum) && depositIdNum > 0) {
            const { data: existingTx } = await supabase
              .from('transactions')
              .select('id')
              .eq('buildium_transaction_id', depositIdNum)
              .maybeSingle();
            if (existingTx?.id) {
              results.push({
                eventId: storeResult.normalized.buildiumWebhookId,
                success: true,
                duplicate: true,
                eventType,
              });
              continue;
            }
            console.warn(
              'buildium-webhook duplicate event but missing deposit transaction; reprocessing',
              {
                depositId: depositIdNum,
                webhookId: storeResult.normalized.buildiumWebhookId,
                eventCreatedAt: storeResult.normalized.eventCreatedAt,
              },
            );
            // Fall through to normal routing/processing using the existing persisted webhook row.
          } else {
            results.push({
              eventId: storeResult.normalized.buildiumWebhookId,
              success: true,
              duplicate: true,
              eventType,
            });
            continue;
          }
        } else if (eventType === 'BankAccount.Transaction.Updated') {
          // Next.js already logged the webhook row before forwarding to the edge function.
          // Re-process to ensure the existing deposit transaction is updated.
          console.warn('buildium-webhook duplicate update event; reprocessing', {
            webhookId: storeResult.normalized.buildiumWebhookId,
            transactionId: (event as any)?.TransactionId ?? null,
          });
        } else if (eventType === 'BankAccount.Transaction.Deleted') {
          // Allow delete events to re-run idempotently to ensure local cleanup.
          console.warn('buildium-webhook duplicate delete event; reprocessing', {
            webhookId: storeResult.normalized.buildiumWebhookId,
            transactionId: (event as any)?.TransactionId ?? null,
          });
        } else if (eventType === 'BankAccount.Created') {
          // Allow bank account creation events to re-run in case the initial insert failed.
          console.warn('buildium-webhook duplicate bank account event; reprocessing', {
            webhookId: storeResult.normalized.buildiumWebhookId,
            bankAccountId: (event as any)?.BankAccountId ?? null,
          });
        } else if (eventType === 'BankAccount.Updated') {
          console.warn('buildium-webhook duplicate bank account update event; reprocessing', {
            webhookId: storeResult.normalized.buildiumWebhookId,
            bankAccountId: (event as any)?.BankAccountId ?? null,
          });
        } else if (eventType === 'BankAccount.Deleted') {
          console.warn('buildium-webhook duplicate bank account delete event; reprocessing', {
            webhookId: storeResult.normalized.buildiumWebhookId,
            bankAccountId: (event as any)?.BankAccountId ?? null,
          });
        } else {
          results.push({
            eventId: storeResult.normalized.buildiumWebhookId,
            success: true,
            duplicate: true,
            eventType,
          });
          continue;
        }
      }

      const routingDecision = routeGeneralWebhookEvent(eventType);
      if (routingDecision !== 'process') {
        const status = routingDecision === 'dead-letter' ? 'dead-letter' : 'skipped';
        await emitRoutingTelemetry(
          'buildium-webhook',
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

        console.warn('buildium-webhook routing skipped event', {
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
          const result = await processWebhookEvent(event, eventType, buildiumClient, supabase);
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
        } catch (error) {
          lastError = error;
          processingErrors++;
          const errorMessage = (error as any)?.message || 'Unknown error';
          console.error('buildium-webhook processing failed', {
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

    // Emit simple backlog metric (unprocessed count)
    try {
      const { count: backlogCount } = await supabase
        .from('buildium_webhook_events')
        .select('id', { count: 'exact', head: true })
        .eq('processed', false);
      console.log('buildium-webhook backlog depth', { backlogCount, processingErrors });
    } catch (e) {
      console.warn('buildium-webhook backlog metric failed', { error: (e as any)?.message });
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.length - successCount;

    console.log('Webhook processing completed:', {
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
  } catch (error) {
    console.error('Error in buildium-webhook function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
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

async function processWebhookEvent(
  event: BuildiumWebhookEvent,
  eventType: string,
  buildiumClient: BuildiumClient,
  supabase: any,
): Promise<{ success: boolean; error?: string }> {
  try {
    switch (eventType) {
      case 'Property.Created':
      case 'Property.Updated':
        return await processPropertyEvent(event, buildiumClient, supabase);

      case 'Owner.Created':
      case 'Owner.Updated':
        return await processOwnerEvent(event, buildiumClient, supabase);

      case 'Lease.Created':
      case 'Lease.Updated':
        return await processLeaseEvent(event);

      case 'BankAccount.Created':
        return await processBankAccountEvent(event, buildiumClient, supabase);
      case 'BankAccount.Updated':
        return await processBankAccountEvent(event, buildiumClient, supabase);
      case 'BankAccount.Deleted':
        return await processBankAccountDeletedEvent(event, buildiumClient, supabase);

      case 'BankAccount.Transaction.Created':
        return await processBankAccountTransactionEvent(event, eventType, buildiumClient, supabase);
      case 'BankAccount.Transaction.Updated':
        return await processBankAccountTransactionEvent(event, eventType, buildiumClient, supabase);
      case 'BankAccount.Transaction.Deleted':
        return await processBankAccountTransactionDeletedEvent(event, buildiumClient, supabase);

      default:
        console.log('Unhandled webhook event type:', eventType);
        return { success: true }; // Don't fail for unhandled events
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing webhook event:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function processPropertyEvent(
  event: BuildiumWebhookEvent,
  buildiumClient: BuildiumClient,
  supabase: any,
): Promise<{ success: boolean; error?: string }> {
  try {
    const entityId = Number(event.EntityId ?? (event as any)?.Data?.EntityId);
    if (!Number.isFinite(entityId)) {
      return { success: false, error: 'Missing EntityId for property event' };
    }

    // Fetch the full property data from Buildium
    const property = await buildiumClient.getProperty(entityId);

    // Map to local format with bank account resolution
    const localData = await mapPropertyFromBuildiumWithBankAccount(property, supabase);

    // Check if property already exists locally
    const { data: existingProperty } = await supabase
      .from('properties')
      .select('id')
      .eq('buildium_property_id', property.Id)
      .single();

    if (existingProperty) {
      // Update existing property
      await supabase.from('properties').update(localData).eq('id', existingProperty.id);

      console.log('Property updated from Buildium:', existingProperty.id);
      return { success: true };
    } else {
      // Create new property
      const { data: newProperty, error } = await supabase
        .from('properties')
        .insert(localData)
        .select()
        .single();

      if (error) throw error;

      console.log('Property created from Buildium:', newProperty.id);
      return { success: true };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function processOwnerEvent(
  event: BuildiumWebhookEvent,
  buildiumClient: BuildiumClient,
  supabase: any,
): Promise<{ success: boolean; error?: string }> {
  try {
    const entityId = Number(event.EntityId ?? (event as any)?.Data?.EntityId);
    if (!Number.isFinite(entityId)) {
      return { success: false, error: 'Missing EntityId for owner event' };
    }

    // Fetch the full owner data from Buildium
    const owner = await buildiumClient.getOwner(entityId);
    const res = await upsertOwnerFromBuildiumEdge(owner, supabase);
    console.log(
      res.created ? 'Owner created from webhook' : 'Owner updated from webhook',
      res.ownerId,
    );
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function processLeaseEvent(event: BuildiumWebhookEvent): Promise<{ success: boolean; error?: string }> {
  try {
    const leaseId = Number(
      event.LeaseId ?? event.EntityId ?? (event as any)?.Data?.LeaseId ?? (event as any)?.Data?.EntityId,
    );
    if (!Number.isFinite(leaseId)) {
      return { success: false, error: 'Missing LeaseId/EntityId for lease event' };
    }

    // Delegate to buildium-sync edge function to ensure consistent mapping/upsert
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/buildium-sync`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entityType: 'lease',
        operation: 'syncOneFromBuildium',
        entityData: { Id: leaseId },
      }),
    });
    if (!res.ok) {
      const details = await res.json().catch(() => ({}));
      console.error('Edge lease sync failed', details);
      return { success: false, error: 'Edge lease sync failed' };
    }
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

async function processBankAccountEvent(
  event: BuildiumWebhookEvent,
  buildiumClient: BuildiumClient,
  supabase: any,
): Promise<{ success: boolean; error?: string }> {
  const bankAccountIdRaw =
    (event as any)?.BankAccountId ??
    (event as any)?.EntityId ??
    (event as any)?.Data?.BankAccountId ??
    null;
  const accountId = (event as any)?.AccountId ?? (event as any)?.Data?.AccountId ?? null;
  const bankAccountId = Number(bankAccountIdRaw);

  if (!Number.isFinite(bankAccountId) || bankAccountId <= 0) {
    return { success: false, error: 'Missing BankAccountId on webhook event' };
  }

  const orgId = await resolveOrgIdFromBuildiumAccountEdge(supabase, accountId);

  let bankAccount: any = null;
  try {
    bankAccount = await buildiumClient.getBankAccount(bankAccountId);
  } catch (err) {
    const message = (err as any)?.message ?? 'Failed to fetch bank account';
    console.error('BankAccount fetch failed', { bankAccountId, err: message });
    return { success: false, error: message };
  }

  const { glAccountId } = await ensureBankGlAccountEdge(supabase, bankAccount, orgId ?? null);
  if (!glAccountId) {
    return { success: false, error: 'Failed to create bank GL account' };
  }

  // Ensure full bank metadata is updated with latest payload.
  const normalizeBankAccountType = (value?: string | null): string | null => {
    if (!value || typeof value !== 'string') return null;
    const v = value.trim().toLowerCase().replace(/\s+/g, '_');
    const map: Record<string, string> = {
      checking: 'checking',
      savings: 'savings',
      money_market: 'money_market',
      moneymarket: 'money_market',
      certificate_of_deposit: 'certificate_of_deposit',
      certificateofdeposit: 'certificate_of_deposit',
    };
    return map[v] ?? null;
  };
  const normalizeCountry = (value?: string | null): string | null => {
    if (!value || typeof value !== 'string') return null;
    const spaced = value
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .trim();
    if (!spaced) return null;
    const titled = spaced
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    return titled || null;
  };

  const updatePayload = {
    name: bankAccount?.Name ?? 'Bank Account',
    description: bankAccount?.Description ?? null,
    type: (bankAccount?.GLAccount?.Type as any) || 'asset',
    sub_type: bankAccount?.GLAccount?.SubType ?? null,
    is_default_gl_account: bankAccount?.GLAccount?.IsDefaultGLAccount ?? false,
    default_account_name: bankAccount?.GLAccount?.DefaultAccountName ?? null,
    is_contra_account: bankAccount?.GLAccount?.IsContraAccount ?? false,
    is_active: bankAccount?.IsActive ?? true,
    is_bank_account: true,
    is_credit_card_account: bankAccount?.GLAccount?.IsCreditCardAccount ?? false,
    buildium_parent_gl_account_id: bankAccount?.GLAccount?.ParentGLAccountId ?? null,
    cash_flow_classification: bankAccount?.GLAccount?.CashFlowClassification ?? null,
    exclude_from_cash_balances: bankAccount?.ExcludeFromCashBalances ?? false,
    bank_account_type: normalizeBankAccountType(bankAccount?.BankAccountType),
    bank_account_number: bankAccount?.AccountNumberUnmasked ?? bankAccount?.AccountNumber ?? null,
    bank_routing_number: bankAccount?.RoutingNumber ?? null,
    bank_country: normalizeCountry(bankAccount?.Country),
    bank_check_printing_info: bankAccount?.CheckPrintingInfo ?? null,
    bank_electronic_payments: bankAccount?.ElectronicPayments ?? null,
    bank_buildium_balance: bankAccount?.Balance ?? null,
    bank_balance: bankAccount?.Balance ?? null,
    updated_at: new Date().toISOString(),
  };
  const { error: updErr } = await supabase
    .from('gl_accounts')
    .update(updatePayload)
    .eq('id', glAccountId);
  if (updErr) {
    console.error('Failed to update bank GL account', { glAccountId, error: updErr.message });
    return { success: false, error: updErr.message };
  }

  return { success: true };
}

async function processBankAccountDeletedEvent(
  event: BuildiumWebhookEvent,
  buildiumClient: BuildiumClient,
  supabase: any,
): Promise<{ success: boolean; error?: string }> {
  const bankAccountIdRaw =
    (event as any)?.BankAccountId ??
    (event as any)?.EntityId ??
    (event as any)?.Data?.BankAccountId ??
    null;
  const accountId = (event as any)?.AccountId ?? (event as any)?.Data?.AccountId ?? null;
  const bankAccountId = Number(bankAccountIdRaw);

  if (!Number.isFinite(bankAccountId) || bankAccountId <= 0) {
    return { success: false, error: 'Missing BankAccountId on webhook event' };
  }

  const orgId = await resolveOrgIdFromBuildiumAccountEdge(supabase, accountId);

  let query = supabase.from('gl_accounts').select('id').eq('buildium_gl_account_id', bankAccountId);
  if (orgId) query = query.eq('org_id', orgId);
  const { data: existing, error: findErr } = await query.maybeSingle();
  if (findErr && findErr.code !== 'PGRST116') throw findErr;

  if (!(existing as any)?.id) {
    console.warn(
      'BankAccount.Deleted received but no local bank gl account found; skipping delete',
      {
        bankAccountId,
      },
    );
    return { success: true };
  }

  const glId = (existing as any).id;
  const { error: delErr } = await supabase.from('gl_accounts').delete().eq('id', glId);
  if (delErr) throw delErr;

  console.log('Deleted bank GL account from BankAccount.Deleted', { bankAccountId, glId });
  return { success: true };
}

async function processBankAccountTransactionEvent(
  event: BuildiumWebhookEvent,
  eventType: string,
  buildiumClient: BuildiumClient,
  supabase: any,
): Promise<{ success: boolean; error?: string }> {
  async function resolvePropertyIdFromBuildium(
    buildiumPropId: number | null | undefined,
  ): Promise<string | null> {
    if (!buildiumPropId) return null;
    const { data, error } = await supabase
      .from('properties')
      .select('id')
      .eq('buildium_property_id', buildiumPropId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return (data as any)?.id ?? null;
  }

  async function resolveUnitIdFromBuildium(
    buildiumUnitId: number | null | undefined,
  ): Promise<string | null> {
    if (!buildiumUnitId) return null;
    const { data, error } = await supabase
      .from('units')
      .select('id')
      .eq('buildium_unit_id', buildiumUnitId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw error;
    return (data as any)?.id ?? null;
  }

  const bankAccountIdRaw =
    (event as any)?.BankAccountId ??
    (event as any)?.Data?.BankAccountId ??
    (event as any)?.EntityId ??
    null;
  const depositIdRaw = (event as any)?.TransactionId ?? (event as any)?.Data?.TransactionId ?? null;
  const accountId = (event as any)?.AccountId ?? (event as any)?.Data?.AccountId ?? null;
  const transactionTypeRaw =
    (event as any)?.TransactionType ?? (event as any)?.Data?.TransactionType ?? null;
  const normalizedType = transactionTypeRaw ? String(transactionTypeRaw).toLowerCase() : 'deposit';
  const isUpdateEvent = eventType === 'BankAccount.Transaction.Updated';
  const isTransferEvent = normalizedType === 'other' || normalizedType === 'transfer';

  const bankAccountId = Number(bankAccountIdRaw);
  const depositId = Number(depositIdRaw);

  if (
    !Number.isFinite(bankAccountId) ||
    !Number.isFinite(depositId) ||
    bankAccountId <= 0 ||
    depositId <= 0
  ) {
    return { success: false, error: 'Missing BankAccountId or TransactionId on webhook event' };
  }

  // Only handle deposits and transfers (other). Other transaction types should be handled by a dedicated handler.
  if (normalizedType !== 'deposit' && !isTransferEvent) {
    console.log(`Skipping ${eventType} unsupported transaction type`, {
      bankAccountId,
      transactionId: depositId,
      transactionType: transactionTypeRaw,
    });
    return { success: true };
  }

  const orgId = await resolveOrgIdFromBuildiumAccountEdge(supabase, accountId);

  let deposit: any = null;
  try {
    if (isTransferEvent) {
      deposit = await buildiumClient.getBankTransaction(bankAccountId, depositId);
    } else if (isUpdateEvent) {
      // Buildium may represent deposits as bank-account "deposits" rather than generic "transactions".
      // We try the deposit endpoint first (consistent with Created), and fall back to the transactions endpoint.
    try {
      deposit = await buildiumClient.getBankDeposit(bankAccountId, depositId);
    } catch (_err) {
      deposit = await buildiumClient.getBankTransaction(bankAccountId, depositId);
    }
    } else {
      deposit = await buildiumClient.getBankDeposit(bankAccountId, depositId);
    }
  } catch (err) {
    const message = (err as any)?.message || 'Failed to fetch bank transaction';
    console.error('BankAccount.Transaction fetch failed', {
      bankAccountId,
      depositId,
      eventType,
      err: message,
    });
    return { success: false, error: message };
  }

  const baseHeaderDate =
    deposit?.Date ??
    deposit?.TransactionDate ??
    deposit?.CreatedDate ??
    deposit?.DepositDate ??
    deposit?.EntryDate ??
    new Date().toISOString().slice(0, 10);

  if (isTransferEvent) {
    let glTx: any = null;
    try {
      glTx = await buildiumClient.getGeneralLedgerTransaction(depositId);
    } catch (err) {
      console.error('Failed to fetch GL transaction for transfer', {
        bankAccountId,
        depositId,
        err: (err as any)?.message ?? String(err),
      });
      return { success: false, error: 'Failed to fetch GL transaction for transfer' };
    }

    const journalLines: any[] = Array.isArray(glTx?.Journal?.Lines) ? glTx.Journal.Lines : [];
    if (!journalLines.length) {
      return { success: false, error: 'Transfer GL journal lines missing' };
    }

    const resolvedLines: any[] = [];
    let bankGlAccountId: string | null = null;
    let bankGlAccountBuildiumId: number | null = null;
    let totalDebits = 0;

    for (const line of journalLines) {
      const amountRaw = Number(line?.Amount ?? 0);
      if (!Number.isFinite(amountRaw) || amountRaw === 0) continue;
      const postingType = amountRaw >= 0 ? 'Debit' : 'Credit';
      const amountAbs = Math.abs(amountRaw);
      const glEnsure = await ensureGlAccountFromGlLineEdge(
        supabase,
        line?.GLAccount,
        orgId ?? null,
      );
      const glAccountId = glEnsure.glAccountId;
      const glAccountBuildiumId = glEnsure.glAccountBuildiumId;
      if (!glAccountId) continue;

      // Heuristic: the credit line represents the source (outgoing) bank account.
      if (postingType === 'Credit' && !bankGlAccountId) {
        bankGlAccountId = glAccountId;
        bankGlAccountBuildiumId = glAccountBuildiumId;
      }

      const entityType = line?.AccountingEntity?.AccountingEntityType;
      const buildiumPropertyId =
        entityType === 'Rental' ? Number(line?.AccountingEntity?.Id ?? null) : null;
      const buildiumUnitId =
        Number(line?.AccountingEntity?.Unit?.Id ?? line?.AccountingEntity?.Unit?.ID ?? null) ||
        null;

      const propertyId = await resolvePropertyIdFromBuildium(buildiumPropertyId);
      const unitId = await resolveUnitIdFromBuildium(buildiumUnitId);

      resolvedLines.push({
        gl_account_id: glAccountId,
        gl_account_buildium_id: glAccountBuildiumId,
        amount: amountAbs,
        posting_type: postingType,
        property_id: propertyId,
        unit_id: unitId,
        buildium_property_id: buildiumPropertyId,
        buildium_unit_id: buildiumUnitId,
        buildium_lease_id: null,
      });

      if (postingType === 'Debit') totalDebits += amountAbs;
    }

    if (!resolvedLines.length)
      return { success: false, error: 'No GL lines resolved for transfer' };

    const now = new Date().toISOString();
    const header = {
      buildium_transaction_id: depositId,
      transaction_type: 'Other',
      total_amount:
        totalDebits || resolvedLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0),
      date: baseHeaderDate,
      memo: glTx?.Journal?.Memo ?? deposit?.Memo ?? null,
      bank_gl_account_id: bankGlAccountId,
      bank_gl_account_buildium_id: bankGlAccountBuildiumId,
      updated_at: now,
    };

    const { data: existingTx, error: findTxErr } = await supabase
      .from('transactions')
      .select('id, created_at')
      .eq('buildium_transaction_id', depositId)
      .maybeSingle();
    if (findTxErr && findTxErr.code !== 'PGRST116') throw findTxErr;

    let transactionIdLocal: string;
    if ((existingTx as any)?.id) {
      const { data: updated, error: updErr } = await supabase
        .from('transactions')
        .update(header)
        .eq('id', (existingTx as any).id)
        .select('id')
        .maybeSingle();
      if (updErr) throw updErr;
      transactionIdLocal = (updated as any)?.id ?? (existingTx as any).id;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('transactions')
        .insert({ ...header, created_at: now })
        .select('id')
        .maybeSingle();
      if (insErr) throw insErr;
      transactionIdLocal = (inserted as any)?.id;
    }

    await supabase.from('transaction_lines').delete().eq('transaction_id', transactionIdLocal);
    await supabase
      .from('transaction_payment_transactions')
      .delete()
      .eq('transaction_id', transactionIdLocal);
    await supabase.from('journal_entries').delete().eq('transaction_id', transactionIdLocal);

    const baseLineFields = {
      transaction_id: transactionIdLocal,
      memo: glTx?.Journal?.Memo ?? deposit?.Memo ?? null,
      account_entity_type: 'Rental',
      account_entity_id: (deposit as any)?.AccountId ?? null,
      date: baseHeaderDate,
      created_at: now,
      updated_at: now,
    };

    const linesToInsert = resolvedLines.map((l) => ({
      ...baseLineFields,
      gl_account_id: l.gl_account_id,
      amount: l.amount,
      posting_type: l.posting_type,
      buildium_property_id: l.buildium_property_id,
      buildium_unit_id: l.buildium_unit_id,
      buildium_lease_id: l.buildium_lease_id,
      lease_id: null,
      property_id: l.property_id,
      unit_id: l.unit_id,
    }));

    const { error: linesErr } = await supabase.from('transaction_lines').insert(linesToInsert);
    if (linesErr) throw linesErr;

    // Populate canonical PaidBy/PaidTo on the transaction (single-source-of-truth).
    const paidByCandidates: PaidByCandidate[] = resolvedLines.map((l) => ({
      accountingEntityId: l.buildium_property_id ?? null,
      accountingEntityType: 'Rental',
      accountingEntityHref: null,
      accountingUnitId: l.buildium_unit_id ?? null,
      accountingUnitHref: null,
      amount: l.amount ?? null,
    }));
    const paidToCandidates: PaidToCandidate[] = []; // No counterparty available in this path.
    const labelContext = await resolvePaidByLabelContext(supabase, paidByCandidates);
    const canonicalPatch = buildCanonicalTransactionPatch({
      paidByCandidates,
      paidToCandidates,
      labelContext,
    });
    await supabase.from('transactions').update(canonicalPatch).eq('id', transactionIdLocal);

    return { success: true };
  }

  // Deposit-specific handling below
  // The deposit payload sometimes omits GL account details for the bank account. If so, fetch the bank account.
  let bankAccountPayload = deposit?.BankAccount ?? deposit;
  if (
    !bankAccountPayload?.GLAccount?.Id &&
    !bankAccountPayload?.GLAccountId &&
    !bankAccountPayload?.GLAccountID
  ) {
    try {
      bankAccountPayload = await buildiumClient.getBankAccount(bankAccountId);
    } catch (err) {
      console.warn(
        'Failed to fetch bank account details for deposit; bank GL account resolution may fail',
        {
          bankAccountId,
          depositId,
          err: (err as any)?.message ?? String(err),
        },
      );
    }
  }

  const { glAccountId: bankGlAccountId, glAccountBuildiumId } = await ensureBankGlAccountEdge(
    supabase,
    bankAccountPayload,
    orgId ?? null,
  );
  if (!bankGlAccountId) {
    return { success: false, error: 'Bank GL account not resolved for bank account transaction' };
  }

  const udfGlAccountId = await resolveUndepositedFundsGlAccountIdEdge(supabase, orgId ?? null);
  if (!udfGlAccountId) {
    return { success: false, error: 'Undeposited Funds GL account not found' };
  }

  const now = new Date().toISOString();
  const headerDate = baseHeaderDate;

  // Build a normalized list of payment components for this deposit:
  // Prefer PaymentTransactions (with amounts), else fall back to PaymentTransactionIds.
  let rawPaymentTransactions: any[] = Array.isArray(deposit?.PaymentTransactions)
    ? deposit.PaymentTransactions
    : Array.isArray(deposit?.DepositDetails?.PaymentTransactions)
      ? deposit.DepositDetails.PaymentTransactions
      : [];

  if (!rawPaymentTransactions.length) {
    try {
      const depositGlTx = await buildiumClient.getGeneralLedgerTransaction(Number(depositId));
      const glPts = Array.isArray(depositGlTx?.DepositDetails?.PaymentTransactions)
        ? depositGlTx.DepositDetails.PaymentTransactions
        : [];
      if (glPts.length) rawPaymentTransactions = glPts;
    } catch (err) {
      console.warn('Failed to fetch GL transaction for deposit to resolve payment splits', {
        depositId,
        err: (err as any)?.message ?? String(err),
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
  }
  for (const id of rawPaymentTransactionIds) {
    // Avoid duplicates
    if (paymentParts.some((p) => p.id === id)) continue;
    paymentParts.push({ id, amount: null });
  }

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

  for (const part of paymentParts) {
    const { data: txRow, error: txErr } = await supabase
      .from('transactions')
      // NOTE: some deployments do not have property_id on transactions; property context lives on transaction_lines.
      .select('id, total_amount')
      .eq('buildium_transaction_id', part.id)
      .maybeSingle();
    if (txErr && txErr.code !== 'PGRST116') throw txErr;

    let propertyId: string | null = null;
    let unitId: string | null = null;
    let leaseId: string | null = null;
    let buildiumPropertyId: number | null = null;
    let buildiumUnitId: number | null = null;
    let buildiumLeaseId: number | null = null;
    let derivedAmount =
      part.amount != null && Number.isFinite(part.amount) ? Math.abs(part.amount) : null;

    if ((txRow as any)?.id) {
      const paymentTransactionLocalId = (txRow as any).id;
      const { data: ctxLine, error: ctxErr } = await supabase
        .from('transaction_lines')
        .select(
          'property_id, unit_id, lease_id, buildium_property_id, buildium_unit_id, buildium_lease_id, amount, posting_type',
        )
        .eq('transaction_id', paymentTransactionLocalId)
        .limit(1)
        .maybeSingle();
      if (ctxErr && ctxErr.code !== 'PGRST116') throw ctxErr;

      propertyId = (ctxLine as any)?.property_id ?? null;
      unitId = (ctxLine as any)?.unit_id ?? null;
      leaseId = (ctxLine as any)?.lease_id ?? null;
      buildiumPropertyId = (ctxLine as any)?.buildium_property_id ?? null;
      buildiumUnitId = (ctxLine as any)?.buildium_unit_id ?? null;
      buildiumLeaseId = (ctxLine as any)?.buildium_lease_id ?? null;

      if (!propertyId && buildiumPropertyId) {
        propertyId = await resolvePropertyIdFromBuildium(buildiumPropertyId);
      }
      if (!unitId && buildiumUnitId) {
        unitId = await resolveUnitIdFromBuildium(buildiumUnitId);
      }

      if (derivedAmount == null) {
        const totalFromTx = Math.abs(Number((txRow as any)?.total_amount ?? 0) || 0);
        const lineAmt = Math.abs(Number((ctxLine as any)?.amount ?? 0) || 0);
        derivedAmount = lineAmt > 0 ? lineAmt : totalFromTx;
      }
    }

    // Fallback: use AccountingEntity from raw payment transaction when local tx not found or lacks property.
    if (!propertyId && part.raw?.AccountingEntity?.AccountingEntityType === 'Rental') {
      const buildiumRentalId = Number(part.raw?.AccountingEntity?.Id);
      if (Number.isFinite(buildiumRentalId)) {
        buildiumPropertyId = buildiumRentalId;
        propertyId = await resolvePropertyIdFromBuildium(buildiumPropertyId);
      }
    }

    const amount = derivedAmount ?? NaN;
    if (!Number.isFinite(amount) || amount <= 0) continue;

    resolvedSplits.push({
      paymentId: part.id,
      amount,
      property_id: propertyId,
      unit_id: unitId,
      lease_id: leaseId,
      buildium_property_id: buildiumPropertyId,
      buildium_unit_id: buildiumUnitId,
      buildium_lease_id: buildiumLeaseId,
    });
  }

  const totalFromResolvedSplits = resolvedSplits.reduce(
    (sum, s) => sum + (Number.isFinite(s.amount) ? s.amount : 0),
    0,
  );
  const headerTotalFromDeposit =
    Number(
      deposit?.Amount ??
        deposit?.TransactionAmount ??
        deposit?.TotalAmount ??
        deposit?.DepositAmount ??
        0,
    ) || 0;
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
    updated_at: now,
  };

  const { data: existingTx, error: findTxErr } = await supabase
    .from('transactions')
    .select('id, created_at')
    .eq('buildium_transaction_id', depositId)
    .maybeSingle();
  if (findTxErr && findTxErr.code !== 'PGRST116') throw findTxErr;

  if (isUpdateEvent && !(existingTx as any)?.id) {
    // If the original Created event was missed (or was marked processed without creating the local transaction),
    // we still want Updated to be able to materialize the deposit locally. This is safe because
    // `transactions.buildium_transaction_id` is unique and we upsert by that key.
    console.warn(
      'BankAccount.Transaction.Updated received but no existing deposit found; creating deposit transaction',
      {
        bankAccountId,
        depositId,
      },
    );
  }

  let transactionIdLocal: string;
  if ((existingTx as any)?.id) {
    const { data: updated, error: updErr } = await supabase
      .from('transactions')
      .update(header)
      .eq('id', (existingTx as any).id)
      .select('id')
      .maybeSingle();
    if (updErr) throw updErr;
    transactionIdLocal = (updated as any)?.id ?? (existingTx as any).id;
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('transactions')
      .insert({ ...header, created_at: now })
      .select('id')
      .maybeSingle();
    if (insErr) throw insErr;
    transactionIdLocal = (inserted as any)?.id;
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
    account_entity_id: (deposit as any)?.AccountId ?? null,
    date: headerDate,
    created_at: now,
    updated_at: now,
  };

  if (resolvedSplits.length > 0) {
    const linesToInsert: any[] = [];
    const splitRows: any[] = [];

    for (const s of resolvedSplits) {
      // Bank debit (per property)
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

      // UDF credit (per property)
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

    const { error: splitErr } = await supabase
      .from('transaction_payment_transactions')
      .insert(splitRows);
    if (splitErr) throw splitErr;

    return { success: true };
  }

  // Fallback: if we couldn't resolve any payment/property context, insert a single pair.
  const amountAbs = Math.abs(Number(totalAmount) || 0);
  const { error: fallbackLinesErr } = await supabase.from('transaction_lines').insert([
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
  if (fallbackLinesErr) throw fallbackLinesErr;

  // Persist linkage rows if we at least have IDs (helps later repair/backfill).
  if (paymentParts.length > 0) {
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
  }

  return { success: true };
}

async function processBankAccountTransactionDeletedEvent(
  event: BuildiumWebhookEvent,
  buildiumClient: BuildiumClient,
  supabase: any,
): Promise<{ success: boolean; error?: string }> {
  const bankAccountIdRaw =
    (event as any)?.BankAccountId ??
    (event as any)?.Data?.BankAccountId ??
    (event as any)?.EntityId ??
    null;
  const depositIdRaw = (event as any)?.TransactionId ?? (event as any)?.Data?.TransactionId ?? null;

  const bankAccountId = Number(bankAccountIdRaw);
  const depositId = Number(depositIdRaw);

  if (
    !Number.isFinite(bankAccountId) ||
    !Number.isFinite(depositId) ||
    bankAccountId <= 0 ||
    depositId <= 0
  ) {
    return { success: false, error: 'Missing BankAccountId or TransactionId on webhook event' };
  }

  const { data: existingTx, error: findErr } = await supabase
    .from('transactions')
    .select('id')
    .eq('buildium_transaction_id', depositId)
    .maybeSingle();
  if (findErr && findErr.code !== 'PGRST116') throw findErr;

  if (!(existingTx as any)?.id) {
    console.warn(
      'BankAccount.Transaction.Deleted received but no local transaction found; skipping delete',
      {
        bankAccountId,
        depositId,
      },
    );
    return { success: true };
  }

  const txId = (existingTx as any).id;

  // Clean up related rows first to avoid FK issues in environments without cascade.
  const { error: splitErr } = await supabase
    .from('transaction_payment_transactions')
    .delete()
    .eq('transaction_id', txId);
  if (splitErr) throw splitErr;

  const { error: lineErr } = await supabase
    .from('transaction_lines')
    .delete()
    .eq('transaction_id', txId);
  if (lineErr) throw lineErr;

  const { error: delErr } = await supabase.from('transactions').delete().eq('id', txId);
  if (delErr) throw delErr;

  console.log('Deleted deposit transaction from BankAccount.Transaction.Deleted', {
    transactionId: txId,
    depositId,
  });
  return { success: true };
}
