import { Pool } from 'pg';
import { z } from 'zod';

const EnvSchema = z.object({
  SUPABASE_DB_URL: z.string().url(),
});

const env = EnvSchema.safeParse(process.env);
if (!env.success) {
  console.error('Missing required env vars for backfill:', env.error.flatten().fieldErrors);
  process.exit(1);
}

const pool = new Pool({
  connectionString: env.data.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});

const log = (...args: unknown[]) => console.log('[backfill-ar]', ...args);

type ChargeCandidate = {
  id: string;
  org_id: string;
  lease_id: number | null;
  total_amount: number | null;
  date: string | null;
  charge_type: string | null;
};

type PaymentRow = {
  id: string;
  org_id: string | null;
  lease_id: number | null;
  total_amount: number | null;
  date: string | null;
};

const fetchChargeCandidates = async (client = pool) => {
  const { rows } = await client.query<ChargeCandidate>(
    `
    SELECT t.id, t.org_id, t.lease_id, t.total_amount, t.date,
      (
        SELECT ga.name
        FROM public.transaction_lines tl
        JOIN public.gl_accounts ga ON ga.id = tl.gl_account_id
        WHERE tl.transaction_id = t.id
          AND tl.posting_type = 'Credit'
        ORDER BY tl.amount DESC NULLS LAST
        LIMIT 1
      ) as charge_type
    FROM public.transactions t
    WHERE t.transaction_type = 'Charge'
      AND NOT EXISTS (SELECT 1 FROM public.charges c WHERE c.transaction_id = t.id)
      AND EXISTS (
        SELECT 1
        FROM public.transaction_lines tl
        JOIN public.gl_accounts ga ON ga.id = tl.gl_account_id
        WHERE tl.transaction_id = t.id
          AND tl.posting_type = 'Debit'
          AND ga.type = 'asset'
          AND (ga.sub_type = 'AccountsReceivable' OR ga.name ILIKE '%accounts receivable%')
      )
    `,
  );
  return rows ?? [];
};

const inferChargeType = (raw: string | null | undefined): string => {
  if (!raw) return 'rent';
  const name = raw.toLowerCase();
  if (name.includes('late')) return 'late_fee';
  if (name.includes('utility')) return 'utility';
  if (name.includes('fee')) return 'late_fee';
  return 'rent';
};

const insertCharges = async (candidates: ChargeCandidate[], dryRun: boolean) => {
  if (!candidates.length) {
    log('No charge candidates to backfill.');
    return;
  }
  if (dryRun) {
    const total = candidates.reduce((sum, c) => sum + Math.abs(Number(c.total_amount ?? 0)), 0);
    log(`Dry-run: would insert ${candidates.length} charges, total=${total.toFixed(2)}`);
    return;
  }

  const now = new Date().toISOString();
  const values: unknown[] = [];
  const placeholders = candidates
    .map((c, idx) => {
      const base = idx * 10;
      const amount = Number(c.total_amount ?? 0);
      const chargeType = inferChargeType(c.charge_type);
      values.push(
        c.org_id,
        c.lease_id,
        c.id,
        chargeType,
        amount,
        amount,
        c.date ?? now.slice(0, 10),
        'open',
        'backfill',
        now,
      );
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9},$${base + 10})`;
    })
    .join(',');

  await pool.query(
    `
    INSERT INTO public.charges (
      org_id, lease_id, transaction_id, charge_type, amount, amount_open, due_date, status, source, created_at
    )
    VALUES ${placeholders}
    `,
    values,
  );
  log(`Inserted ${candidates.length} charges.`);
};

const fetchPaymentsWithoutAllocations = async (client = pool) => {
  const { rows } = await client.query<PaymentRow>(
    `
    SELECT t.id, t.org_id, t.lease_id, t.total_amount, t.date
    FROM public.transactions t
    WHERE t.transaction_type = 'Payment'
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_allocations pa WHERE pa.payment_transaction_id = t.id
      )
    `,
  );
  return rows ?? [];
};

const allocatePayment = async (payment: PaymentRow, dryRun: boolean) => {
  if (!payment.lease_id) return { allocations: 0 };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: charges } = await client.query(
      `
      SELECT id, amount_open, amount, status
      FROM public.charges
      WHERE lease_id = $1
        AND status IN ('open','partial')
        AND amount_open > 0
        AND (due_date IS NULL OR due_date <= $2)
      ORDER BY due_date, created_at, id
      FOR UPDATE
      `,
      [payment.lease_id, payment.date ?? new Date().toISOString().slice(0, 10)],
    );

    let remaining = Math.abs(Number(payment.total_amount ?? 0));
    if (!charges.length || remaining <= 0) {
      await client.query('ROLLBACK');
      return { allocations: 0 };
    }

    const allocations: {
      org_id: string | null;
      payment_transaction_id: string;
      charge_id: string;
      allocated_amount: number;
      allocation_order: number;
    }[] = [];

    for (const charge of charges) {
      if (remaining <= 0) break;
      const alloc = Math.min(remaining, Number(charge.amount_open ?? 0));
      if (alloc <= 0) continue;
      allocations.push({
        org_id: payment.org_id,
        payment_transaction_id: payment.id,
        charge_id: charge.id,
        allocated_amount: Number(alloc.toFixed(2)),
        allocation_order: allocations.length,
      });
      remaining -= alloc;
    }

    if (!allocations.length) {
      await client.query('ROLLBACK');
      return { allocations: 0 };
    }

    if (dryRun) {
      await client.query('ROLLBACK');
      log(
        `Dry-run: payment ${payment.id} -> allocations ${allocations.length}, total=${allocations
          .reduce((s, a) => s + a.allocated_amount, 0)
          .toFixed(2)}`,
      );
      return { allocations: allocations.length };
    }

    const now = new Date().toISOString();
    for (const alloc of allocations) {
      await client.query(
        `
        INSERT INTO public.payment_allocations (
          org_id, payment_transaction_id, charge_id, allocated_amount, allocation_order, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$6)
        ON CONFLICT DO NOTHING
        `,
        [
          alloc.org_id,
          alloc.payment_transaction_id,
          alloc.charge_id,
          alloc.allocated_amount,
          alloc.allocation_order,
          now,
        ],
      );

      const { rows: updated } = await client.query(
        `
        UPDATE public.charges
        SET amount_open = GREATEST(0, amount_open - $1),
            status = CASE
              WHEN amount_open - $1 <= 0.01 THEN 'paid'
              WHEN amount_open - $1 < amount THEN 'partial'
              ELSE status
            END,
            updated_at = $2
        WHERE id = $3
        RETURNING id
        `,
        [alloc.allocated_amount, now, alloc.charge_id],
      );
      if (!updated.length) {
        throw new Error(`Failed to update charge ${alloc.charge_id}`);
      }
    }

    await client.query('COMMIT');
    return { allocations: allocations.length };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const backfillAllocations = async (dryRun: boolean) => {
  const payments = await fetchPaymentsWithoutAllocations();
  let totalAllocations = 0;
  const orgTotals: Record<string, { payments: number; allocations: number; allocatedAmount: number }> = {};
  for (const p of payments) {
    const { allocations } = await allocatePayment(p, dryRun);
    totalAllocations += allocations;
    const orgKey = p.org_id ?? 'unknown';
    if (!orgTotals[orgKey]) {
      orgTotals[orgKey] = { payments: 0, allocations: 0, allocatedAmount: 0 };
    }
    orgTotals[orgKey].payments += 1;
    orgTotals[orgKey].allocations += allocations;
  }
  log(
    dryRun
      ? `Dry-run allocations processed.`
      : `Inserted ${totalAllocations} allocations.`,
  );
  log('Org allocation summary:', orgTotals);
};

const main = async () => {
  const dryRun = process.argv.includes('--dry-run');
  log(`Starting AR backfill (dryRun=${dryRun})`);

  const chargeCandidates = await fetchChargeCandidates();
  await insertCharges(chargeCandidates, dryRun);
  await backfillAllocations(dryRun);

  const { rows: reconcile } = await pool.query(`SELECT * FROM public.v_ar_reconciliation ORDER BY org_id`);
  log('Reconciliation snapshot:', reconcile);

  await pool.end();
  log('Backfill complete');
};

main().catch((err) => {
  console.error('Backfill failed', err);
  process.exit(1);
});
