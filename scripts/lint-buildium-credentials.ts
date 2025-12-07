/**
 * Buildium credential lint
 *
 * Fails if `process.env.BUILDIUM` is referenced outside the central
 * credentials manager (or explicit allowlists).
 *
 * - Uses a baseline file to avoid blocking existing legacy call sites.
 * - New occurrences outside the baseline fail the lint.
 * - Resolved baseline entries are reported so we can trim the list as we migrate.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const BASELINE_PATH = path.join(__dirname, 'lint-buildium-credentials-baseline.txt');

// Files that are allowed to touch process.env.BUILDIUM directly.
const ALWAYS_ALLOW = new Set<string>([
  'src/lib/buildium/credentials-manager.ts',
]);

const TARGET_DIRS = ['src', 'supabase', 'scripts'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORED_DIRS = new Set([
  'node_modules',
  '.next',
  '.turbo',
  '.vercel',
  '.git',
  '.cache',
  'coverage',
  'dist',
  'build',
]);

type Violation = {
  file: string;
  lines: number[];
};

const pattern = /process\.env\.BUILDIUM/;

function readBaseline(): Set<string> {
  if (!fs.existsSync(BASELINE_PATH)) return new Set();
  const contents = fs.readFileSync(BASELINE_PATH, 'utf8');
  return new Set(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );
}

function isIgnoredDir(dir: string): boolean {
  return IGNORED_DIRS.has(path.basename(dir));
}

function collectFiles(): string[] {
  const files: string[] = [];

  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (isIgnoredDir(fullPath)) continue;
        walk(fullPath);
        continue;
      }

      const ext = path.extname(entry.name);
      if (!EXTENSIONS.has(ext)) continue;
      files.push(fullPath);
    }
  };

  for (const dir of TARGET_DIRS) {
    const absolute = path.join(ROOT, dir);
    if (fs.existsSync(absolute)) {
      walk(absolute);
    }
  }

  return files;
}

function findViolations(files: string[]): Violation[] {
  const results: Violation[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    if (!pattern.test(raw)) continue;

    const lines: number[] = [];
    raw.split(/\r?\n/).forEach((line, idx) => {
      if (pattern.test(line)) {
        lines.push(idx + 1);
      }
    });

    const relative = path.relative(ROOT, file).replace(/\\/g, '/');
    if (ALWAYS_ALLOW.has(relative)) continue;

    results.push({ file: relative, lines });
  }

  return results;
}

function main() {
  const baseline = readBaseline();
  const files = collectFiles();
  const violations = findViolations(files);
  const violationSet = new Set(violations.map((v) => v.file));

  const unexpected = violations.filter((v) => !baseline.has(v.file));
  const resolved = [...baseline].filter(
    (entry) => !violationSet.has(entry) && !ALWAYS_ALLOW.has(entry),
  );

  if (unexpected.length) {
    console.error('❌ Found disallowed Buildium env usage outside the credentials manager:');
    unexpected.forEach((v) => {
      console.error(` - ${v.file}:${v.lines.join(',')}`);
    });
    console.error(
      '\nAdd to scripts/lint-buildium-credentials-baseline.txt only if this is an existing legacy path; otherwise, migrate to the credentials manager.',
    );
    process.exit(1);
  }

  if (resolved.length) {
    console.log('ℹ️  Buildium env usage removed from baseline entries (please prune baseline when convenient):');
    resolved.forEach((entry) => console.log(` - ${entry}`));
  }

  console.log(
    `✅ Buildium credential lint passed. Checked ${violations.length} current violations (baseline ${baseline.size}).`,
  );
}

main();
