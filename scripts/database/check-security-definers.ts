import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env' });

interface DefinerRow {
  schema: string;
  name: string;
  args: string;
  proconfig: string[] | null;
}

interface DefinerReportEntry extends DefinerRow {
  hasPinnedSearchPath: boolean;
}

interface DefinerReport {
  generatedAt: string;
  database: string;
  definers: DefinerReportEntry[];
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // eslint-disable-next-line no-console
    console.error(
      'DATABASE_URL is required to run check-security-definers.ts (e.g. postgres://user:pass@host:port/dbname)'
    );
    process.exit(1);
  }
  return url;
}

async function fetchSecurityDefiners(client: Client): Promise<DefinerRow[]> {
  const res = await client.query<DefinerRow>(
    `
    SELECT
      n.nspname AS schema,
      p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS args,
      p.proconfig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef = true
      AND n.nspname = 'public'
    ORDER BY n.nspname, p.proname, pg_get_function_identity_arguments(p.oid);
    `
  );
  return res.rows;
}

function hasPinnedSearchPath(proconfig: string[] | null): boolean {
  if (!proconfig || !Array.isArray(proconfig)) return false;
  return proconfig.some((c) => c.startsWith('search_path='));
}

async function main() {
  const databaseUrl = requireDatabaseUrl();
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    const definers = await fetchSecurityDefiners(client);
    const dbRes = await client.query<{ current_database: string }>('SELECT current_database()');
    const currentDb = dbRes.rows[0]?.current_database;

    const entries: DefinerReportEntry[] = definers.map((row) => ({
      ...row,
      hasPinnedSearchPath: hasPinnedSearchPath(row.proconfig),
    }));

    const report: DefinerReport = {
      generatedAt: new Date().toISOString(),
      database: currentDb,
      definers: entries,
    };

    const outDir = path.join('docs', 'database');
    const outFile = path.join(outDir, 'security-definers-report.json');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n', 'utf8');

    // eslint-disable-next-line no-console
    console.log(`Security definer report written to ${outFile}`);

    const offenders = entries.filter((e) => !e.hasPinnedSearchPath);
    if (offenders.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        'Found SECURITY DEFINER functions without pinned search_path in proconfig:'
      );
      for (const f of offenders) {
        // eslint-disable-next-line no-console
        console.error(`  - ${f.schema}.${f.name}(${f.args})`);
      }
      process.exit(1);
    } else {
      // eslint-disable-next-line no-console
      console.log('All SECURITY DEFINER functions in public have pinned search_path.');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error while checking SECURITY DEFINER functions:', err);
  process.exit(1);
});

