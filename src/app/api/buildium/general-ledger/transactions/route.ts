import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { buildiumFetch } from '@/lib/buildium-http';
import { supabaseAdmin } from '@/lib/db';
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard';
import { upsertGLEntryWithLines } from '@/lib/buildium-mappers';
import type { Database } from '@/types/database';
import type { AppRole } from '@/lib/auth/roles';

type GlAccountRow = Database['public']['Tables']['gl_accounts']['Row'];
type PropertyRow = {
  id: string;
  buildium_property_id: number | null;
  org_id: string | null;
  rental_type?: string | null;
};

type LocalTransactionRow = {
  id: string;
  buildium_transaction_id: number | null;
  date: string | null;
  total_amount: number | null;
  transaction_type: string | null;
  memo: string | null;
  check_number: string | null;
  transaction_lines?: {
    amount: number | null;
    posting_type: string;
    is_cash_posting?: boolean | null;
    gl_accounts?: { buildium_gl_account_id?: number | null; is_bank_account?: boolean | null } | null;
  }[];
};

type BuildiumLine = {
  glAccountId: number | null;
  postingType: 'Credit' | 'Debit' | null;
  amount: number;
};

type NormalizedBuildiumTransaction = {
  buildiumId: number;
  date: string | null;
  transactionType: string | null;
  totalAmount: number;
  memo: string | null;
  checkNumber: string | null;
  lastUpdated: string | null;
  lines: BuildiumLine[];
  payload: Record<string, unknown>;
};

type PreviewTransaction = {
  buildiumId: number;
  buildiumDate: string | null;
  totalAmount: number;
  transactionType: string | null;
  memo: string | null;
  checkNumber: string | null;
  lastUpdated: string | null;
  status: 'matched' | 'mismatch' | 'missing';
  mismatches: string[];
  localTransactionId: string | null;
  buildiumPayload: Record<string, unknown>;
};

type PaginationMeta = {
  page?: number;
  totalPages?: number;
  totalItems?: number;
  limit?: number;
  offset?: number;
};

const ADMIN_ROLES: AppRole[] = ['platform_admin', 'org_admin'];
const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const normalizePostingType = (input: unknown): 'Credit' | 'Debit' | null => {
  if (typeof input === 'string') {
    const v = input.toLowerCase();
    if (v === 'credit') return 'Credit';
    if (v === 'debit') return 'Debit';
  }
  return null;
};

const normalizeDate = (input: unknown): string | null => {
  if (typeof input === 'string' && input.trim()) return input.slice(0, 10);
  return null;
};

const extractTransactions = (json: unknown): unknown[] => {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>;
    const candidates = [
      obj.data,
      obj.Data,
      obj.items,
      obj.Items,
      obj.results,
      obj.Results,
      obj.transactions,
      obj.Transactions,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return [];
};

const extractPagination = (json: unknown, limit?: number, offset?: number): PaginationMeta => {
  if (!json || typeof json !== 'object') return { limit, offset };
  const obj = json as Record<string, unknown>;
  const page = toNumber(obj.Page ?? obj.page ?? obj.currentPage ?? obj.CurrentPage);
  const totalPages = toNumber(obj.TotalPages ?? obj.totalPages ?? obj.pages ?? obj.Pages);
  const totalItems = toNumber(
    obj.TotalResults ?? obj.totalResults ?? obj.TotalCount ?? obj.totalCount ?? obj.Count ?? obj.count,
  );
  return { page: page ?? undefined, totalPages: totalPages ?? undefined, totalItems: totalItems ?? undefined, limit, offset };
};

const normalizeLine = (line: Record<string, unknown>): BuildiumLine => {
  const glAccountId =
    toNumber(line?.GLAccountId) ??
    toNumber((line?.GLAccount as { Id?: unknown } | undefined | null)?.Id) ??
    null;
  const amount = Math.abs(Number(line?.Amount ?? 0));
  return {
    glAccountId,
    postingType: normalizePostingType(line?.PostingType),
    amount: Number.isFinite(amount) ? amount : 0,
  };
};

const normalizeBuildiumTransaction = (raw: unknown): NormalizedBuildiumTransaction | null => {
  if (!raw || typeof raw !== 'object') return null;
  const txn = raw as Record<string, unknown>;
  const buildiumId = toNumber(txn.Id ?? txn.id);
  if (buildiumId == null || !Number.isFinite(buildiumId)) return null;
  const linesRaw = Array.isArray(txn.Lines)
    ? (txn.Lines as Record<string, unknown>[])
    : Array.isArray((txn.Journal as { Lines?: unknown } | null | undefined)?.Lines)
      ? ((txn.Journal as { Lines?: unknown }).Lines as Record<string, unknown>[])
      : [];
  const normalizedLines = linesRaw.map(normalizeLine).filter((l) => l.amount > 0);
  const totalFromLines = normalizedLines.reduce((sum, line) => sum + line.amount, 0);
  const totalFromPayload = toNumber(txn.TotalAmount);
  const totalAmount =
    typeof totalFromPayload === 'number' && Number.isFinite(totalFromPayload)
      ? totalFromPayload
      : totalFromLines;

  return {
    buildiumId,
    date: normalizeDate(txn.Date ?? txn.TransactionDate ?? txn.PostDate),
    transactionType: typeof txn.TransactionType === 'string' ? txn.TransactionType : null,
    memo: typeof txn.Memo === 'string' ? txn.Memo : null,
    checkNumber: typeof txn.CheckNumber === 'string' ? txn.CheckNumber : null,
    lastUpdated:
      normalizeDate(txn.LastUpdatedDateTime ?? txn.LastUpdatedOn ?? txn.UpdatedDate) ??
      normalizeDate(txn.CreatedDateTime ?? txn.CreatedDate),
    totalAmount,
    lines: normalizedLines,
    payload: txn,
  };
};

const bucketLines = (lines: BuildiumLine[]) => {
  const buckets = new Map<string, number>();
  for (const line of lines) {
    const key =
      line.postingType === null
        ? `${line.glAccountId ?? 'unknown'}:*`
        : `${line.glAccountId ?? 'unknown'}:${line.postingType}`;
    buckets.set(key, (buckets.get(key) ?? 0) + (Number(line.amount) || 0));
  }
  return buckets;
};

const bucketLocalLines = (
  lines: NonNullable<LocalTransactionRow['transaction_lines']>,
  allowedKeys: Set<string>,
): Map<string, number> => {
  const buckets = new Map<string, number>();
  for (const line of lines) {
    const glBuildiumId =
      typeof line?.gl_accounts?.buildium_gl_account_id === 'number'
        ? line.gl_accounts.buildium_gl_account_id
        : null;
    const postingType = normalizePostingType(line.posting_type);
    const keyed =
      postingType === null
        ? `${glBuildiumId ?? 'unknown'}:*`
        : `${glBuildiumId ?? 'unknown'}:${postingType}`;
    if (!allowedKeys.has(keyed)) {
      // If Buildium provided a wildcard bucket for this GL, allow any posting type to match it.
      const fallbackKey = `${glBuildiumId ?? 'unknown'}:*`;
      if (!allowedKeys.has(fallbackKey)) continue;
      buckets.set(fallbackKey, (buckets.get(fallbackKey) ?? 0) + Math.abs(Number(line.amount ?? 0)));
      continue;
    }
    buckets.set(keyed, (buckets.get(keyed) ?? 0) + Math.abs(Number(line.amount ?? 0)));
  }
  return buckets;
};

function diffTransaction(
  remote: NormalizedBuildiumTransaction,
  local: LocalTransactionRow | null,
): { status: PreviewTransaction['status']; mismatches: string[]; localTransactionId: string | null } {
  if (!local) {
    return { status: 'missing', mismatches: ['Not present locally'], localTransactionId: null };
  }

  const remoteLines = bucketLines(remote.lines);
  const allowedKeys = new Set(remoteLines.keys());
  const localLines = bucketLocalLines(local.transaction_lines ?? [], allowedKeys);
  const lineKeys = new Set([...remoteLines.keys(), ...localLines.keys()]);
  const remoteLinesTotal = Array.from(remoteLines.values()).reduce((sum, v) => sum + v, 0);
  const localLinesTotal = Array.from(localLines.values()).reduce((sum, v) => sum + v, 0);

  const mismatches: string[] = [];
  const remoteDate = remote.date ?? '';
  const localDate = local.date ?? '';
  if (remoteDate && localDate && remoteDate.slice(0, 10) !== localDate.slice(0, 10)) {
    mismatches.push(`Date differs (local ${localDate} vs Buildium ${remoteDate})`);
  }

  const localHeaderTotal =
    typeof local.total_amount === 'number' && Number.isFinite(local.total_amount)
      ? local.total_amount
      : null;
  const isPayment =
    (local.transaction_type || remote.transactionType || '')
      .toString()
      .toLowerCase()
      .includes('payment');

  if (isPayment) {
    // Payments have extra balancing/visibility lines locally. Compare using cash lines only.
    const cashTotal =
      (Array.isArray(local.transaction_lines)
        ? local.transaction_lines
            .filter((l) => l?.is_cash_posting === true)
            .reduce((sum, l) => sum + Math.abs(Number(l?.amount ?? 0) || 0), 0)
        : null) ?? null;
    const fallbackTotal =
      localHeaderTotal ??
      (Array.from(localLines.values()).reduce((sum, v) => sum + v, 0) || null) ??
      0;
    const localTotal = cashTotal && cashTotal > 0 ? cashTotal : fallbackTotal;
    if (Math.abs((localTotal ?? 0) - remote.totalAmount) > 0.01) {
      mismatches.push(
        `Total amount differs (local ${localTotal ?? 'n/a'} vs Buildium ${remote.totalAmount})`,
      );
    }
    return {
      status: mismatches.length ? 'mismatch' : 'matched',
      mismatches,
      localTransactionId: local.id ?? null,
    };
  } else {
    if (Math.abs(remoteLinesTotal - localLinesTotal) > 0.01) {
      mismatches.push(
        `Total amount differs (local ${localLinesTotal} vs Buildium ${remoteLinesTotal})`,
      );
    }
    for (const key of lineKeys) {
      const remoteAmt = remoteLines.get(key) ?? 0;
      const localAmt = localLines.get(key) ?? 0;
      if (Math.abs(remoteAmt - localAmt) > 0.01) {
        mismatches.push(`Line ${key} differs (local ${localAmt} vs Buildium ${remoteAmt})`);
      }
    }
  }

  return {
    status: mismatches.length ? 'mismatch' : 'matched',
    mismatches,
    localTransactionId: local.id ?? null,
  };
}

async function loadProperty(propertyId: string): Promise<PropertyRow | null> {
  const { data } = await supabaseAdmin
    .from('properties')
    .select('id, buildium_property_id, org_id, rental_type')
    .eq('id', propertyId)
    .maybeSingle();
  return (data as PropertyRow | null) ?? null;
}

async function loadGlAccounts(orgId: string): Promise<GlAccountRow[]> {
  const { data } = await supabaseAdmin
    .from('gl_accounts')
    .select('id, buildium_gl_account_id, name, account_number, type, org_id')
    .eq('org_id', orgId)
    .not('buildium_gl_account_id', 'is', null);
  return (data as GlAccountRow[] | null) ?? [];
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await requireRole([...ADMIN_ROLES]);
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId') ?? searchParams.get('property_id');
    const startDate = searchParams.get('startDate') ?? searchParams.get('startdate');
    const endDate = searchParams.get('endDate') ?? searchParams.get('enddate');
    const basisParamRaw = searchParams.get('basis') ?? searchParams.get('accountingbasis');
    const accountingBasis =
      typeof basisParamRaw === 'string' && basisParamRaw.toLowerCase() === 'cash'
        ? 'Cash'
        : typeof basisParamRaw === 'string' && basisParamRaw.toLowerCase() === 'accrual'
          ? 'Accrual'
          : null;
    const orderBy = searchParams.get('orderby') ?? undefined;
    const limitParam = toNumber(searchParams.get('limit'));
    const offsetParam = toNumber(searchParams.get('offset'));
    const limit = Math.min(Math.max(limitParam ?? 200, 1), 1000);
    const offset = Math.max(offsetParam ?? 0, 0);

    if (!propertyId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'propertyId, startDate, and endDate are required' },
        { status: 400 },
      );
    }
    if (!accountingBasis) {
      return NextResponse.json({ error: 'accountingbasis must be Cash or Accrual' }, { status: 400 });
    }

    const property = await loadProperty(propertyId);
    if (!property || !property.org_id) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    if (property.org_id !== orgId) {
      return NextResponse.json({ error: 'Property does not belong to this organization' }, { status: 403 });
    }
    if (!property.buildium_property_id) {
      return NextResponse.json({ error: 'Selected property is missing a Buildium Property ID' }, { status: 400 });
    }

    const glAccounts = await loadGlAccounts(property.org_id);
  const glAccountIds = Array.from(
    new Set(
      glAccounts
        .map((acc) => toNumber(acc.buildium_gl_account_id))
        .filter((id): id is number => id != null && Number.isFinite(id) && id > 0),
    ),
  );

    if (!glAccountIds.length) {
      return NextResponse.json(
        { error: 'No Buildium-linked GL accounts found for this organization' },
        { status: 400 },
      );
    }

    const queryParams: Record<string, string> = {
      selectionentityid: String(property.buildium_property_id),
      selectionentitytype:
        typeof property.rental_type === 'string' &&
        property.rental_type.toLowerCase() === 'association'
          ? 'Association'
        : 'Rental',
      startdate: startDate,
      enddate: endDate,
      glaccountids: glAccountIds.join(','),
      limit: String(limit),
      offset: String(offset),
      accountingbasis: accountingBasis,
    };
    if (orderBy) queryParams.orderby = orderBy;

    const response = await buildiumFetch(
      'GET',
      '/generalledger/transactions',
      queryParams,
      undefined,
      orgId,
    );

    if (!response.ok) {
      logger.error({
        status: response.status,
        details: response.json ?? response.errorText,
        message: 'Buildium general ledger transactions fetch failed',
      });
      return NextResponse.json(
        { error: 'Failed to fetch Buildium general ledger transactions', details: response.json },
        { status: response.status || 502 },
      );
    }

    const pagination = extractPagination(response.json, limit, offset);
    const rawTransactions = extractTransactions(response.json);
    const normalized = rawTransactions
      .map(normalizeBuildiumTransaction)
      .filter((tx): tx is NormalizedBuildiumTransaction => Boolean(tx));

    const buildiumIds = normalized.map((tx) => tx.buildiumId);
    const localLookup = new Map<number, LocalTransactionRow>();
    if (buildiumIds.length) {
      const { data: localRows, error: localErr } = await supabaseAdmin
        .from('transactions')
        .select(
          'id, buildium_transaction_id, date, total_amount, transaction_type, memo, check_number, transaction_lines(amount, posting_type, is_cash_posting, gl_accounts(buildium_gl_account_id))',
        )
        .eq('org_id', property.org_id)
        .in('buildium_transaction_id', buildiumIds);
      if (localErr) {
        logger.error({ error: localErr }, 'Failed to load local transactions for comparison');
      }
      (localRows as LocalTransactionRow[] | null)?.forEach((row) => {
        if (row.buildium_transaction_id != null) {
          localLookup.set(row.buildium_transaction_id, row);
        }
      });
    }

    const preview: PreviewTransaction[] = normalized.map((remote) => {
      const local = localLookup.get(remote.buildiumId) ?? null;
      const diff = diffTransaction(remote, local);
      return {
        buildiumId: remote.buildiumId,
        buildiumDate: remote.date,
        totalAmount: remote.totalAmount,
        transactionType: remote.transactionType,
        memo: remote.memo,
        checkNumber: remote.checkNumber,
        lastUpdated: remote.lastUpdated,
        status: diff.status,
        mismatches: diff.mismatches,
        localTransactionId: diff.localTransactionId,
        buildiumPayload: remote.payload,
      };
    });

    const summary = preview.reduce(
      (acc, txn) => {
        acc.total += 1;
        acc[txn.status] += 1;
        return acc;
      },
      { total: 0, matched: 0, mismatch: 0, missing: 0 },
    );

    return NextResponse.json({
      success: true,
      data: {
        pagination,
        summary,
        transactions: preview,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium general ledger transactions');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    await requireRole([...ADMIN_ROLES]);
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;

    const body = await request.json().catch(() => ({}));
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId : body?.property_id;
    const transactions = Array.isArray(body?.transactions) ? (body.transactions as unknown[]) : [];

    if (!propertyId || !transactions.length) {
      return NextResponse.json(
        { error: 'propertyId and at least one transaction payload are required' },
        { status: 400 },
      );
    }

    const property = await loadProperty(propertyId);
    if (!property || !property.org_id) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }
    if (property.org_id !== orgId) {
      return NextResponse.json({ error: 'Property does not belong to this organization' }, { status: 403 });
    }

    let updated = 0;
    const failures: { id: number | null; error: string }[] = [];
    for (const raw of transactions) {
      const normalized = normalizeBuildiumTransaction(raw);
      if (!normalized) {
        failures.push({ id: null, error: 'Invalid Buildium transaction payload' });
        continue;
      }
      try {
        await upsertGLEntryWithLines(normalized.payload, supabaseAdmin);
        updated += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to persist transaction';
        failures.push({ id: normalized.buildiumId, error: message });
        logger.error(
          { error: err, buildiumId: normalized.buildiumId },
          'Failed to upsert GL transaction',
        );
      }
    }

    return NextResponse.json({
      success: failures.length === 0,
      data: { updated, failed: failures.length, failures },
    });
  } catch (error) {
    logger.error({ error }, 'Error syncing Buildium general ledger transactions');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
