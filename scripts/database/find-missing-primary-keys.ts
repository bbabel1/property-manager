import fs from 'fs';
import path from 'path';

type TableInfo = {
  name: string;
  hasPrimaryKey: boolean;
};

function readSchema(): { schemaPath: string; sql: string } {
  const candidates = [
    path.join('supabase', 'schema.sql'),
    path.join('docs', 'database', 'current_schema.sql'),
  ];

  for (const schemaPath of candidates) {
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      return { schemaPath, sql };
    }
  }

  console.error(
    'No schema file found. Expected supabase/schema.sql or docs/database/current_schema.sql.'
  );
  process.exit(1);
}

function collectTablesWithoutPk(sql: string): TableInfo[] {
  const tables: Record<string, TableInfo> = {};

  const createRe =
    /CREATE TABLE\s+"public"\."(\w+)"\s*\(([^;]+?)\);/gms;
  const pkInlineRe = /PRIMARY\s+KEY\s*\(/i;

  let m: RegExpExecArray | null;
  while ((m = createRe.exec(sql))) {
    const name = m[1];
    const body = m[2];
    const hasPk = pkInlineRe.test(body);
    tables[name] = { name, hasPrimaryKey: hasPk };
  }

  const alterPkRe =
    /ALTER TABLE\s+"public"\."(\w+)"\s+ADD CONSTRAINT\s+"[^"]*"\s+PRIMARY\s+KEY\s*\([^)]+\);/gim;

  while ((m = alterPkRe.exec(sql))) {
    const name = m[1];
    const existing = tables[name];
    if (existing) {
      existing.hasPrimaryKey = true;
    } else {
      tables[name] = { name, hasPrimaryKey: true };
    }
  }

  return Object.values(tables).filter((t) => !t.hasPrimaryKey);
}

function main() {
  const { schemaPath, sql } = readSchema();
  const missing = collectTablesWithoutPk(sql);

  if (missing.length === 0) {
    console.log(
      JSON.stringify(
        {
          schemaPath,
          missingPrimaryKeyTables: [],
          message: 'All public tables in schema have primary keys.',
        },
        null,
        2
      )
    );
    return;
  }

  console.log(
    JSON.stringify(
      {
        schemaPath,
        missingPrimaryKeyTables: missing.map((t) => t.name),
      },
      null,
      2
    )
  );
}

main();

