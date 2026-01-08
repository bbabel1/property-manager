import type { LeaseAccountOption } from '@/components/leases/types';
import { loadChargeFormData } from './load-charge-form-data';

export type CreditFormPrefill = {
  leaseId: string;
  orgId: string | null;
  accountOptions: LeaseAccountOption[];
  leaseSummary: {
    propertyUnit?: string | null;
    tenants?: string | null;
  };
  prefill?: {
    accountId?: string | null;
    amount?: number | null;
    memo?: string | null;
    date?: string | null;
  };
};

export type CreditFormPrefillResult =
  | { ok: true; data: CreditFormPrefill }
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

export function sanitizeCreditPrefillParams(
  params: Record<string, string | string[] | undefined>,
  allowed: { accountIds: Set<string> },
) {
  const pick = (key: string) => {
    const raw = params?.[key];
    if (Array.isArray(raw)) return raw[0];
    return raw;
  };

  const account = pick('account');
  const amountRaw = pick('amount');
  const memoRaw = pick('memo');
  const dateRaw = pick('date');

  const accountId = account && allowed.accountIds.has(String(account)) ? String(account) : null;

  const amountNum = typeof amountRaw === 'string' ? Number(amountRaw) : NaN;
  const amount = Number.isFinite(amountNum) && amountNum > 0 ? amountNum : null;

  const memo =
    typeof memoRaw === 'string' && memoRaw.trim().length > 0 && memoRaw.trim().length <= 2000
      ? memoRaw.trim()
      : null;
  const date = normalizeDate(dateRaw);

  return { accountId, amount, memo, date };
}

export async function loadCreditFormData(
  leaseIdInput: string | number,
  options?: { searchParams?: Record<string, string | string[] | undefined> },
): Promise<CreditFormPrefillResult> {
  const leaseIdNum = Number(leaseIdInput);
  if (!Number.isFinite(leaseIdNum)) {
    return { ok: false, error: 'Invalid lease id' };
  }

  try {
    const base = await loadChargeFormData(leaseIdNum);
    if (!base.ok) return base;

    const accountIds = new Set(base.data.accountOptions.map((a) => a.id));
    const prefill =
      options?.searchParams && base.data.accountOptions.length
        ? sanitizeCreditPrefillParams(options.searchParams, { accountIds })
        : undefined;

    return {
      ok: true,
      data: {
        leaseId: base.data.leaseId,
        orgId: base.data.orgId ?? null,
        accountOptions: base.data.accountOptions,
        leaseSummary: base.data.leaseSummary,
        prefill,
      },
    };
  } catch (error) {
    console.error('Failed to load credit form data', error);
    return { ok: false, error: 'Unable to load credit form data.' };
  }
}
