#!/usr/bin/env node

/**
 * Route risk gate:
 * - Fails if a route uses `supabaseAdmin || supabase`
 * - Fails if authentication is conditional on service role (`if (!hasSupabaseAdmin()) await requireAuth()`)
 * - Fails if a DB-touching route lacks an auth guard (requireAuth/requireUser/requireRole),
 *   except for an explicit allowlist of public callbacks/webhooks/csrf.
 */

const fs = require('fs');
const path = require('path');

const ALLOWLIST = [
  /src\/app\/api\/webhooks\//,
  /src\/app\/api\/auth\/[^/]+\/callback\/route\.ts$/,
  /src\/app\/api\/csrf\/route\.ts$/,
];

const ROOT = path.join(__dirname, '..', 'src', 'app', 'api');

const issues = [];

const isAllowlisted = (filePath) => ALLOWLIST.some((re) => re.test(filePath));

const readRoutes = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      readRoutes(fullPath);
    } else if (entry.isFile() && entry.name === 'route.ts') {
      checkFile(fullPath);
    }
  }
};

const touchesDb = (content) =>
  /\bsupabase\b|\bsupabaseAdmin\b|\.from\s*\(/.test(content);

const hasAuthGuard = (content) =>
  /requireAuth|requireUser|requireRole/.test(content);

const checkFile = (filePath) => {
  const relative = path.relative(path.join(__dirname, '..'), filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');

  if (isAllowlisted(relative)) {
    return;
  }

  if (content.includes('supabaseAdmin || supabase')) {
    issues.push(`${relative}: uses "supabaseAdmin || supabase" fallback`);
  }

  const conditionalAuthPattern =
    /if\s*\(\s*!\s*hasSupabaseAdmin\s*\(\s*\)\s*\)\s*{?\s*await\s+requireAuth/;
  if (conditionalAuthPattern.test(content)) {
    issues.push(`${relative}: auth depends on service-role availability (hasSupabaseAdmin guard)`);
  }

  if (touchesDb(content) && !hasAuthGuard(content)) {
    issues.push(`${relative}: touches DB without requireAuth/requireUser/requireRole guard`);
  }
};

readRoutes(ROOT);

if (issues.length) {
  console.error('Route risk check failed:');
  for (const issue of issues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
} else {
  console.log('Route risk check passed: no unsafe patterns found.');
}

