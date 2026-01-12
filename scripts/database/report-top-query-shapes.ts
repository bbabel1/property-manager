import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

loadEnv({ path: '.env' });

interface QueryStat {
  queryid: string | null;
  query: string;
  calls: number;
  total_time_ms: number;
  mean_time_ms: number;
  rows: number;
}

interface QueryShape {
  queryid: string | null;
  calls: number;
  totalTimeMs: number;
  meanTimeMs: number;
  rows: number;
  tables: string[];
  joins: string[];
  where?: string;
  orderBy?: string;
  rawQuery: string;
}

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // Intentionally fail fast – this script is meant to be pointed at a
    // specific environment (local/stage/prod) via DATABASE_URL.
    // Example:
    //   DATABASE_URL=postgresql://... npx tsx scripts/database/report-top-query-shapes.ts
    // or use supabase status output to construct a DSN.
    // eslint-disable-next-line no-console
    console.error('DATABASE_URL is required to run report-top-query-shapes.ts');
    process.exit(1);
  }
  return url;
}

function extractBetween(
  sql: string,
  startKeyword: string,
  endKeywords: string[]
): string | undefined {
  const upper = sql.toUpperCase();
  const startIdx = upper.indexOf(startKeyword);
  if (startIdx === -1) return undefined;

  const afterStart = startIdx + startKeyword.length;
  let endIdx = sql.length;

  for (const end of endKeywords) {
    const idx = upper.indexOf(end, afterStart);
    if (idx !== -1 && idx < endIdx) {
      endIdx = idx;
    }
  }

  return sql.slice(afterStart, endIdx).trim() || undefined;
}

function extractTablesAndJoins(sql: string): { tables: string[]; joins: string[] } {
  const upper = sql.toUpperCase();
  const fromIdx = upper.indexOf('FROM ');
  const tables: string[] = [];
  const joins: string[] = [];

  if (fromIdx !== -1) {
    const afterFrom = sql.slice(fromIdx + 5);
    const stopIdxCandidates = [' WHERE ', ' GROUP BY ', ' ORDER BY ', ' LIMIT ']
      .map((kw) => {
        const idx = afterFrom.toUpperCase().indexOf(kw);
        return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
      });
    const stopIdx = Math.min(...stopIdxCandidates);
    const fromSegment = afterFrom.slice(0, stopIdx);

    const tableMatch = fromSegment
      .split(',')
      .map((part) => part.trim().split(/\s+/)[0]?.replace(/["]/g, ''))
      .filter(Boolean);
    tables.push(...tableMatch);
  }

  const joinRe = /JOIN\s+([a-zA-Z0-9_."]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = joinRe.exec(sql))) {
    const name = m[1]?.replace(/["]/g, '');
    if (name) joins.push(name);
  }

  return { tables, joins };
}

async function fetchTopQueries(client: Client): Promise<QueryStat[]> {
  const res = await client.query<QueryStat>(
    `
    SELECT
      queryid::text,
      query,
      calls,
      (total_exec_time + total_plan_time) AS total_time_ms,
      CASE
        WHEN calls > 0 THEN (total_exec_time + total_plan_time) / calls
        ELSE 0
      END AS mean_time_ms,
      rows
    FROM pg_stat_statements
    WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
    ORDER BY (total_exec_time + total_plan_time) DESC
    LIMIT 100;
  `
  );
  return res.rows;
}

function buildShapes(stats: QueryStat[], limit = 20): QueryShape[] {
  const shapes: QueryShape[] = [];

  for (const row of stats.slice(0, limit)) {
    const sql = row.query.trim();
    const { tables, joins } = extractTablesAndJoins(sql);

    const where = extractBetween(sql, 'WHERE ', [' GROUP BY ', ' ORDER BY ', ' LIMIT ']);
    const orderBy = extractBetween(sql, 'ORDER BY ', [' LIMIT ']);

    shapes.push({
      queryid: row.queryid,
      calls: row.calls,
      totalTimeMs: row.total_time_ms,
      meanTimeMs: row.mean_time_ms,
      rows: row.rows,
      tables: Array.from(new Set(tables)),
      joins: Array.from(new Set(joins)),
      where,
      orderBy,
      rawQuery: sql,
    });
  }

  return shapes;
}

async function main() {
  const databaseUrl = requireDatabaseUrl();
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();
  try {
    const stats = await fetchTopQueries(client);
    const shapes = buildShapes(stats, 20);

    const report = {
      generatedAt: new Date().toISOString(),
      database: (await client.query<{ current_database: string }>('SELECT current_database()')).rows[0]
        .current_database,
      totalQueriesConsidered: stats.length,
      top: shapes,
    };

    const outDir = path.join('docs', 'database');
    const outFile = path.join(outDir, 'top-query-shapes.json');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + '\n', 'utf8');

    // eslint-disable-next-line no-console
    console.log(`Top query shapes written to ${outFile}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Error while generating top query shapes report:', err);
  process.exit(1);
});

