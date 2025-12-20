import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import type { Database } from '@/types/database';
import type {
  BuildiumLeaseTransactionCreateLine,
  BuildiumPaymentMethod,
} from '@/types/buildium';
import type { PaymentMethodValue } from '@/lib/enums/payment-method';

type MonthlyLogRow = Pick<
  Database['public']['Tables']['monthly_logs']['Row'],
  'id' | 'lease_id' | 'unit_id' | 'property_id' | 'org_id' | 'tenant_id'
> & {
  lease_id?: number | null;
};

export type AllocationInput = {
  account_id: string;
  amount: number;
  memo?: string | null;
};

export interface LeaseContext {
  leaseId: number;
  buildiumLeaseId: number;
  buildiumPropertyId: number | null;
  buildiumUnitId: number | null;
  propertyId: string | null;
  unitId: string | null;
  orgId: string | null;
}

export interface MonthlyLogContext {
  log: MonthlyLogRow;
  lease: LeaseContext;
}

const AMOUNT_TOLERANCE = 0.01;

export async function fetchLeaseContextById(
  leaseId: number,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<LeaseContext> {
  if (!Number.isFinite(leaseId)) {
    throw new Error('Invalid lease id');
  }

  const { data, error } = await db
    .from('lease')
    .select(
      'id, org_id, property_id, unit_id, buildium_lease_id, buildium_property_id, buildium_unit_id',
    )
    .eq('id', leaseId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Lease not found');
  }

  if (data.buildium_lease_id == null) {
    throw new Error('Lease is missing Buildium identifier');
  }

  return {
    leaseId: Number(data.id),
    buildiumLeaseId: data.buildium_lease_id,
    buildiumPropertyId: data.buildium_property_id ?? null,
    buildiumUnitId: data.buildium_unit_id ?? null,
    propertyId: data.property_id ?? null,
    unitId: data.unit_id ?? null,
    orgId: data.org_id ?? null,
  };
}

export async function fetchMonthlyLogContext(
  logId: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<MonthlyLogContext> {
  type MonthlyLogSlice = Pick<
    MonthlyLogRow,
    'id' | 'unit_id' | 'property_id' | 'org_id' | 'tenant_id' | 'lease_id'
  >;

  const { data: log, error } = await db
    .from('monthly_logs')
    .select('id, unit_id, property_id, org_id, tenant_id, lease_id')
    .eq('id', logId)
    .maybeSingle<MonthlyLogSlice>();

  if (error || !log) {
    throw new Error('Monthly log not found');
  }

  let leaseId = log.lease_id ?? null;

  if (!leaseId && log.unit_id) {
    leaseId = await resolveActiveLeaseIdForUnit(log.unit_id, db);
  }

  if (!leaseId) {
    throw new Error('No active lease is associated with this monthly log');
  }

  const lease = await fetchLeaseContextById(Number(leaseId), db);

  return { log, lease };
}

async function resolveActiveLeaseIdForUnit(
  unitId: string,
  db: TypedSupabaseClient,
): Promise<number | null> {
  const { data, error } = await db
    .from('lease')
    .select('id')
    .eq('unit_id', unitId)
    .eq('status', 'active')
    .order('lease_from_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data?.id ?? null;
}

export async function fetchBuildiumGlAccountMap(
  accountIds: string[],
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<Map<string, number>> {
  const trimmed = [...new Set(accountIds.filter(Boolean))];
  const map = new Map<string, number>();

  if (!trimmed.length) {
    return map;
  }

  const { data, error } = await db
    .from('gl_accounts')
    .select('id, buildium_gl_account_id')
    .in('id', trimmed);

  if (error) {
    throw new Error(`Failed to load GL accounts: ${error.message}`);
  }

  for (const row of data ?? []) {
    if (!row?.id) continue;
    if (row.buildium_gl_account_id == null) {
      throw new Error(`GL account ${row.id} is missing a Buildium mapping`);
    }
    map.set(String(row.id), row.buildium_gl_account_id);
  }

  return map;
}

export function buildLinesFromAllocations(
  allocations: AllocationInput[],
  glAccountMap: Map<string, number>,
): BuildiumLeaseTransactionCreateLine[] {
  return allocations
    .filter((allocation) => allocation.amount > 0)
    .map((allocation) => {
      const glId = glAccountMap.get(allocation.account_id);
      if (!glId) {
        throw new Error(`Account ${allocation.account_id} is missing a Buildium mapping`);
      }
      return {
        GLAccountId: glId,
        Amount: Number(allocation.amount),
        Memo: allocation.memo ?? undefined,
      };
    });
}

export function buildDepositLines(params: {
  allocations: AllocationInput[];
  depositAccountId: string;
  glAccountMap: Map<string, number>;
  memo?: string | null;
}): { lines: BuildiumLeaseTransactionCreateLine[]; debitTotal: number; depositBuildiumAccountId: number } {
  const debitLines = buildLinesFromAllocations(params.allocations, params.glAccountMap);
  const total = debitLines.reduce((sum, line) => sum + Number(line.Amount || 0), 0);

  if (total <= 0) {
    throw new Error('Deposit allocations must include a positive amount');
  }

  const depositGlId = params.glAccountMap.get(params.depositAccountId);
  if (!depositGlId) {
    throw new Error('Deposit account is missing a Buildium mapping');
  }

  return {
    lines: [
      ...debitLines,
      {
        GLAccountId: depositGlId,
        Amount: -total,
        Memo: params.memo ?? undefined,
      },
    ],
    debitTotal: total,
    depositBuildiumAccountId: depositGlId,
  };
}

export async function fetchBankAccountBuildiumId(
  bankAccountId: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<number> {
  // Phase 4: prefer gl_accounts (is_bank_account=true) as the bank account source of truth.
  {
    const { data: glRow, error: glError } = await db
      .from('gl_accounts')
      .select('id, buildium_gl_account_id, is_bank_account')
      .eq('id', bankAccountId)
      .maybeSingle();

    if (!glError && glRow && Boolean((glRow as any).is_bank_account)) {
      // Buildium treats the bank account ID as the bank GL account ID.
      const candidate = (glRow as any).buildium_gl_account_id;
      const parsed =
        typeof candidate === 'number'
          ? candidate
          : typeof candidate === 'string' && Number.isFinite(Number(candidate))
            ? Number(candidate)
            : null;
      if (parsed != null) return parsed;
    }
  }

  throw new Error('Bank account not found');
}

export async function fetchTransactionWithLines(
  transactionId: string,
  db: TypedSupabaseClient = supabaseAdmin,
) {
  const { data: transaction } = await db
    .from('transactions')
    .select(
      'id, lease_id, monthly_log_id, transaction_type, total_amount, date, memo, reference_number, buildium_transaction_id, payment_method, payee_tenant_id',
    )
    .eq('id', transactionId)
    .maybeSingle();

  if (!transaction) {
    return null;
  }

  const { data: lines } = await db
    .from('transaction_lines')
    .select('id, transaction_id, gl_account_id, amount, posting_type, memo')
    .eq('transaction_id', transactionId);

  return {
    transaction,
    lines: lines ?? [],
  };
}

export async function assignTransactionToMonthlyLog(
  transactionId: string,
  monthlyLogId: string,
  db: TypedSupabaseClient = supabaseAdmin,
) {
  await db
    .from('transactions')
    .update({ monthly_log_id: monthlyLogId, updated_at: new Date().toISOString() })
    .eq('id', transactionId);
}

const paymentMethodMap: Record<PaymentMethodValue, BuildiumPaymentMethod | string> = {
  Check: 'Check',
  Cash: 'Cash',
  MoneyOrder: 'Check',
  CashierCheck: 'Check',
  DirectDeposit: 'BankTransfer',
  CreditCard: 'CreditCard',
  ElectronicPayment: 'OnlinePayment',
};

export function mapPaymentMethodToBuildium(
  method: PaymentMethodValue,
): BuildiumPaymentMethod | string {
  return paymentMethodMap[method] ?? 'Check';
}

export function mapRefundMethodToBuildium(
  method: 'check' | 'eft',
): BuildiumPaymentMethod | string {
  if (method === 'eft') return 'BankTransfer';
  return 'Check';
}

export function coerceTenantIdentifier(value?: string | null): number | undefined {
  if (value == null) return undefined;
  const candidate = Number(value);
  if (!Number.isFinite(candidate)) {
    return undefined;
  }
  return candidate;
}

export function amountsRoughlyEqual(expected: number, received: number): boolean {
  return Math.abs(expected - received) <= AMOUNT_TOLERANCE;
}
