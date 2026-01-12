import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env' });

type RlsPredicateRow = {
  tablename: string;
  policyname: string;
  qual: string | null;
  with_check: string | null;
};

type RlsIndexRow = {
  table_name: string;
  column_name: string;
};

interface RlsPredicateIndexReport {
  generatedAt: string;
  database: string;
  predicates: {
    table: string;
    policy: string;
    qual?: string;
    withCheck?: string;
    referencedColumns: string[];
  }[];
  indexedColumns: RlsIndexRow[];
  missingIndexes: RlsIndexRow[];
}

const SCOPE_COLUMN_CANDIDATES = [
  'org_id',
  'tenant_id',
  'owner_id',
  'property_id',
  'bank_account_id',
  'account_id',
];

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // eslint-disable-next-line no-console
    console.error('DATABASE_URL is required to run report-rls-predicate-indexes.ts');
    process.exit(1);
  }
  return url;
}

async function fetchRlsPredicates(client: Client): Promise<RlsPredicateRow[]> {
  const res = await client.query<RlsPredicateRow>(
    `
    SELECT
      tablename,
      policyname,
      qual::text,
      with_check::text
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
  `
  );
  return res.rows;
}

async function fetchIndexedColumns(client: Client): Promise<RlsIndexRow[]> {
  const res = await client.query<RlsIndexRow>(
    `
    WITH idx_cols AS (
      SELECT
        ix.indrelid::regclass AS table_name,
        unnest(ix.indkey) AS col_attnum
      FROM pg_index ix
      JOIN pg_class c ON c.oid = ix.indrelid
      WHERE c.relnamespace = 'public'::regnamespace
        AND ix.indisvalid
    )
    SELECT
      ic.table_name::text AS table_name,
      a.attname AS column_name
    FROM idx_cols ic
    JOIN pg_attribute a
      ON a.attrelid = ic.table_name
     AND a.attnum = ic.col_attnum
    WHERE a.attnum > 0
    GROUP BY ic.table_name, a.attname
    ORDER BY ic.table_name::text, a.attname;
  `
  );
  return res.rows;
}

function extractReferencedColumns(sql: string | null): string[] {
  if (!sql) return [];
  const refs = new Set<string>();
  for (const col of SCOPE_COLUMN_CANDIDATES) {
    const re = new RegExp(`\\b${col}\\b`, 'i');
    if (re.test(sql)) refs.add(col);
  }
  return Array.from(refs);
}

async function main() {
  const databaseUrl = requireDatabaseUrl();
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    const [predicates, indexedCols] = await Promise.all([
      fetchRlsPredicates(client),
      fetchIndexedColumns(client),
    ]);

    const dbRes = await client.query<{ current_database: string }>('SELECT current_database()');
    const currentDb = dbRes.rows[0]?.current_database;

    const predicateSummaries = predicates
      .map((row) => {
        const cols = new Set<string>();
        extractReferencedColumns(row.qual).forEach((c) => cols.add(c));
        extractReferencedColumns(row.with_check).forEach((c) => cols.add(c));
        return {
          table: row.tablename,
          policy: row.policyname,
          qual: row.qual || undefined,
          withCheck: row.with_check || undefined,
          referencedColumns: Array.from(cols),
        };
      })
      .filter((p) => p.referencedColumns.length > 0);

    const indexedSet = new Set(indexedCols.map((r) => `${r.table_name}.${r.column_name}`));

    const missing: RlsIndexRow[] = [];
    for (const p of predicateSummaries) {
      for (const col of p.referencedColumns) {
        const key = `${p.table}.${col}`;
        if (!indexedSet.has(key)) {
          missing.push({ table_name: p.table, column_name: col });
        }
      }
    }

    const report: RlsPredicateIndexReport = {
      generatedAt: new Date().toISOString(),
      database: currentDb,
      predicates: predicateSummaries,
      indexedColumns: indexedCols,
      missingIndexes: missing,
    };

    const outDir = path.join('docs', 'database');
    const outFile = path.join(outDir, 'rls-predicate-indexes.json');

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n', 'utf8');

    // eslint-disable-next-line no-console
    console.log(`RLS predicate index report written to ${outFile}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error while generating RLS predicate index report:', err);
  process.exit(1);
});

