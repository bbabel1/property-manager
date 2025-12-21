import { NextRequest, NextResponse } from 'next/server';
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client';
import { requireRole } from '@/lib/auth/guards';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';
import { logger } from '@/lib/logger';
import { COUNTRIES } from '@/lib/constants/countries';

type LooseRecord = Record<string, unknown>;

const ACCOUNTING_BASIS = new Set(['Accrual', 'Cash']);
const TRUST_ACCOUNT_WARNINGS = new Set(['Off', 'ByProperty', 'ByRentalOwner']);
const COUNTRY_OPTIONS = new Set(COUNTRIES);

const ORGANIZATION_COLUMNS = [
  'id',
  'public_id',
  'name',
  'company_name',
  'slug',
  'url',
  'contact_first_name',
  'contact_last_name',
  'contact_phone_number',
  'contact_address_line1',
  'contact_address_line2',
  'contact_address_line3',
  'contact_city',
  'contact_state',
  'contact_postal_code',
  'contact_country',
  'accounting_book_id',
  'default_bank_account_id',
  'default_accounting_basis',
  'trust_account_warning',
  'fiscal_year_end_month',
  'fiscal_year_end_day',
  'buildium_org_id',
  'created_at',
  'updated_at',
].join(', ');

const safeTrim = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const parseInteger = (value: unknown): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.trunc(num);
};

const mapResponse = (row: LooseRecord) => {
  const addressPresent =
    row.contact_address_line1 ||
    row.contact_address_line2 ||
    row.contact_address_line3 ||
    row.contact_city ||
    row.contact_state ||
    row.contact_postal_code ||
    row.contact_country;

  const contactPresent =
    row.contact_first_name || row.contact_last_name || addressPresent || row.contact_phone_number;

  const accountingPresent =
    row.accounting_book_id !== null ||
    row.default_bank_account_id !== null ||
    row.default_accounting_basis ||
    row.trust_account_warning ||
    row.fiscal_year_end_month !== null ||
    row.fiscal_year_end_day !== null;

  return {
    Id: (row.public_id as number) ?? null,
    CompanyName: (row.company_name as string | null) ?? (row.name as string | null) ?? null,
    Url: (row.url as string | null) ?? null,
    Contact: contactPresent
      ? {
          FirstName: (row.contact_first_name as string | null) ?? null,
          LastName: (row.contact_last_name as string | null) ?? null,
          Address: addressPresent
            ? {
                AddressLine1: (row.contact_address_line1 as string | null) ?? null,
                AddressLine2: (row.contact_address_line2 as string | null) ?? null,
                AddressLine3: (row.contact_address_line3 as string | null) ?? null,
                City: (row.contact_city as string | null) ?? null,
                State: (row.contact_state as string | null) ?? null,
                PostalCode: (row.contact_postal_code as string | null) ?? null,
                Country: (row.contact_country as string | null) ?? null,
              }
            : null,
          PhoneNumber: (row.contact_phone_number as string | null) ?? null,
        }
      : null,
    AccountingSettings: accountingPresent
      ? {
          AccountingBookId: (row.accounting_book_id as number | null) ?? null,
          DefaultBankAccountId: (row.default_bank_account_id as number | null) ?? null,
          DefaultAccountingBasis: (row.default_accounting_basis as string | null) ?? null,
          TrustAccountWarning: (row.trust_account_warning as string | null) ?? null,
          FiscalYearEndMonth: (row.fiscal_year_end_month as number | null) ?? null,
          FiscalYearEndDay: (row.fiscal_year_end_day as number | null) ?? null,
        }
      : null,
  };
};

const parsePayload = (body: LooseRecord) => {
  const updates: LooseRecord = {};

  const hasCompanyName = Object.prototype.hasOwnProperty.call(body, 'CompanyName');
  const companyName = safeTrim(body.CompanyName);
  if (!hasCompanyName || !companyName) {
    return { error: 'CompanyName is required' };
  }
  updates.company_name = companyName;
  updates.name = companyName;

  if (Object.prototype.hasOwnProperty.call(body, 'Url')) {
    updates.url = safeTrim(body.Url);
  }

  if (Object.prototype.hasOwnProperty.call(body, 'Contact')) {
    const contact = body.Contact as LooseRecord | null;
    if (contact === null) {
      updates.contact_first_name = null;
      updates.contact_last_name = null;
      updates.contact_phone_number = null;
      updates.contact_address_line1 = null;
      updates.contact_address_line2 = null;
      updates.contact_address_line3 = null;
      updates.contact_city = null;
      updates.contact_state = null;
      updates.contact_postal_code = null;
      updates.contact_country = null;
    } else if (typeof contact === 'object') {
      if (Object.prototype.hasOwnProperty.call(contact, 'FirstName')) {
        updates.contact_first_name = safeTrim(contact.FirstName);
      }
      if (Object.prototype.hasOwnProperty.call(contact, 'LastName')) {
        updates.contact_last_name = safeTrim(contact.LastName);
      }
      if (Object.prototype.hasOwnProperty.call(contact, 'PhoneNumber')) {
        updates.contact_phone_number = safeTrim(contact.PhoneNumber);
      }

      if (Object.prototype.hasOwnProperty.call(contact, 'Address')) {
        const address = contact.Address as LooseRecord | null;
        if (address === null) {
          updates.contact_address_line1 = null;
          updates.contact_address_line2 = null;
          updates.contact_address_line3 = null;
          updates.contact_city = null;
          updates.contact_state = null;
          updates.contact_postal_code = null;
          updates.contact_country = null;
        } else if (typeof address === 'object') {
          if (Object.prototype.hasOwnProperty.call(address, 'AddressLine1')) {
            updates.contact_address_line1 = safeTrim(address.AddressLine1);
          }
          if (Object.prototype.hasOwnProperty.call(address, 'AddressLine2')) {
            updates.contact_address_line2 = safeTrim(address.AddressLine2);
          }
          if (Object.prototype.hasOwnProperty.call(address, 'AddressLine3')) {
            updates.contact_address_line3 = safeTrim(address.AddressLine3);
          }
          if (Object.prototype.hasOwnProperty.call(address, 'City')) {
            updates.contact_city = safeTrim(address.City);
          }
          if (Object.prototype.hasOwnProperty.call(address, 'State')) {
            updates.contact_state = safeTrim(address.State);
          }
          if (Object.prototype.hasOwnProperty.call(address, 'PostalCode')) {
            updates.contact_postal_code = safeTrim(address.PostalCode);
          }
          if (Object.prototype.hasOwnProperty.call(address, 'Country')) {
            const country = safeTrim(address.Country);
            if (country && !COUNTRY_OPTIONS.has(country as (typeof COUNTRIES)[number])) {
              return { error: `Country "${country}" is not supported` };
            }
            updates.contact_country = country;
          }
        }
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(body, 'AccountingSettings')) {
    const settings = body.AccountingSettings as LooseRecord | null;
    if (settings === null) {
      updates.accounting_book_id = null;
      updates.default_bank_account_id = null;
      updates.default_accounting_basis = 'Accrual';
      updates.trust_account_warning = 'Off';
      updates.fiscal_year_end_month = null;
      updates.fiscal_year_end_day = null;
    } else if (typeof settings === 'object') {
      if (Object.prototype.hasOwnProperty.call(settings, 'AccountingBookId')) {
        updates.accounting_book_id = parseInteger(settings.AccountingBookId);
      }
      if (Object.prototype.hasOwnProperty.call(settings, 'DefaultBankAccountId')) {
        updates.default_bank_account_id = parseInteger(settings.DefaultBankAccountId);
      }
      if (Object.prototype.hasOwnProperty.call(settings, 'DefaultAccountingBasis')) {
        const basis = safeTrim(settings.DefaultAccountingBasis);
        if (basis && !ACCOUNTING_BASIS.has(basis)) {
          return { error: 'DefaultAccountingBasis must be Accrual or Cash' };
        }
        updates.default_accounting_basis = basis ?? 'Accrual';
      }
      if (Object.prototype.hasOwnProperty.call(settings, 'TrustAccountWarning')) {
        const trustWarning = safeTrim(settings.TrustAccountWarning);
        if (trustWarning && !TRUST_ACCOUNT_WARNINGS.has(trustWarning)) {
          return { error: 'TrustAccountWarning must be Off, ByProperty, or ByRentalOwner' };
        }
        updates.trust_account_warning = trustWarning ?? 'Off';
      }
      if (Object.prototype.hasOwnProperty.call(settings, 'FiscalYearEndMonth')) {
        const month = parseInteger(settings.FiscalYearEndMonth);
        if (month === 0 || month === null) {
          updates.fiscal_year_end_month = null;
        } else if (month < 1 || month > 12) {
          return { error: 'FiscalYearEndMonth must be between 1 and 12' };
        } else {
          updates.fiscal_year_end_month = month;
        }
      }
      if (Object.prototype.hasOwnProperty.call(settings, 'FiscalYearEndDay')) {
        const day = parseInteger(settings.FiscalYearEndDay);
        if (day === 0 || day === null) {
          updates.fiscal_year_end_day = null;
        } else if (day < 1 || day > 31) {
          return { error: 'FiscalYearEndDay must be between 1 and 31' };
        } else {
          updates.fiscal_year_end_day = day;
        }
      }
    }
  }

  return { updates };
};

const handleError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'UNAUTHENTICATED')
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  if (message === 'FORBIDDEN' || message === 'ORG_FORBIDDEN') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  if (message === 'ORG_CONTEXT_REQUIRED') {
    return NextResponse.json({ error: 'ORG_CONTEXT_REQUIRED' }, { status: 400 });
  }
  logger.error({ error }, 'Unexpected error in /api/organization');
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
};

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireRole(['org_admin', 'org_manager']);
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id);
    const supabaseAdmin = requireSupabaseAdmin('load organization');

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select(ORGANIZATION_COLUMNS)
      .eq('id', orgId)
      .maybeSingle();

    if (error) {
      logger.error({ error, orgId }, 'Failed to load organization');
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    return NextResponse.json({ organization: mapResponse(data as unknown as LooseRecord) });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireRole(['org_admin', 'org_manager']);
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
    }

    const body = (await request.json().catch(() => null)) as LooseRecord | null;
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const parsed = parsePayload(body);
    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const orgId = await resolveOrgIdFromRequest(request, user.id);
    const supabaseAdmin = requireSupabaseAdmin('update organization');

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .update(parsed.updates)
      .eq('id', orgId)
      .select(ORGANIZATION_COLUMNS)
      .maybeSingle();

    if (error) {
      logger.error({ error, orgId, updates: parsed.updates }, 'Failed to update organization');
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    return NextResponse.json({ organization: mapResponse(data as unknown as LooseRecord) });
  } catch (error) {
    return handleError(error);
  }
}
