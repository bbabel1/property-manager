import type { SupabaseClient } from '@supabase/supabase-js';

import { buildiumFetch } from '@/lib/buildium-http';
import {
  mapBankAccountToBuildium,
  mapBankAccountTypeFromBuildium,
  mapCountryFromBuildium,
} from '@/lib/buildium-mappers';
import { normalizeBankAccountType } from '@/lib/gl-bank-account-normalizers';
import { normalizeCountryWithDefault } from '@/lib/normalizers';
import { mapGoogleCountryToEnum } from '@/lib/utils';
import type { Database, Json } from '@/types/database';
import type {
  BuildiumBankAccount,
  BuildiumBankAccountCreate,
  BuildiumGLAccount,
} from '@/types/buildium';

type DbClient = SupabaseClient<Database>;
type BankAccountTypeEnum = Database['public']['Enums']['bank_account_type_enum'];
type GlAccountInsert = Database['public']['Tables']['gl_accounts']['Insert'];
type GlAccountUpdate = Database['public']['Tables']['gl_accounts']['Update'];

type BuildiumBankAccountPayload = BuildiumBankAccountCreate & {
  CheckPrintingInfo?: Record<string, string | boolean> | null;
};

type BuildiumBankAccountResponse = Partial<BuildiumBankAccount> & {
  Id?: number | null;
  BankAccountId?: number | null;
  AccountNumberUnmasked?: string | null;
  Balance?: number | null;
  Country?: string | null;
  GLAccount?: (BuildiumGLAccount & { ExcludeFromCashBalances?: boolean | null }) | null;
  CheckPrintingInfo?: Json | null;
  ElectronicPayments?: Json | null;
  ExcludeFromCashBalances?: boolean | null;
};

export type CreateBankAccountPayload = {
  name: string;
  description?: string;
  bank_account_type: string;
  account_number: string;
  routing_number: string;
  country: string;
  bank_information_lines?: string[];
  company_information_lines?: string[];
};

type BankAccountRow = {
  id: string;
  name: string | null;
  description: string | null;
  bank_account_type: string | null;
  bank_account_number: string | null;
  bank_routing_number: string | null;
  bank_country: Database['public']['Enums']['countries'] | null;
  is_active: boolean | null;
  buildium_gl_account_id: number | null;
  bank_balance: number | null;
  bank_buildium_balance: number | null;
  bank_check_printing_info: Json | null;
  bank_electronic_payments: Json | null;
};

export type CreateBankAccountResult =
  | { success: true; record: BankAccountRow; buildium: BuildiumBankAccountResponse }
  | { success: false; status: number; error: string; details?: string; existing?: BankAccountRow };

export type UpdateBankAccountPayload = CreateBankAccountPayload & {
  is_active?: boolean;
};

export type UpdateBankAccountResult =
  | { success: true; record: BankAccountRow; buildium: BuildiumBankAccountResponse }
  | { success: false; status: number; error: string; details?: string };

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

// Generate a deterministic local-only placeholder Buildium GL id.
// Kept within 900,000,000..900,099,999 to avoid collisions with real Buildium IDs.
function computeLocalBuildiumGlId(seed: string, bump: number = 0): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  const base = 900_000_000 + (Math.abs(h) % 100_000);
  return base + (bump % 100_000);
}

const normalizeLines = (lines?: string[]): (string | null)[] => {
  const input = Array.isArray(lines) ? lines : [];
  return Array.from({ length: 5 }).map((_, idx) => {
    const raw = input[idx];
    const str = typeof raw === 'string' ? raw.trim() : '';
    return str.length ? str : null;
  });
};

const buildCheckPrintingInfo = (
  bankLines: (string | null)[],
  companyLines: (string | null)[],
): Record<string, string> | null => {
  const fields: Record<string, string> = {};
  bankLines.forEach((line, idx) => {
    if (line) fields[`BankInformationLine${idx + 1}`] = line;
  });
  companyLines.forEach((line, idx) => {
    if (line) fields[`CompanyInformationLine${idx + 1}`] = line;
  });
  return Object.keys(fields).length ? fields : null;
};

const buildRequiredCheckPrintingInfo = (
  existing: Record<string, unknown> | null | undefined,
  bankLines: (string | null)[],
  companyLines: (string | null)[],
) => {
  const base: Record<string, string | boolean> = {
    EnableRemoteCheckPrinting: false,
    EnableLocalCheckPrinting: false,
    CheckLayoutType: 'Voucher1StubBottomMemo1Signature',
    SignatureHeading: '',
    FractionalNumber: '',
  };

  const source =
    existing && typeof existing === 'object' ? (existing as Record<string, unknown>) : {};

  const assignIf = (key: string, value: unknown) => {
    if (typeof value === 'string' || typeof value === 'number') {
      base[key] = String(value);
    } else if (typeof value === 'boolean') {
      base[key] = value;
    }
  };

  assignIf('EnableRemoteCheckPrinting', source.EnableRemoteCheckPrinting);
  assignIf('EnableLocalCheckPrinting', source.EnableLocalCheckPrinting);
  assignIf('CheckLayoutType', source.CheckLayoutType);
  assignIf('SignatureHeading', source.SignatureHeading);
  assignIf('FractionalNumber', source.FractionalNumber);

  bankLines.forEach((line, idx) => {
    const existingLine = source[`BankInformationLine${idx + 1}`];
    const chosen =
      typeof line === 'string' && line.length
        ? line
        : typeof existingLine === 'string'
          ? existingLine
          : '';
    base[`BankInformationLine${idx + 1}`] = chosen;
  });
  companyLines.forEach((line, idx) => {
    const existingLine = source[`CompanyInformationLine${idx + 1}`];
    const chosen =
      typeof line === 'string' && line.length
        ? line
        : typeof existingLine === 'string'
          ? existingLine
          : '';
    base[`CompanyInformationLine${idx + 1}`] = chosen;
  });

  return base;
};

/**
 * Creates a bank account in Buildium, then persists the Buildium response onto gl_accounts.
 */
export async function createBankGlAccountWithBuildium({
  supabase,
  orgId,
  payload,
}: {
  supabase: DbClient;
  orgId: string;
  payload: CreateBankAccountPayload;
}): Promise<CreateBankAccountResult> {
  const now = new Date().toISOString();
  const normalizedCountry = normalizeCountryWithDefault(mapGoogleCountryToEnum(payload.country));
  const normalizedType = normalizeBankAccountType(payload.bank_account_type);
  const bankInfoLines = normalizeLines(payload.bank_information_lines);
  const companyInfoLines = normalizeLines(payload.company_information_lines);
  const checkPrintingInfo = buildCheckPrintingInfo(bankInfoLines, companyInfoLines);

  // Guard against duplicates by routing/account number within the org.
  const { data: existing, error: existingErr } = await supabase
    .from('gl_accounts')
    .select(
      'id, name, description, bank_account_type, bank_account_number, bank_routing_number, bank_country, is_active, buildium_gl_account_id',
    )
    .eq('org_id', orgId)
    .eq('is_bank_account', true)
    .eq('bank_account_number', payload.account_number)
    .eq('bank_routing_number', payload.routing_number)
    .limit(1)
    .maybeSingle();

  if (!existingErr && existing) {
    return {
      success: false,
      status: 409,
      error: 'Bank account already exists',
      existing: existing as BankAccountRow,
    };
  }

  // First, persist a local GL account row with a placeholder Buildium id.
  const baseDbPayload = {
    name: payload.name,
    description: payload.description ?? null,
    type: 'Asset',
    sub_type: null,
    is_default_gl_account: false,
    default_account_name: null,
    is_contra_account: false,
    is_bank_account: true,
    is_credit_card_account: false,
    buildium_parent_gl_account_id: null,
    cash_flow_classification: null,
    exclude_from_cash_balances: false,
    bank_account_type: normalizedType as BankAccountTypeEnum | null,
    bank_account_number: payload.account_number,
    bank_routing_number: payload.routing_number,
    bank_country: normalizedCountry ?? null,
    bank_check_printing_info: checkPrintingInfo ?? null,
    bank_electronic_payments: null,
    bank_buildium_balance: null,
    bank_balance: null,
    bank_last_source: 'local' as const,
    bank_last_source_ts: now,
    is_active: true,
    org_id: orgId,
    updated_at: now,
  } satisfies Omit<GlAccountInsert, 'buildium_gl_account_id' | 'created_at'>;

  const seed = `${orgId}:${payload.name || payload.account_number || 'bank'}`;
  const MAX_PLACEHOLDER_ATTEMPTS = 25;
  let inserted: BankAccountRow | null = null;
  let lastInsertError: string | null = null;

  for (let attempt = 0; attempt < MAX_PLACEHOLDER_ATTEMPTS && !inserted; attempt += 1) {
    const placeholderId = computeLocalBuildiumGlId(seed, attempt);
    const insertPayload: GlAccountInsert = {
      ...baseDbPayload,
      buildium_gl_account_id: placeholderId,
      created_at: now,
    };

    const { data, error } = await supabase
      .from('gl_accounts')
      .insert(insertPayload)
      .select(
        'id, name, description, bank_account_type, bank_account_number, bank_routing_number, bank_country, is_active, buildium_gl_account_id, bank_check_printing_info, bank_electronic_payments, bank_buildium_balance, bank_balance',
      )
      .single();

    if (!error && data) {
      inserted = data as BankAccountRow;
      break;
    }

    const msg = String(error?.message || '');
    lastInsertError = msg || lastInsertError;

    // Retry on duplicate placeholder id; surface other errors immediately.
    if (!/duplicate key value/i.test(msg) && !msg.toLowerCase().includes('duplicate')) {
      return {
        success: false,
        status: 500,
        error: 'Failed to persist bank account locally',
        details: msg || undefined,
      };
    }
  }

  if (!inserted) {
    return {
      success: false,
      status: 500,
      error: 'Failed to persist bank account locally',
      details: lastInsertError || 'Exhausted placeholder id attempts',
    };
  }

  // Double-check the row is committed/visible before calling Buildium (avoids webhook races).
  try {
    await supabase
      .from('gl_accounts')
      .select('id')
      .eq('id', inserted.id)
      .eq('org_id', orgId)
      .eq('is_bank_account', true)
      .maybeSingle();
  } catch {
    /* best-effort visibility check */
  }

  // Create the account in Buildium.
  const buildiumBody: BuildiumBankAccountPayload = mapBankAccountToBuildium({
    name: payload.name,
    description: payload.description ?? '',
    bank_account_type: normalizedType,
    bank_account_number: payload.account_number,
    bank_routing_number: payload.routing_number,
    country: normalizedCountry ?? undefined,
    is_active: true,
  });

  if (checkPrintingInfo) {
    buildiumBody.CheckPrintingInfo = checkPrintingInfo;
  }

  const buildiumRes = await buildiumFetch('POST', '/bankaccounts', undefined, buildiumBody, orgId);

  if (!buildiumRes.ok) {
    const details =
      typeof buildiumRes.json === 'string'
        ? buildiumRes.json
        : buildiumRes.errorText || JSON.stringify(buildiumRes.json || {});

    // Best-effort cleanup of the placeholder row so callers can retry.
    try {
      await supabase.from('gl_accounts').delete().eq('id', inserted.id);
    } catch {
      /* ignore cleanup failures */
    }

    return {
      success: false,
      status: buildiumRes.status || 502,
      error: 'Failed to create bank account in Buildium',
      details,
    };
  }

  const buildiumAccount = (buildiumRes.json ?? {}) as BuildiumBankAccountResponse;
  const buildiumId = coerceNumber(buildiumAccount?.Id ?? buildiumAccount?.BankAccountId);
  if (!buildiumId) {
    return {
      success: false,
      status: 502,
      error: 'Invalid Buildium response (missing bank account id)',
    };
  }

  const rawBuildiumType = buildiumAccount?.BankAccountType;
  const mappedBuildiumType =
    rawBuildiumType === 'Checking' ||
    rawBuildiumType === 'Savings' ||
    rawBuildiumType === 'MoneyMarket' ||
    rawBuildiumType === 'CertificateOfDeposit'
      ? mapBankAccountTypeFromBuildium(rawBuildiumType)
      : null;
  const bankAccountType = normalizeBankAccountType(mappedBuildiumType ?? normalizedType);
  const accountNumber =
    buildiumAccount?.AccountNumberUnmasked ??
    buildiumAccount?.AccountNumber ??
    payload.account_number;
  const routingNumber = buildiumAccount?.RoutingNumber ?? payload.routing_number;
  const balance = typeof buildiumAccount?.Balance === 'number' ? buildiumAccount.Balance : null;
  const country =
    mapCountryFromBuildium(buildiumAccount?.Country) ??
    (normalizedCountry as Database['public']['Enums']['countries'] | null);
  const gl = buildiumAccount?.GLAccount ?? null;
  const checkPrintingInfoPayload = buildiumAccount?.CheckPrintingInfo ?? checkPrintingInfo ?? null;

  const dbPayload: GlAccountUpdate = {
    ...baseDbPayload,
    buildium_gl_account_id: buildiumId,
    name: buildiumAccount?.Name ?? payload.name,
    description: buildiumAccount?.Description ?? payload.description ?? null,
    type: gl?.Type ?? 'Asset',
    sub_type: gl?.SubType ?? null,
    is_default_gl_account: gl?.IsDefaultGLAccount ?? false,
    default_account_name: gl?.DefaultAccountName ?? null,
    is_contra_account: gl?.IsContraAccount ?? false,
    is_bank_account: true,
    is_credit_card_account: gl?.IsCreditCardAccount ?? false,
    buildium_parent_gl_account_id: gl?.ParentGLAccountId ?? null,
    cash_flow_classification: gl?.CashFlowClassification ?? null,
    exclude_from_cash_balances:
      buildiumAccount?.ExcludeFromCashBalances ?? gl?.ExcludeFromCashBalances ?? false,
    bank_account_type: bankAccountType as BankAccountTypeEnum | null,
    bank_account_number: accountNumber,
    bank_routing_number: routingNumber,
    bank_country: country ?? null,
    bank_check_printing_info: checkPrintingInfoPayload,
    bank_electronic_payments: buildiumAccount?.ElectronicPayments ?? null,
    bank_buildium_balance: balance,
    bank_balance: balance,
    bank_last_source: 'buildium' as const,
    bank_last_source_ts: now,
    is_active: typeof buildiumAccount?.IsActive === 'boolean' ? buildiumAccount.IsActive : true,
    org_id: orgId,
    updated_at: now,
  };

  const { data: updated, error: updateErr } = await supabase
    .from('gl_accounts')
    .update(dbPayload)
    .eq('id', inserted.id)
    .eq('org_id', orgId)
    .eq('is_bank_account', true)
    .select(
      'id, name, description, bank_account_type, bank_account_number, bank_routing_number, bank_country, is_active, buildium_gl_account_id, bank_check_printing_info, bank_electronic_payments, bank_buildium_balance, bank_balance',
    )
    .maybeSingle();

  if (updateErr || !updated) {
    const msg = String(updateErr?.message || '');

    // If we hit a unique constraint on the real Buildium id, surface conflict and remove placeholder.
    if (/duplicate key value/i.test(msg) || msg.toLowerCase().includes('duplicate')) {
      try {
        await supabase.from('gl_accounts').delete().eq('id', inserted.id);
      } catch {
        /* ignore cleanup failures */
      }
      return {
        success: false,
        status: 409,
        error: 'Bank account already exists',
        details: msg || undefined,
      };
    }

    return {
      success: false,
      status: 500,
      error: 'Failed to persist bank account',
      details: msg || undefined,
    };
  }

  return { success: true, record: updated as BankAccountRow, buildium: buildiumAccount };
}

/**
 * Updates an existing bank account in Buildium and persists the response into gl_accounts.
 */
export async function updateBankGlAccountWithBuildium({
  supabase,
  orgId,
  glAccountId,
  buildiumId,
  payload,
  currentIsActive,
  existingCheckPrintingInfo,
}: {
  supabase: DbClient;
  orgId: string;
  glAccountId: string;
  buildiumId: number | null | undefined;
  payload: UpdateBankAccountPayload;
  currentIsActive?: boolean | null;
  existingCheckPrintingInfo?: Record<string, unknown> | null;
}): Promise<UpdateBankAccountResult> {
  const normalizedCountry = normalizeCountryWithDefault(mapGoogleCountryToEnum(payload.country));
  const normalizedType = normalizeBankAccountType(payload.bank_account_type);
  const bankInfoLines = normalizeLines(payload.bank_information_lines);
  const companyInfoLines = normalizeLines(payload.company_information_lines);
  const isActiveFlag = payload.is_active ?? currentIsActive ?? true;

  if (!buildiumId || !Number.isFinite(buildiumId)) {
    return {
      success: false,
      status: 400,
      error: 'Bank account is not linked to Buildium',
    };
  }

  // 1) Update the local record first so we persist user intent even if Buildium fails.
  const localNow = new Date().toISOString();
  const localDbPayload: GlAccountUpdate = {
    name: payload.name,
    description: payload.description ?? null,
    bank_account_type: normalizedType as BankAccountTypeEnum | null,
    bank_account_number: payload.account_number,
    bank_routing_number: payload.routing_number,
    bank_country: normalizedCountry ?? null,
    bank_check_printing_info: null as Json | null,
    bank_last_source: 'local' as const,
    bank_last_source_ts: localNow,
    is_active: isActiveFlag,
    is_bank_account: true,
    updated_at: localNow,
  };

  const { data: preUpdated, error: preUpdateErr } = await supabase
    .from('gl_accounts')
    .update(localDbPayload)
    .eq('id', glAccountId)
    .eq('org_id', orgId)
    .eq('is_bank_account', true)
    .select('id')
    .maybeSingle();

  if (preUpdateErr || !preUpdated) {
    return {
      success: false,
      status: 500,
      error: 'Failed to update bank account locally',
      details: String(preUpdateErr?.message || 'Update returned no record'),
    };
  }

  // 2) Push the change to Buildium.
  const checkPrintingInfoPayload = buildRequiredCheckPrintingInfo(
    existingCheckPrintingInfo,
    bankInfoLines,
    companyInfoLines,
  );
  localDbPayload.bank_check_printing_info = checkPrintingInfoPayload;

  const buildiumBody: BuildiumBankAccountPayload = mapBankAccountToBuildium({
    name: payload.name,
    description: payload.description ?? '',
    bank_account_type: normalizedType,
    bank_account_number: payload.account_number,
    bank_routing_number: payload.routing_number,
    country: normalizedCountry ?? undefined,
    is_active: isActiveFlag,
  });

  buildiumBody.CheckPrintingInfo = checkPrintingInfoPayload;

  const buildiumRes = await buildiumFetch(
    'PUT',
    `/bankaccounts/${buildiumId}`,
    undefined,
    buildiumBody,
    orgId,
  );

  if (!buildiumRes.ok) {
    const details =
      typeof buildiumRes.json === 'string'
        ? buildiumRes.json
        : buildiumRes.errorText || JSON.stringify(buildiumRes.json || {});
    return {
      success: false,
      status: buildiumRes.status || 502,
      error: 'Failed to update bank account in Buildium',
      details,
    };
  }

  const buildiumAccount = (buildiumRes.json ?? {}) as BuildiumBankAccountResponse;
  const normalizedBuildiumId = coerceNumber(
    buildiumAccount?.Id ?? buildiumAccount?.BankAccountId ?? buildiumId,
  );
  if (!normalizedBuildiumId) {
    return {
      success: false,
      status: 502,
      error: 'Invalid Buildium response (missing bank account id)',
    };
  }

  const rawBuildiumType = buildiumAccount?.BankAccountType;
  const mappedBuildiumType =
    rawBuildiumType === 'Checking' ||
    rawBuildiumType === 'Savings' ||
    rawBuildiumType === 'MoneyMarket' ||
    rawBuildiumType === 'CertificateOfDeposit'
      ? mapBankAccountTypeFromBuildium(rawBuildiumType)
      : null;
  const bankAccountType = normalizeBankAccountType(mappedBuildiumType ?? normalizedType);
  const accountNumber =
    buildiumAccount?.AccountNumberUnmasked ??
    buildiumAccount?.AccountNumber ??
    payload.account_number;
  const routingNumber = buildiumAccount?.RoutingNumber ?? payload.routing_number;
  const balance = typeof buildiumAccount?.Balance === 'number' ? buildiumAccount.Balance : null;
  const country =
    mapCountryFromBuildium(buildiumAccount?.Country) ??
    (normalizedCountry as Database['public']['Enums']['countries'] | null);
  const gl = buildiumAccount?.GLAccount ?? null;
  const now = new Date().toISOString();

  const dbPayload: GlAccountUpdate = {
    buildium_gl_account_id: normalizedBuildiumId,
    name: buildiumAccount?.Name ?? payload.name,
    description: buildiumAccount?.Description ?? payload.description ?? null,
    type: gl?.Type ?? 'Asset',
    sub_type: gl?.SubType ?? null,
    is_default_gl_account: gl?.IsDefaultGLAccount ?? false,
    default_account_name: gl?.DefaultAccountName ?? null,
    is_contra_account: gl?.IsContraAccount ?? false,
    is_bank_account: true,
    is_credit_card_account: gl?.IsCreditCardAccount ?? false,
    buildium_parent_gl_account_id: gl?.ParentGLAccountId ?? null,
    cash_flow_classification: gl?.CashFlowClassification ?? null,
    exclude_from_cash_balances:
      buildiumAccount?.ExcludeFromCashBalances ?? gl?.ExcludeFromCashBalances ?? false,
    bank_account_type: bankAccountType as BankAccountTypeEnum | null,
    bank_account_number: accountNumber,
    bank_routing_number: routingNumber,
    bank_country: country ?? null,
    bank_check_printing_info:
      buildiumAccount?.CheckPrintingInfo ?? checkPrintingInfoPayload ?? null,
    bank_electronic_payments: buildiumAccount?.ElectronicPayments ?? null,
    bank_buildium_balance: balance,
    bank_balance: balance,
    bank_last_source: 'buildium' as const,
    bank_last_source_ts: now,
    is_active:
      typeof buildiumAccount?.IsActive === 'boolean' ? buildiumAccount.IsActive : isActiveFlag,
    org_id: orgId,
    updated_at: now,
  };

  const { data: updated, error: updateErr } = await supabase
    .from('gl_accounts')
    .update(dbPayload)
    .eq('id', glAccountId)
    .eq('org_id', orgId)
    .eq('is_bank_account', true)
    .select(
      'id, name, description, bank_account_type, bank_account_number, bank_routing_number, bank_country, is_active, buildium_gl_account_id',
    )
    .maybeSingle();

  if (updateErr || !updated) {
    const msg = String(updateErr?.message || '');
    return {
      success: false,
      status: 500,
      error: 'Failed to persist bank account',
      details: msg || 'Update returned no record',
    };
  }

  return { success: true, record: updated as BankAccountRow, buildium: buildiumAccount };
}
