import { unstable_cache } from 'next/cache';
import { supabase, supabaseAdmin } from '@/lib/db';
import type { LeaseAccountOption, LeaseTenantOption } from '@/components/leases/types';

type LeaseRow = {
  id: string | number;
  org_id: string | number | null;
  property_id: string | number | null;
  unit_id: string | number | null;
};

type PropertyRow = {
  id: string | number;
  name: string | null;
  address_line1: string | null;
};

type UnitRow = {
  id: string | number;
  unit_number: string | null;
  unit_name: string | null;
};

type LeaseTenantRow = {
  tenant_id: string | number | null;
  tenants?: {
    id?: string | number | null;
    buildium_tenant_id?: number | null;
    contacts?: {
      display_name?: string | null;
      first_name?: string | null;
      last_name?: string | null;
      company_name?: string | null;
    } | null;
  } | null;
};

export type PaymentFormPrefill = {
  leaseId: string;
  orgId: string | null;
  accountOptions: LeaseAccountOption[];
  tenantOptions: LeaseTenantOption[];
  leaseSummary: {
    propertyUnit?: string | null;
    tenants?: string | null;
  };
  prefill?: {
    tenantId?: string | null;
    accountId?: string | null;
    amount?: number | null;
    memo?: string | null;
    date?: string | null;
  };
};

export type PaymentFormPrefillResult =
  | { ok: true; data: PaymentFormPrefill }
  | { ok: false; error: string };

const normalizeDate = (value: string | null | undefined) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

export function sanitizePaymentPrefillParams(
  params: Record<string, string | string[] | undefined>,
  allowed: { accountIds: Set<string>; tenantIds: Set<string> },
) {
  const pick = (key: string) => {
    const raw = params?.[key];
    if (Array.isArray(raw)) return raw[0];
    return raw;
  };

  const tenant = pick('tenant');
  const account = pick('account');
  const amountRaw = pick('amount');
  const memoRaw = pick('memo');
  const dateRaw = pick('date');

  const tenantId = tenant && allowed.tenantIds.has(String(tenant)) ? String(tenant) : null;
  const accountId = account && allowed.accountIds.has(String(account)) ? String(account) : null;

  const amountNum = typeof amountRaw === 'string' ? Number(amountRaw) : NaN;
  const amount = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : null;

  const memo =
    typeof memoRaw === 'string' && memoRaw.trim().length > 0 && memoRaw.trim().length <= 2000
      ? memoRaw.trim()
      : null;
  const date = normalizeDate(dateRaw);

  return { tenantId, accountId, amount, memo, date };
}

const formatTenantNames = (rows: LeaseTenantRow[]): string | null => {
  const names: string[] = [];
  rows.forEach((row) => {
    const contact = row.tenants?.contacts;
    const display =
      contact?.display_name ||
      [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim() ||
      contact?.company_name ||
      null;
    if (display) names.push(display);
  });
  return names.length ? names.join(', ') : null;
};

async function loadPaymentFormDataInternal(
  leaseIdInput: string | number,
  options?: { searchParams?: Record<string, string | string[] | undefined> },
): Promise<PaymentFormPrefillResult> {
  const leaseIdNum = Number(leaseIdInput);
  if (!Number.isFinite(leaseIdNum)) {
    return { ok: false, error: 'Invalid lease id' };
  }

  const db = supabaseAdmin || supabase;
  if (!db) {
    return { ok: false, error: 'Database unavailable' };
  }
  const dbClient = db as any;

  try {
    // Try to pull lease, property, unit, and contacts in a single query. If the join fails (RLS/FK issues), fall back to minimal lease fetch.
    let leaseRow: (LeaseRow & { property?: PropertyRow | null; unit?: UnitRow | null; lease_contacts?: LeaseTenantRow[] }) | null =
      null;
    const { data: leaseWithRelations, error: leaseWithRelationsError } = (await dbClient
      .from('lease')
      .select(
        `
        id,
        org_id,
        property_id,
        unit_id,
        property:properties!fk_lease_property_id ( id, name, address_line1 ),
        unit:units!fk_lease_unit_id ( id, unit_number, unit_name ),
        lease_contacts:lease_contacts (
          tenant_id,
          tenants:tenants(
            id,
            buildium_tenant_id,
            contacts:contacts!tenants_contact_id_fkey(display_name, first_name, last_name, company_name)
          )
        )
      `,
      )
      .eq('id', leaseIdNum)
      .maybeSingle()) as { data: (LeaseRow & { property?: PropertyRow | null; unit?: UnitRow | null; lease_contacts?: LeaseTenantRow[] }) | null; error: unknown };

    if (!leaseWithRelationsError && leaseWithRelations) {
      leaseRow = leaseWithRelations;
    } else {
      if (leaseWithRelationsError) {
        console.warn(
          'loadPaymentFormData: lease query with relations failed, retrying with minimal select',
          leaseWithRelationsError,
        );
      }
      const { data: leaseBasic, error: leaseError } = (await dbClient
        .from('lease')
        .select('id, org_id, property_id, unit_id')
        .eq('id', leaseIdNum)
        .maybeSingle()) as { data: LeaseRow | null; error: unknown };
      if (leaseError) throw leaseError;
      leaseRow = leaseBasic;
    }

    if (!leaseRow) return { ok: false, error: 'Lease not found' };

    const orgId = leaseRow.org_id ? String(leaseRow.org_id) : null;

    let property = (leaseRow as any)?.property ?? null;
    let unit = (leaseRow as any)?.unit ?? null;
    let tenants = (leaseRow as any)?.lease_contacts ?? null;

    // Backfill property/unit if the initial join was skipped or failed.
    if (!property && leaseRow.property_id != null) {
      const { data: propertyRow, error: propertyError } = (await dbClient
        .from('properties')
        .select('id, name, address_line1')
        .eq('id', leaseRow.property_id)
        .maybeSingle()) as { data: PropertyRow | null; error: unknown };
      if (!propertyError) property = propertyRow;
      else console.warn('loadPaymentFormData: property fetch failed', propertyError);
    }
    if (!unit && leaseRow.unit_id != null) {
      const { data: unitRow, error: unitError } = (await dbClient
        .from('units')
        .select('id, unit_number, unit_name')
        .eq('id', leaseRow.unit_id)
        .maybeSingle()) as { data: UnitRow | null; error: unknown };
      if (!unitError) unit = unitRow;
      else console.warn('loadPaymentFormData: unit fetch failed', unitError);
    }

    // If the embedded lease_contacts failed, fetch tenants separately with a simple join. Retry without the contact join if needed.
    if (!Array.isArray(tenants)) {
      try {
        const { data: tenantData, error: tenantError } = (await dbClient
          .from('lease_contacts')
          .select(
            'tenant_id, tenants:tenants(id, buildium_tenant_id, contacts:contacts!tenants_contact_id_fkey(display_name, first_name, last_name, company_name))',
          )
          .eq('lease_id', leaseRow.id)
          .limit(50)) as { data: LeaseTenantRow[] | null; error: unknown };

        if (tenantError) {
          console.warn(
            'loadPaymentFormData: lease_contacts fetch failed, retrying without contact join',
            tenantError,
          );
          const { data: fallbackTenants } = (await dbClient
            .from('lease_contacts')
            .select('tenant_id, tenants:tenants(id, buildium_tenant_id)')
            .eq('lease_id', leaseRow.id)
            .limit(50)) as { data: LeaseTenantRow[] | null; error: unknown };
          tenants = Array.isArray(fallbackTenants) ? fallbackTenants : [];
        } else {
          tenants = Array.isArray(tenantData) ? tenantData : [];
        }
      } catch (tenantError) {
        console.error('loadPaymentFormData: unexpected tenant fetch error', tenantError);
        tenants = [];
      }
    }

    let propertyUnit: string | null = null;
    if (property || unit) {
      const propertyName = property?.name || property?.address_line1 || null;
      const unitLabel = unit?.unit_number || unit?.unit_name || null;
      propertyUnit = [propertyName, unitLabel].filter(Boolean).join(' - ') || propertyName || unitLabel || null;
    }

    const tenantOptions: LeaseTenantOption[] = [];
    const tenantIds = new Set<string>();
    const tenantList: LeaseTenantRow[] = Array.isArray(tenants) ? (tenants as LeaseTenantRow[]) : [];
    tenantList.forEach((row) => {
      const contact = row.tenants?.contacts;
      const buildiumTenantId =
        typeof row.tenants?.buildium_tenant_id === 'number'
          ? row.tenants.buildium_tenant_id
          : null;
      const id = row?.tenant_id ?? row?.tenants?.id ?? buildiumTenantId;
      if (id == null) return;
      tenantIds.add(String(id));
      const display =
        contact?.display_name ||
        [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim() ||
        contact?.company_name ||
        'Tenant';
      tenantOptions.push({ id: String(id), name: display, buildiumTenantId });
    });

    const tenantNames = formatTenantNames(tenantList);

    const accountOptions: LeaseAccountOption[] = [];
    const accountMap = new Map<string, LeaseAccountOption>();
    if (orgId) {
      const { data: accountsData, error: accountsError } = (await dbClient
        .from('gl_accounts')
        .select('id, name, type, buildium_gl_account_id')
        .eq('org_id', orgId)
        .order('name', { ascending: true })) as { data: any[] | null; error: unknown };
      if (accountsError) throw accountsError;

      (accountsData || []).forEach((row: any) => {
        if (!row?.id) return;
        const buildiumIdRaw = row.buildium_gl_account_id;
        const buildiumId =
          typeof buildiumIdRaw === 'number'
            ? buildiumIdRaw
            : buildiumIdRaw != null && !Number.isNaN(Number(buildiumIdRaw))
              ? Number(buildiumIdRaw)
              : null;
        if (buildiumId == null) return;
        const option = {
          id: String(row.id),
          name: row.name || 'Account',
          type: row.type || null,
          buildiumGlAccountId: buildiumId,
        };
        accountOptions.push(option);
        accountMap.set(option.id, option);
      });
    }
    const pickBestLine = (
      lines: Array<{ gl_account_id?: string | null; amount?: number | null }> | undefined | null,
    ) => {
      if (!lines || !lines.length) return null;
      const valid = lines
        .map((line) => {
          const glId = line?.gl_account_id;
          if (!glId) return null;
          const amt = Number(line?.amount ?? 0);
          if (!Number.isFinite(amt) || amt === 0) return null;
          const acct = accountMap.get(glId);
          const acctType = (acct?.type || '').toLowerCase();
          const acctName = (acct?.name || '').toLowerCase();
          const isLiability = acctType.includes('liability') || acctName.includes('liability');
          const isAsset = acctType.includes('asset');
          const isIncome = acctType.includes('income') || acctType.includes('revenue');
          const isPayable = acctType.includes('payable') || acctName.includes('payable');
          // Priority: liability > asset > income > other > payable; unknown type falls into "other"
          const priority = isPayable ? 0 : isLiability ? 5 : isAsset ? 4 : isIncome ? 3 : 2;
          const magnitude = Math.abs(amt);
          return { glId, amount: amt, priority, magnitude, isPayable, name: acct?.name ?? '' };
        })
        .filter(Boolean) as Array<{ glId: string; amount: number; priority: number; magnitude: number; isPayable: boolean; name: string }>;

      if (!valid.length) return null;

      valid.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.magnitude - a.magnitude;
      });
      const chosen = valid[0];
      return chosen;
    };

    // Guard autoprefill: only suggest account/amount if the latest transaction is a charge.
    let latestTransactionType: string | null = null;
    try {
      const { data: latestTx } = (await dbClient
        .from('transactions')
        .select('transaction_type, date, id')
        .eq('lease_id', leaseRow.id)
        .order('date', { ascending: false })
        .order('id', { ascending: false })
        .limit(1)) as { data: Array<{ transaction_type?: string | null }> | null };

      const latest = Array.isArray(latestTx) ? latestTx[0] : null;
      if (latest?.transaction_type) latestTransactionType = String(latest.transaction_type);
    } catch (latestTxError) {
      console.warn('loadPaymentFormData: failed to fetch latest transaction', latestTxError);
    }

    // Look up the most recent outstanding charge to prefill account/amount.
    let suggestedAccountId: string | null = null;
    let suggestedAmount: number | null = null;
    if (orgId) {
      try {
        const { data: latestCharges } = (await dbClient
          .from('charges')
          .select(
            `
            id,
            amount,
            amount_open,
            due_date,
            status,
            transaction:transactions!charges_transaction_id_fkey (
              transaction_lines!inner ( gl_account_id, amount )
            )
          `,
          )
          .eq('org_id', orgId)
          .eq('lease_id', leaseRow.id)
          .in('status', ['open', 'partial'])
          .gt('amount_open', 0)
          .order('due_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1)) as {
          data:
            | Array<{
                amount?: number | null;
                amount_open?: number | null;
                transaction?: { transaction_lines?: Array<{ gl_account_id?: string | null; amount?: number | null }> };
              }>
            | null;
          };

        const latest = Array.isArray(latestCharges) ? latestCharges[0] : null;
        if (latest) {
          const bestLine = pickBestLine(latest.transaction?.transaction_lines);
          if (bestLine?.glId) {
            suggestedAccountId = bestLine.glId;
          }
          const rawAmt = Number(latest.amount_open ?? latest.amount ?? bestLine?.amount ?? 0);
          const amt = Math.abs(rawAmt);
          suggestedAmount = Number.isFinite(amt) && amt > 0 ? amt : null;
        }
      } catch (chargeError) {
        console.warn('loadPaymentFormData: failed to fetch latest outstanding charge', chargeError);
      }

      // Fallback: use latest charge transaction directly if the charges table is empty/unavailable.
      if (!suggestedAccountId || !suggestedAmount) {
        try {
          const { data: txRows } = (await dbClient
            .from('transactions')
            .select(
              `
              id,
              date,
              transaction_type,
              total_amount,
              transaction_lines!inner ( gl_account_id, amount )
            `,
            )
            .eq('lease_id', leaseRow.id)
            .in('transaction_type', ['Charge', 'charge'])
            .gt('total_amount', 0)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(1)) as {
            data:
              | Array<{
                  total_amount?: number | null;
                  transaction_lines?: Array<{ gl_account_id?: string | null; amount?: number | null }>;
                }>
              | null;
          };

          const tx = Array.isArray(txRows) ? txRows[0] : null;
          if (tx) {
            const bestLine = pickBestLine(tx.transaction_lines);
            if (!suggestedAccountId && bestLine?.glId) {
              suggestedAccountId = bestLine.glId;
            }
            if (!suggestedAmount) {
              const lineAmount = Math.abs(Number(bestLine?.amount ?? 0));
              const total = Math.abs(Number(tx.total_amount ?? 0));
              const amt = Number.isFinite(lineAmount) && lineAmount > 0 ? lineAmount : total;
              suggestedAmount = Number.isFinite(amt) && amt > 0 ? amt : null;
            }
          }
        } catch (txError) {
          console.warn('loadPaymentFormData: failed to fetch latest charge transaction', txError);
        }
      }

      // Fallback #2: pull latest charge line directly from transaction_lines when prior lookups miss.
      if (!suggestedAccountId || !suggestedAmount) {
        try {
          const { data: lineRows } = (await dbClient
            .from('transaction_lines')
            .select(
              `
              gl_account_id,
              amount,
              date,
              transaction:transactions!inner(lease_id, transaction_type, total_amount)
            `,
            )
            .eq('transaction.lease_id', leaseRow.id)
            .not('gl_account_id', 'is', null)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(20)) as {
            data: Array<{ gl_account_id?: string | null; amount?: number | null; transaction?: { transaction_type?: string | null } }> | null;
          };

          // Backfill any GL accounts not already in accountMap so we can score them accurately.
          if (Array.isArray(lineRows)) {
            const missingGlIds = Array.from(
              new Set(
                lineRows
                  .map((l) => l.gl_account_id)
                  .filter((id): id is string => Boolean(id) && !accountMap.has(id!)),
              ),
            );
            if (missingGlIds.length) {
              try {
                const { data: missingAccounts } = (await dbClient
                  .from('gl_accounts')
                  .select('id, name, type, buildium_gl_account_id')
                  .in('id', missingGlIds)) as { data: any[] | null; error?: unknown };
                (missingAccounts || []).forEach((row: any) => {
                  if (!row?.id) return;
                  const option = {
                    id: String(row.id),
                    name: row.name || 'Account',
                    type: row.type || null,
                    buildiumGlAccountId:
                      typeof row.buildium_gl_account_id === 'number'
                        ? row.buildium_gl_account_id
                        : row.buildium_gl_account_id != null && !Number.isNaN(Number(row.buildium_gl_account_id))
                          ? Number(row.buildium_gl_account_id)
                          : null,
                  };
                  accountOptions.push(option);
                  accountMap.set(option.id, option);
                });
              } catch (missingError) {
                console.warn('loadPaymentFormData: failed to load missing gl accounts', missingError);
              }
            }
          }

          const line = Array.isArray(lineRows) ? pickBestLine(lineRows) : null;
          if (line?.glId) {
            suggestedAccountId = suggestedAccountId ?? line.glId;
          }
          if (!suggestedAmount && line) {
            const amt = Math.abs(Number(line.amount ?? 0));
            suggestedAmount = Number.isFinite(amt) && amt > 0 ? amt : null;
          }
        } catch (lineError) {
          console.warn('loadPaymentFormData: failed to fetch latest charge line', lineError);
        }
      }
    }

    // If the suggested account isn't in the dropdown (e.g., missing Buildium ID filter), attempt to load it and include it so we can prefill accurately.
    if (suggestedAccountId && !accountMap.has(suggestedAccountId)) {
      try {
        const { data: missingAccount } = (await dbClient
          .from('gl_accounts')
          .select('id, name, type, buildium_gl_account_id')
          .eq('id', suggestedAccountId)
          .maybeSingle()) as { data: any | null; error?: unknown };
        if (missingAccount?.id) {
          const option = {
            id: String(missingAccount.id),
            name: missingAccount.name || 'Account',
            type: missingAccount.type || null,
            buildiumGlAccountId:
              typeof missingAccount.buildium_gl_account_id === 'number'
                ? missingAccount.buildium_gl_account_id
                : missingAccount.buildium_gl_account_id != null && !Number.isNaN(Number(missingAccount.buildium_gl_account_id))
                  ? Number(missingAccount.buildium_gl_account_id)
                  : null,
          };
          accountOptions.push(option);
          accountMap.set(option.id, option);
        }
      } catch (missingAccountError) {
        console.warn('loadPaymentFormData: failed to load missing suggested account', missingAccountError);
      }
    }

    const latestIsCharge =
      latestTransactionType &&
      latestTransactionType.trim().toLowerCase() === 'charge';
    const allowSuggestedPrefill = !latestTransactionType || latestIsCharge;
    if (!allowSuggestedPrefill) {
      suggestedAccountId = null;
      suggestedAmount = null;
    }

    const prefill =
      options?.searchParams && accountOptions.length
        ? sanitizePaymentPrefillParams(options.searchParams, {
            accountIds: new Set(accountOptions.map((a) => a.id)),
            tenantIds,
          })
        : undefined;
    const autoprefill =
      suggestedAccountId || suggestedAmount || prefill
        ? {
            ...(prefill ?? {}),
            accountId:
              (suggestedAccountId && accountOptions.some((a) => a.id === suggestedAccountId)
                ? suggestedAccountId
                : undefined) ??
              (prefill && prefill.accountId ? prefill.accountId : undefined),
            amount:
              (suggestedAmount && suggestedAmount !== 0 ? suggestedAmount : null) ??
              (prefill && prefill.amount && prefill.amount !== 0 ? prefill.amount : null) ??
              undefined,
          }
        : prefill;
    return {
      ok: true,
      data: {
        leaseId: String(leaseRow.id),
        orgId,
        accountOptions,
        tenantOptions,
        leaseSummary: { propertyUnit, tenants: tenantNames },
        prefill: autoprefill,
      },
    };
  } catch (error) {
    console.error(
      'Failed to load payment form data',
      error instanceof Error ? { message: error.message, stack: error.stack } : error,
    );
    return { ok: false, error: 'Unable to load payment form data.' };
  }
}

const loadPaymentFormDataCached = unstable_cache(
  async (leaseId: string | number) => loadPaymentFormDataInternal(leaseId, {}),
  ['payment-form-data'],
  { revalidate: 30 },
);

export async function warmPaymentFormCache(leaseIdInput: string | number) {
  try {
    await loadPaymentFormDataCached(leaseIdInput);
  } catch {
    // Best-effort cache warm; ignore failures (and environments without incremental cache)
  }
}

export async function loadPaymentFormData(
  leaseIdInput: string | number,
  options?: { searchParams?: Record<string, string | string[] | undefined>; useCache?: boolean },
): Promise<PaymentFormPrefillResult> {
  const useCache = options?.useCache === true; // default to fresh data to avoid stale autoprefill/tenant lists
  const hasPrefillParams = !!(options?.searchParams && Object.keys(options.searchParams).length);

  // If we don't need cache (or need fresh data), fall back to the uncached path.
  if (!useCache) {
    return loadPaymentFormDataInternal(leaseIdInput, options);
  }

  let base: PaymentFormPrefillResult;
  try {
    base = await loadPaymentFormDataCached(leaseIdInput);
  } catch (error) {
    // In non-Next runtimes (e.g., scripts), unstable_cache may not have incrementalCache.
    console.warn('loadPaymentFormData: falling back to uncached path', error);
    base = await loadPaymentFormDataInternal(leaseIdInput, options);
  }
  if (!base.ok) return base;

  if (!hasPrefillParams) {
    return base;
  }

  const accountIds = new Set(base.data.accountOptions.map((a) => a.id));
  const tenantIds = new Set(base.data.tenantOptions.map((t) => t.id));
  const prefill = sanitizePaymentPrefillParams(options?.searchParams ?? {}, { accountIds, tenantIds });

  return {
    ok: true,
    data: {
      ...base.data,
      prefill,
    },
  };
}
