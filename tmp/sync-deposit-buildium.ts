import { config } from 'dotenv';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';

config({ path: '.env' });
config({ path: '.env.local', override: false });

async function run() {
  const dbModule = await import('../src/lib/db');
  const buildiumModule = await import('../src/lib/buildium-client');

  const supabase: SupabaseClient<Database> =
    (dbModule as { supabaseAdmin?: SupabaseClient<Database> }).supabaseAdmin ||
    (dbModule as { default?: { supabaseAdmin?: SupabaseClient<Database> } }).default
      ?.supabaseAdmin ||
    ((dbModule as { default?: { default?: SupabaseClient<Database> } }).default?.default as
      | SupabaseClient<Database>
      | undefined) ||
    (() => {
      throw new Error('supabaseAdmin client not resolved from src/lib/db');
    })();

  const getOrgScopedBuildiumClient =
    (buildiumModule as { getOrgScopedBuildiumClient?: (orgId?: string) => Promise<any> })
      .getOrgScopedBuildiumClient ||
    (buildiumModule as { default?: { getOrgScopedBuildiumClient?: (orgId?: string) => Promise<any> } })
      .default?.getOrgScopedBuildiumClient ||
    (buildiumModule as { default?: { default?: { getOrgScopedBuildiumClient?: (orgId?: string) => Promise<any> } } })
      .default?.default?.getOrgScopedBuildiumClient;

  if (!supabase) {
    throw new Error('supabaseAdmin client not resolved from src/lib/db');
  }
  if (!getOrgScopedBuildiumClient) {
    throw new Error('getOrgScopedBuildiumClient not resolved from src/lib/buildium-client');
  }

  const depositId = '2971e83f-e895-45f3-ae14-d3837d2e09c4';

  const { data: deposit, error: depositErr } = await supabase
    .from('transactions')
    .select('id, bank_gl_account_id, buildium_transaction_id, total_amount, memo, date, org_id')
    .eq('id', depositId)
    .maybeSingle();
  if (depositErr) throw depositErr;
  if (!deposit) throw new Error('Deposit not found');
  if (deposit.buildium_transaction_id) {
    console.log('Already has Buildium deposit id', deposit.buildium_transaction_id);
    return;
  }

  if (!deposit.bank_gl_account_id) {
    throw new Error('Deposit is missing bank_gl_account_id');
  }

  const { data: bank, error: bankErr } = await supabase
    .from('gl_accounts')
    .select('id, name, buildium_gl_account_id')
    .eq('id', deposit.bank_gl_account_id)
    .maybeSingle();
  if (bankErr) throw bankErr;
  const bankBuildiumId = bank?.buildium_gl_account_id;
  if (typeof bankBuildiumId !== 'number') throw new Error('Missing bank buildium_gl_account_id');

  const { data: splits, error: splitsErr } = await supabase
    .from('transaction_payment_transactions')
    .select('buildium_payment_transaction_id, amount')
    .eq('transaction_id', depositId);
  if (splitsErr) throw splitsErr;
  const paymentBuildiumIds = (splits || [])
    .map((s) => s.buildium_payment_transaction_id)
    .filter((v): v is number => typeof v === 'number');
  const amountFromSplits = (splits || []).reduce(
    (sum: number, s) => sum + Number(s?.amount ?? 0),
    0,
  );

  if (paymentBuildiumIds.length === 0) throw new Error('No Buildium payment transaction IDs found');

  const buildiumClient = await getOrgScopedBuildiumClient(deposit.org_id ?? undefined);
  const payload = {
    EntryDate: deposit.date,
    Memo: deposit.memo ?? undefined,
    PaymentTransactionIds: paymentBuildiumIds,
    Lines: [] as Array<Record<string, unknown>>,
  };

  console.log('Requesting Buildium deposit with payload', payload);

  const result = await buildiumClient.makeRequest(
    'POST',
    `/bankaccounts/${bankBuildiumId}/deposits`,
    payload,
  );

  const buildiumDepositId =
    typeof result?.Id === 'number'
      ? result.Id
      : (result as { id?: number | string | null })?.id ?? null;
  console.log('Buildium response', result);

  if (buildiumDepositId != null) {
    await supabase
      .from('transactions')
      .update({
        buildium_transaction_id: buildiumDepositId,
        total_amount: amountFromSplits || deposit.total_amount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', depositId);
    console.log('Updated local deposit with Buildium id', buildiumDepositId);
  } else {
    console.log('No Buildium deposit id returned; not updating local record');
  }
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
