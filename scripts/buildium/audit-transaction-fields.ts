#!/usr/bin/env tsx
/**
 * Audit a small set of Buildium transactions for:
 * - bank lines count (gl_accounts.is_bank_account)
 * - cash lines count (transaction_lines.is_cash_posting)
 * - double-entry balance (debits vs credits)
 * - payment split rows (transaction_payment_transactions)
 *
 * Usage:
 *   ./node_modules/.bin/tsx scripts/buildium/audit-transaction-fields.ts 974788,974792
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

config({ path: '.env.local' });
config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TxRowSchema = z.object({
  id: z.string().uuid(),
  buildium_transaction_id: z.number().int(),
  transaction_type: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  total_amount: z.number().nullable().optional(),
  bank_gl_account_buildium_id: z.number().nullable().optional(),
});

const LineRowSchema = z.object({
  transaction_id: z.string().uuid(),
  amount: z.number().nullable(),
  posting_type: z.string().nullable(),
  gl_account_id: z.string().uuid().nullable(),
  is_cash_posting: z.boolean().nullable().optional(),
});

const GlRowSchema = z.object({
  id: z.string().uuid(),
  is_bank_account: z.boolean().nullable(),
  name: z.string().nullable().optional(),
});

function parseIds(): number[] {
  const raw = process.argv[2] || process.env.TRANSACTION_IDS || '974788,974792,974790,974879';
  return raw
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

const VERBOSE = process.argv.includes('--verbose') || process.env.VERBOSE === '1';

function sumAmount(rows: Array<{ amount: number | null }>): number {
  return rows.reduce((s, r) => s + Number(r.amount ?? 0), 0);
}

async function main() {
  const ids = parseIds();
  if (!ids.length) {
    console.error('No transaction IDs provided.');
    process.exit(1);
  }

  const { data: txRowsRaw, error: txErr } = await supabase
    .from('transactions')
    .select('id, buildium_transaction_id, transaction_type, date, total_amount, bank_gl_account_buildium_id')
    .in('buildium_transaction_id', ids);
  if (txErr) throw txErr;

  const txRows = z.array(TxRowSchema).parse(
    (txRowsRaw ?? []).map((r: any) => ({
      ...r,
      buildium_transaction_id: Number(r.buildium_transaction_id),
      total_amount: r.total_amount == null ? null : Number(r.total_amount),
      bank_gl_account_buildium_id: r.bank_gl_account_buildium_id == null ? null : Number(r.bank_gl_account_buildium_id),
    })),
  );

  const txByBuildiumId = new Map<number, z.infer<typeof TxRowSchema>>();
  for (const tx of txRows) txByBuildiumId.set(tx.buildium_transaction_id, tx);

  const localTxIds = txRows.map((t) => t.id);
  const { data: lineRowsRaw, error: lineErr } = await supabase
    .from('transaction_lines')
    .select('transaction_id, amount, posting_type, gl_account_id, is_cash_posting')
    .in('transaction_id', localTxIds);
  if (lineErr) throw lineErr;

  const lineRows = z.array(LineRowSchema).parse(
    (lineRowsRaw ?? []).map((r: any) => ({
      ...r,
      amount: r.amount == null ? null : Number(r.amount),
    })),
  );

  const glIds = Array.from(
    new Set(lineRows.map((l) => l.gl_account_id).filter((id): id is string => Boolean(id))),
  );
  const glById = new Map<string, z.infer<typeof GlRowSchema>>();
  if (glIds.length) {
    const { data: glRowsRaw, error: glErr } = await supabase
      .from('gl_accounts')
      .select('id, is_bank_account, name')
      .in('id', glIds);
    if (glErr) throw glErr;
    const glRows = z.array(GlRowSchema).parse(glRowsRaw ?? []);
    for (const g of glRows) glById.set(g.id, g);
  }

  const { data: splitRows, error: splitErr } = await supabase
    .from('transaction_payment_transactions')
    .select('id, transaction_id')
    .in('transaction_id', localTxIds);
  if (splitErr) throw splitErr;

  const splitCountByTxId = new Map<string, number>();
  for (const s of splitRows ?? []) {
    const txId = (s as any)?.transaction_id as string | undefined;
    if (!txId) continue;
    splitCountByTxId.set(txId, (splitCountByTxId.get(txId) ?? 0) + 1);
  }

  for (const buildiumId of ids) {
    const tx = txByBuildiumId.get(buildiumId);
    if (!tx) {
      console.log(`⚠️  ${buildiumId}: no local transaction found`);
      continue;
    }
    const lines = lineRows.filter((l) => l.transaction_id === tx.id);
    const debits = sumAmount(lines.filter((l) => l.posting_type === 'Debit'));
    const credits = sumAmount(lines.filter((l) => l.posting_type === 'Credit'));
    const delta = debits - credits;
    const bankLines = lines.filter((l) => {
      if (!l.gl_account_id) return false;
      return Boolean(glById.get(l.gl_account_id)?.is_bank_account);
    }).length;
    const cashLines = lines.filter((l) => Boolean(l.is_cash_posting)).length;
    const splitCount = splitCountByTxId.get(tx.id) ?? 0;

    console.log(
      [
        `Buildium ${buildiumId} → local ${tx.id}`,
        `type=${tx.transaction_type ?? 'n/a'}`,
        `total=${tx.total_amount ?? 'n/a'}`,
        `debits=${debits}`,
        `credits=${credits}`,
        `delta=${delta}`,
        `bankLines=${bankLines}`,
        `cashLines=${cashLines}`,
        `splits=${splitCount}`,
        `bankGLBuildiumId=${tx.bank_gl_account_buildium_id ?? 'n/a'}`,
      ].join(' | '),
    );

    if (VERBOSE) {
      for (const l of lines) {
        const gl = l.gl_account_id ? glById.get(l.gl_account_id) : null;
        console.log(
          `  - ${l.posting_type ?? 'n/a'} ${Number(l.amount ?? 0)} | gl=${l.gl_account_id ?? 'n/a'} | glName=${gl?.name ?? 'n/a'} | isBank=${gl?.is_bank_account ?? 'n/a'} | isCash=${l.is_cash_posting ?? 'n/a'}`,
        );
      }
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', (err as any)?.message || err);
  process.exit(1);
});


