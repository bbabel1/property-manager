import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env' });

interface IndexUsageRow {
  schemaname: string;
  table_name: string;
  index_name: string;
  idx_scan: number;
  idx_tup_read: number;
  idx_tup_fetch: number;
  index_size_bytes: number;
  index_size_pretty: string;
  indisunique: boolean;
  indisprimary: boolean;
}

interface IndexUsageReport {
  generatedAt: string;
  database: string;
  indexes: (IndexUsageRow & { candidateUnused: boolean })[];
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // eslint-disable-next-line no-console
    console.error('DATABASE_URL is required to run report-index-usage.ts');
    process.exit(1);
  }
  return url;
}

async function fetchIndexUsage(client: Client): Promise<IndexUsageRow[]> {
  const res = await client.query<IndexUsageRow>(
    `
    SELECT
      s.schemaname,
      s.relname AS table_name,
      s.indexrelname AS index_name,
      s.idx_scan,
      s.idx_tup_read,
      s.idx_tup_fetch,
      pg_relation_size(s.indexrelid) AS index_size_bytes,
      pg_size_pretty(pg_relation_size(s.indexrelid)) AS index_size_pretty,
      ix.indisunique,
      ix.indisprimary
    FROM pg_stat_user_indexes s
    JOIN pg_index ix ON ix.indexrelid = s.indexrelid
    WHERE s.schemaname IN ('public')
    ORDER BY s.idx_scan DESC, index_size_bytes DESC;
  `
  );
  return res.rows;
}

async function main() {
  const databaseUrl = requireDatabaseUrl();
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    const rows = await fetchIndexUsage(client);
    const dbRes = await client.query<{ current_database: string }>('SELECT current_database()');
    const currentDb = dbRes.rows[0]?.current_database;

    const indexes = rows.map((row) => ({
      ...row,
      candidateUnused:
        row.idx_scan === 0 && !row.indisprimary && !row.indisunique && row.schemaname === 'public',
    }));

    const report: IndexUsageReport = {
      generatedAt: new Date().toISOString(),
      database: currentDb,
      indexes,
    };

    const outDir = path.join('docs', 'database');
    const outFile = path.join(outDir, 'index-usage-report.json');

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n', 'utf8');

    // eslint-disable-next-line no-console
    console.log(`Index usage report written to ${outFile}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error while generating index usage report:', err);
  process.exit(1);
});

