#!/usr/bin/env tsx
/**
 * CI guardrail: fail if any direct fetch to Buildium hostnames is detected
 * outside the approved wrapper files.
 */
import { readdir, readFile } from 'fs/promises';
import { join, extname } from 'path';

const BUILDIUM_HOSTNAMES = ['api.buildium.com', 'apisandbox.buildium.com'];
const APPROVED_FILES = [
  'src/lib/buildium-http.ts',
  'supabase/functions/_shared/buildiumFetch.ts',
];
const IGNORED_DIRS = new Set(['node_modules', '.git', '.next', '.turbo', 'dist', 'build']);
const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      files.push(...(await walk(join(dir, entry.name))));
    } else if (entry.isFile()) {
      if (FILE_EXTENSIONS.has(extname(entry.name))) {
        files.push(join(dir, entry.name));
      }
    }
  }
  return files;
}

async function scanFile(filePath: string): Promise<string[]> {
  // Skip approved wrapper files
  if (APPROVED_FILES.some((approved) => filePath.endsWith(approved))) {
    return [];
  }

  const content = await readFile(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const violations: string[] = [];

  lines.forEach((line, index) => {
    const lower = line.toLowerCase();
    const hasFetch = lower.includes('fetch(') || lower.includes('fetch `') || lower.includes('fetch`');
    if (!hasFetch) return;
    for (const host of BUILDIUM_HOSTNAMES) {
      if (line.includes(host)) {
        violations.push(`${filePath}:${index + 1} - Direct Buildium fetch detected`);
        break;
      }
    }
  });

  return violations;
}

async function main() {
  const root = process.cwd();
  const files = await walk(root);
  const violations: string[] = [];

  for (const file of files) {
    const hits = await scanFile(file);
    violations.push(...hits);
  }

  if (violations.length) {
    console.error('Direct Buildium fetch usage detected:\n' + violations.join('\n'));
    process.exit(1);
  } else {
    console.log('✅ No direct Buildium fetch calls found.');
  }
}

main().catch((err) => {
  console.error('Buildium fetch scan failed:', err);
  process.exit(1);
});
