import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

type MatchRecord = {
  file: string;
  line: number;
  column: number;
  matchText: string;
  lineText: string;
};

type PatternConfig = {
  name: string;
  group: 'supabase' | 'sql_verb' | 'identifier';
  description: string;
  rgPattern: string;
  caseInsensitive?: boolean;
};

type PatternResult = {
  name: string;
  group: PatternConfig['group'];
  description: string;
  rgPattern: string;
  caseInsensitive: boolean;
  matches: MatchRecord[];
  matchCount: number;
  fileCount: number;
};

type UsageScanReport = {
  generatedAt: string;
  rootDirs: string[];
  tool: {
    name: string;
    version?: string;
  };
  patterns: PatternResult[];
};

const ROOT_DIRS = ['src', 'scripts'];

const PATTERNS: PatternConfig[] = [
  // Supabase query helpers
  {
    name: 'supabase_from_calls',
    group: 'supabase',
    description: 'Supabase from() table accessors',
    rgPattern: '\\.from\\(',
  },
  {
    name: 'supabase_rpc_calls',
    group: 'supabase',
    description: 'Supabase rpc() function calls',
    rgPattern: '\\.rpc\\(',
  },

  // Raw SQL verbs (case-insensitive)
  {
    name: 'sql_select',
    group: 'sql_verb',
    description: 'SQL SELECT statements',
    rgPattern: '\\bselect\\b',
    caseInsensitive: true,
  },
  {
    name: 'sql_insert',
    group: 'sql_verb',
    description: 'SQL INSERT statements',
    rgPattern: '\\binsert\\b',
    caseInsensitive: true,
  },
  {
    name: 'sql_update',
    group: 'sql_verb',
    description: 'SQL UPDATE statements',
    rgPattern: '\\bupdate\\b',
    caseInsensitive: true,
  },
  {
    name: 'sql_delete',
    group: 'sql_verb',
    description: 'SQL DELETE statements',
    rgPattern: '\\bdelete\\b',
    caseInsensitive: true,
  },

  // Common identifiers for future "unused" analysis
  {
    name: 'tenant_id',
    group: 'identifier',
    description: 'Usages of tenant_id',
    rgPattern: 'tenant_id',
  },
  {
    name: 'property_id',
    group: 'identifier',
    description: 'Usages of property_id',
    rgPattern: 'property_id',
  },
  {
    name: 'unit_id',
    group: 'identifier',
    description: 'Usages of unit_id',
    rgPattern: 'unit_id',
  },
  {
    name: 'owner_id',
    group: 'identifier',
    description: 'Usages of owner_id',
    rgPattern: 'owner_id',
  },
  {
    name: 'bank_account_id',
    group: 'identifier',
    description: 'Usages of bank_account_id',
    rgPattern: 'bank_account_id',
  },
  {
    name: 'gl_account_id',
    group: 'identifier',
    description: 'Usages of gl_account_id',
    rgPattern: 'gl_account_id',
  },
  {
    name: 'buildium_property_id',
    group: 'identifier',
    description: 'Usages of buildium_property_id',
    rgPattern: 'buildium_property_id',
  },
  {
    name: 'buildium_lease_id',
    group: 'identifier',
    description: 'Usages of buildium_lease_id',
    rgPattern: 'buildium_lease_id',
  },
];

function ensureRgAvailable(): string | undefined {
  const result = spawnSync('rg', ['--version'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    console.error('Error: ripgrep (rg) is required but was not found in PATH.');
    console.error('Install ripgrep and re-run this script.');
    process.exitCode = 1;
    return undefined;
  }

  const versionLine = (result.stdout || '').split('\n')[0]?.trim();
  return versionLine;
}

function runRg(pattern: PatternConfig): PatternResult {
  const args = ['--json'];
  if (pattern.caseInsensitive) {
    args.push('-i');
  }
  args.push(pattern.rgPattern, ...ROOT_DIRS);

  const result = spawnSync('rg', args, {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    console.error(`Failed to run rg for pattern "${pattern.name}":`, result.error);
    process.exitCode = 1;
    return {
      name: pattern.name,
      group: pattern.group,
      description: pattern.description,
      rgPattern: pattern.rgPattern,
      caseInsensitive: Boolean(pattern.caseInsensitive),
      matches: [],
      matchCount: 0,
      fileCount: 0,
    };
  }

  if (result.status !== 0 && result.status !== 1) {
    // Status 1 is "no matches" which is fine
    console.error(`rg exited with status ${result.status} for pattern "${pattern.name}".`);
  }

  const matches: MatchRecord[] = [];
  const files = new Set<string>();

  const lines = (result.stdout || '').split('\n').filter(Boolean);
  for (const line of lines) {
    let parsed: any;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    if (parsed.type !== 'match') continue;

    const data = parsed.data;
    const filePath: string = data.path?.text;
    const lineNumber: number = data.line_number;
    const lineText: string = data.lines?.text ?? '';

    if (!filePath || typeof lineNumber !== 'number') continue;

    if (data.submatches && data.submatches.length > 0) {
      for (const sub of data.submatches) {
        const column = typeof sub.start === 'number' ? sub.start + 1 : 1;
        const matchText: string = sub.match?.text ?? pattern.rgPattern;

        matches.push({
          file: filePath,
          line: lineNumber,
          column,
          matchText,
          lineText: lineText.trimEnd(),
        });
      }
    } else {
      matches.push({
        file: filePath,
        line: lineNumber,
        column: 1,
        matchText: pattern.rgPattern,
        lineText: lineText.trimEnd(),
      });
    }

    files.add(filePath);
  }

  return {
    name: pattern.name,
    group: pattern.group,
    description: pattern.description,
    rgPattern: pattern.rgPattern,
    caseInsensitive: Boolean(pattern.caseInsensitive),
    matches,
    matchCount: matches.length,
    fileCount: files.size,
  };
}

function main() {
  const repoRoot = process.cwd();
  const rgVersion = ensureRgAvailable();

  const results: PatternResult[] = PATTERNS.map((pattern) => runRg(pattern));

  const report: UsageScanReport = {
    generatedAt: new Date().toISOString(),
    rootDirs: ROOT_DIRS,
    tool: {
      name: 'rg',
      version: rgVersion,
    },
    patterns: results,
  };

  const outputDir = path.join(repoRoot, 'docs', 'database');
  const outputFile = path.join(outputDir, 'db-usage-scan.json');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(`DB usage scan complete. Report written to ${path.relative(repoRoot, outputFile)}`);
}

main();

