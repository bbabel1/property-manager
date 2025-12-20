/**
 * Reclassify payment transaction lines that were incorrectly posted to Rent Income.
 *
 * This script:
 *   1) Finds payment transactions whose lines point to income accounts (or names containing "rent income")
 *   2) For each, switches the line to the property's operating bank GL account (asset) and sets posting_type='debit'
 *      OR a user-specified TARGET_GL_ID fallback
 *
 * Usage:
 *   DRY_RUN=true  DATABASE_URL=postgres://...  tsx scripts/fix-rent-income-payments.ts
 *   DRY_RUN=false DATABASE_URL=postgres://... TARGET_GL_ID=<uuid> tsx scripts/fix-rent-income-payments.ts
 *
 * Notes:
 *   - Requires DATABASE_URL (service-role or direct Postgres connection string).
 *   - Filters: FILTER_LEASE_ID, FILTER_BUILDIM_LEASE_ID, FILTER_TRANSACTION_ID (optional).
 *   - If no property operating bank GL is set, you can supply TARGET_GL_ID as a fallback.
 *   - Skips rows without a mapped target and reports them.
 */

import { Pool } from 'pg';

const env = process.env;
const FILTER_LEASE_ID = env.FILTER_LEASE_ID || null;
const FILTER_BUILDIM_LEASE_ID = env.FILTER_BUILDIM_LEASE_ID || null;
const FILTER_TRANSACTION_ID = env.FILTER_TRANSACTION_ID || null;
const TARGET_GL_ID = env.TARGET_GL_ID || null;

type Row = {
  tl_id: string;
  transaction_id: string;
  lease_id: string | null;
  property_id: string | null;
  bad_gl_id: string;
  bad_gl_name: string;
  bad_gl_type: string | null;
  target_gl_id: string | null;
  amount: number;
  posting_type: string | null;
  date: string | null;
};

const main = async () => {
  const { DATABASE_URL, DRY_RUN } = process.env;
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required (service role or direct Postgres URL).');
  }
  const dryRun = DRY_RUN !== 'false';

  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const clauses: string[] = [];
    const params: any[] = [];
    const pushClause = (sql: string, value: any) => {
      params.push(value);
      clauses.push(sql.replace(/\?/g, `$${params.length}`));
    };

    if (FILTER_LEASE_ID) pushClause('t.lease_id = ?', FILTER_LEASE_ID);
    if (FILTER_BUILDIM_LEASE_ID) pushClause('t.buildium_lease_id = ?', FILTER_BUILDIM_LEASE_ID);
    if (FILTER_TRANSACTION_ID) pushClause('t.id = ?', FILTER_TRANSACTION_ID);

    const whereFilters = clauses.length ? ` and ${clauses.join(' and ')}` : '';

    const { rows } = await pool.query<Row>(
      `
      select
        tl.id as tl_id,
        tl.transaction_id,
        t.lease_id,
        l.property_id,
        tl.gl_account_id as bad_gl_id,
        coalesce(ga.name, '') as bad_gl_name,
        ga.type as bad_gl_type,
        p.operating_bank_gl_account_id as target_gl_id,
        tl.amount,
        tl.posting_type,
        t.date
      from transaction_lines tl
      join transactions t on t.id = tl.transaction_id
      join gl_accounts ga on ga.id = tl.gl_account_id
      left join lease l on l.id = t.lease_id
      left join properties p on p.id = l.property_id
      where lower(t.transaction_type) like '%payment%'
        and (
          lower(ga.type) = 'income'
          or lower(ga.name) like '%rent income%'
        )
        ${whereFilters}
      ;
    `,
      params,
    );

    if (!rows.length) {
      console.log('✅ No payment lines posting to income accounts were found.');
      return;
    }

    const withResolvedTarget = rows.map((r) => ({
      ...r,
      effective_target_gl_id: r.target_gl_id || TARGET_GL_ID || null,
    }));

    const withoutTarget = withResolvedTarget.filter((r) => !r.effective_target_gl_id);
    const withTarget = withResolvedTarget.filter((r) => r.effective_target_gl_id);

    console.log(`Found ${rows.length} misposted lines.`);
    if (withoutTarget.length) {
      console.log(
        `⚠️ ${withoutTarget.length} line(s) have no operating bank GL mapped (property.operating_bank_gl_account_id is null). These must be fixed manually.`,
      );
      withoutTarget.slice(0, 5).forEach((r) =>
        console.log(
          `  - tl_id=${r.tl_id} txn=${r.transaction_id} lease=${r.lease_id} bad_gl=${r.bad_gl_name}`,
        ),
      );
    }

    if (dryRun) {
      console.log(
        `DRY_RUN enabled. ${withTarget.length} line(s) would be updated to their property's operating bank GL.`,
      );
      return;
    }

    let updated = 0;
    for (const row of withTarget) {
      await pool.query(
        `
        update transaction_lines
        set gl_account_id = $1,
            posting_type = 'debit'
        where id = $2;
      `,
        [row.effective_target_gl_id, row.tl_id],
      );
      updated += 1;
    }

    console.log(`✅ Updated ${updated} line(s) to the operating bank GL and set posting_type='debit'.`);
    if (withoutTarget.length) {
      console.log(
        `⚠️ Skipped ${withoutTarget.length} line(s) without a mapped operating bank GL; fix those manually.`,
      );
    }
  } finally {
    await pool.end();
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
