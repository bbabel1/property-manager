import { describe, it, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { fetchPropertyFinancials } from '@/server/financials/property-finance';
import cashBalanceCases from './fixtures/finance-cash-balance-spec.json';
import type { Database } from '@/types/database';

type SupabaseClient = ReturnType<typeof createClient<Database>>;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

type TransactionLineSpec = {
  amount?: number | null;
  posting_type?: string | null;
  transaction_id?: string | number | null;
  gl_accounts?: {
    name?: string | null;
    type?: string | null;
    sub_type?: string | null;
    is_bank_account?: boolean | null;
    is_security_deposit_liability?: boolean | null;
  };
};

type TransactionSpec = {
  id?: string | number | null;
  transaction_type?: string | null;
  total_amount?: number | null;
};

type CashBalanceCase = {
  name: string;
  transactionLines: TransactionLineSpec[];
  transactions?: TransactionSpec[];
  reserve?: number;
  propertyBankAccount?: TransactionLineSpec['gl_accounts'];
  externalBankLines?: TransactionLineSpec[];
  expected?: Record<string, unknown>;
};

const cases: CashBalanceCase[] = cashBalanceCases as CashBalanceCase[];

type SeededCase = {
  orgId: string;
  propertyId: string;
  unitId: string;
  leaseId: number | null;
  otherPropertyId?: string | null;
  glAccountIds: string[];
  transactionIds: string[];
};

type RpcFinancials = {
  cash_balance?: number | null;
  security_deposits?: number | null;
  available_balance?: number | null;
};

const nowIso = () => new Date().toISOString();

const toPostingType = (value?: string | null) => {
  const v = (value || '').trim();
  if (!v) return 'Credit';
  const upper = v[0].toUpperCase() + v.slice(1).toLowerCase();
  return upper;
};

async function seedFixtureCase(
  db: SupabaseClient,
  asOf: string,
  spec: CashBalanceCase,
): Promise<SeededCase> {
  const orgId = crypto.randomUUID();
  const propertyId = crypto.randomUUID();
  const unitId = crypto.randomUUID();
  let otherPropertyId: string | null = null;
  const now = nowIso();

  const orgRes = await db.from('organizations').insert({
    id: orgId,
    name: `Fixture Org ${orgId.slice(0, 8)}`,
    slug: `fixture-org-${orgId.slice(0, 8)}`,
    created_at: now,
    updated_at: now,
  });
  if (orgRes.error) throw orgRes.error;

  const glAccountIds: string[] = [];
  const glAccountMap = new Map<string, string>();
  let glCounter = 1;
  let primaryBankGlId: string | null = null;

  const ensureGlAccount = async (ga?: TransactionLineSpec['gl_accounts']): Promise<string> => {
    const safeGa = ga ?? {};
    const key = JSON.stringify(safeGa);
    if (glAccountMap.has(key)) return glAccountMap.get(key)!;
    const glId = crypto.randomUUID();
    const insert = await db
      .from('gl_accounts')
      .insert({
        id: glId,
        org_id: orgId,
        name: safeGa.name || `GL ${glCounter}`,
        type: safeGa.type || 'asset',
        sub_type: safeGa.sub_type ?? null,
        is_bank_account: Boolean(safeGa.is_bank_account),
        is_security_deposit_liability: Boolean(safeGa.is_security_deposit_liability),
        exclude_from_cash_balances: false,
        buildium_gl_account_id: 100000 + glCounter,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();
    if (insert.error) throw insert.error;
    glAccountMap.set(key, glId);
    glAccountIds.push(glId);
    glCounter += 1;
    return glId;
  };

  if (spec.propertyBankAccount) {
    primaryBankGlId = await ensureGlAccount(spec.propertyBankAccount);
  }

  const propertyRes = await db.from('properties').insert({
    id: propertyId,
    name: `Fixture Property ${propertyId.slice(0, 8)}`,
    address_line1: '123 Test St',
    city: 'Test City',
    country: 'United States',
    postal_code: '00000',
    org_id: orgId,
    service_assignment: 'Property Level',
    status: 'Active',
    property_type: 'Rental Building',
    operating_bank_gl_account_id: primaryBankGlId,
    deposit_trust_gl_account_id: null,
    total_units: 1,
    total_active_units: 1,
    total_inactive_units: 0,
    total_occupied_units: 0,
    total_vacant_units: 1,
    reserve: spec.reserve ?? 0,
    cash_balance: 0,
    available_balance: 0,
    created_at: now,
    updated_at: now,
  });
  if (propertyRes.error) throw propertyRes.error;

  const unitRes = await db
    .from('units')
    .insert({
      id: unitId,
      property_id: propertyId,
      org_id: orgId,
      unit_number: '1A',
      address_line1: '123 Test St',
      city: 'Test City',
      country: 'United States',
      postal_code: '00000',
      status: 'Vacant',
      service_start: asOf,
      service_plan: null,
      service_end: null,
      balance: 0,
      deposits_held_balance: 0,
      prepayments_balance: 0,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();
  if (unitRes.error) throw unitRes.error;

  const leaseRes = await db
    .from('lease')
    .insert({
      property_id: propertyId,
      unit_id: unitId,
      lease_from_date: asOf,
      lease_to_date: null,
      status: 'Active',
      rent_amount: 0,
      created_at: now,
      updated_at: now,
      unit_number: '1A',
    })
    .select('id')
    .single();
  if (leaseRes.error) throw leaseRes.error;
  const leaseId = leaseRes.data?.id ?? null;

  for (const line of spec.transactionLines) {
    await ensureGlAccount(line.gl_accounts);
  }

  const transactionIds: string[] = [];
  for (const tx of spec.transactions || []) {
    const txId = tx.id ? String(tx.id) : crypto.randomUUID();
    const txType =
      (tx.transaction_type ?? 'Payment') as Database['public']['Enums']['transaction_type_enum'];
    const insertTx = await db.from('transactions').insert({
      id: txId,
      lease_id: leaseId,
      org_id: orgId,
      transaction_type: txType,
      total_amount: tx.total_amount ?? 0,
      status: 'Paid',
      date: asOf,
      paid_date: asOf,
      email_receipt: false,
      print_receipt: false,
      is_recurring: false,
      created_at: now,
      updated_at: now,
    });
    if (insertTx.error) throw insertTx.error;
    transactionIds.push(txId);
  }

  for (const line of spec.transactionLines) {
    const ga = line.gl_accounts || {};
    const key = JSON.stringify(ga);
    const glAccountId = glAccountMap.get(key);
    if (!glAccountId) throw new Error('GL account missing for fixture line');
    const insertLine = await db.from('transaction_lines').insert({
      amount: line.amount ?? 0,
      posting_type: toPostingType(line.posting_type),
      transaction_id: line.transaction_id ? String(line.transaction_id) : null,
      gl_account_id: glAccountId,
      property_id: propertyId,
      lease_id: leaseId,
      unit_id: unitId,
      account_entity_type: 'Rental',
      account_entity_id: leaseId,
      date: asOf,
      created_at: now,
      updated_at: now,
    });
    if (insertLine.error) throw insertLine.error;
  }

  if (spec.externalBankLines && spec.externalBankLines.length > 0) {
    otherPropertyId = crypto.randomUUID();
    const otherProp = await db.from('properties').insert({
      id: otherPropertyId,
      name: `Fixture Property ${otherPropertyId.slice(0, 8)}`,
      address_line1: '456 Other St',
      city: 'Test City',
      country: 'United States',
      postal_code: '00000',
      org_id: orgId,
      service_assignment: 'Property Level',
      status: 'Active',
      property_type: 'Rental Building',
      operating_bank_gl_account_id: primaryBankGlId,
      deposit_trust_gl_account_id: null,
      total_units: 0,
      total_active_units: 0,
      total_inactive_units: 0,
      total_occupied_units: 0,
      total_vacant_units: 0,
      reserve: 0,
      cash_balance: 0,
      available_balance: 0,
      created_at: now,
      updated_at: now,
    });
    if (otherProp.error) throw otherProp.error;

    for (const line of spec.externalBankLines) {
      const glAccountId = await ensureGlAccount(line.gl_accounts ?? spec.propertyBankAccount);
      const insertLine = await db.from('transaction_lines').insert({
        amount: line.amount ?? 0,
        posting_type: toPostingType(line.posting_type),
        transaction_id: line.transaction_id ? String(line.transaction_id) : null,
        gl_account_id: glAccountId,
        property_id: otherPropertyId,
        lease_id: null,
        unit_id: null,
        account_entity_type: 'Rental',
        account_entity_id: null,
        date: asOf,
        created_at: now,
        updated_at: now,
      });
      if (insertLine.error) throw insertLine.error;
    }
  }

  return {
    orgId,
    propertyId,
    unitId,
    leaseId,
    otherPropertyId,
    glAccountIds,
    transactionIds,
  };
}

async function cleanupFixtureCase(db: SupabaseClient, seeded: SeededCase) {
  await db.from('transaction_lines').delete().eq('property_id', seeded.propertyId);
  if (seeded.otherPropertyId) {
    await db.from('transaction_lines').delete().eq('property_id', seeded.otherPropertyId);
  }
  if (seeded.transactionIds.length) {
    await db.from('transactions').delete().in('id', seeded.transactionIds);
  }
  if (seeded.leaseId != null) {
    await db.from('lease').delete().eq('id', seeded.leaseId);
  }
  await db.from('units').delete().eq('id', seeded.unitId);
  await db.from('properties').delete().eq('id', seeded.propertyId);
  if (seeded.otherPropertyId) {
    await db.from('properties').delete().eq('id', seeded.otherPropertyId);
  }
  if (seeded.glAccountIds.length) {
    await db.from('gl_accounts').delete().in('id', seeded.glAccountIds);
  }
  await db.from('organizations').delete().eq('id', seeded.orgId);
}

if (!url || !key) {
  // Skip integration test if env not provided
  describe.skip('property financials RPC alignment (env missing)', () => {});
} else {
  const db = createClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  describe('property financials RPC alignment', () => {
    const asOf = new Date().toISOString().slice(0, 10);
    for (const spec of cases) {
      it(`RPC should match helper rollup for ${spec.name}`, async () => {
        const seeded = await seedFixtureCase(db, asOf, spec);
        try {
          const { data: rpcData, error } = await db.rpc('get_property_financials', {
            p_property_id: seeded.propertyId,
            p_as_of: asOf,
          });
          expect(error).toBeNull();
          const rpcFin = (rpcData as RpcFinancials | null) ?? null;
          const { fin: helperFin } = await fetchPropertyFinancials(
            seeded.propertyId,
            asOf,
            db,
          );

          const close = (a?: number | null, b?: number | null, tol = 0.5) =>
            Math.abs((a || 0) - (b || 0)) <= tol;

          expect(close(rpcFin?.cash_balance, helperFin.cash_balance)).toBe(true);
          expect(close(rpcFin?.security_deposits, helperFin.security_deposits)).toBe(true);
          expect(close(rpcFin?.available_balance, helperFin.available_balance)).toBe(true);
        } finally {
          await cleanupFixtureCase(db, seeded);
        }
      });
    }
  });
}
