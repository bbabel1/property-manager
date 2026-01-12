import fs from 'node:fs';
import path from 'node:path';

const roots = ['src', 'supabase/functions', 'scripts/buildium'];
const offenders: string[] = [];

function collectFiles(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full);
      continue;
    }
    if (!full.match(/\.(ts|tsx|js|mjs)$/)) continue;
    scanFile(full);
  }
}

function scanFile(file: string) {
  const content = fs.readFileSync(file, 'utf8');
  // Skip if already opt-in to wrapper/guarded helpers
  if (/buildiumFetchEdge|buildiumFetch\(/.test(content) && /x-buildium-egress-allowed/i.test(content)) {
    return;
  }

  const referencesBuildiumHeaders = /x-buildium-client-id/i.test(content) || /X-Buildium-Client-Id/.test(content);
  const hasEgressHeader = /x-buildium-egress-allowed/i.test(content);

  if (referencesBuildiumHeaders && !hasEgressHeader) {
    offenders.push(file);
  }
}

for (const root of roots) {
  if (fs.existsSync(root)) {
    collectFiles(root);
  }
}

if (offenders.length) {
  console.error('Buildium egress guard failure: missing x-buildium-egress-allowed header in:');
  offenders.forEach((file) => console.error(` - ${file}`));
  process.exit(1);
}

console.log('Buildium egress guard check passed.');
