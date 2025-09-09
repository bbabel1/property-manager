#!/usr/bin/env bash
set -euo pipefail

echo "==> Pushing migrations to local database"
if ! supabase db push --local --include-all --yes; then
  echo "⚠️  Local push failed. Ensure local Supabase is running (supabase start)." >&2
fi

echo "==> Pushing migrations to remote database"
if [[ -n "${SUPABASE_DB_PASSWORD:-}" ]]; then
  supabase db push --include-all --yes --password "$SUPABASE_DB_PASSWORD"
else
  echo "No SUPABASE_DB_PASSWORD env var set; falling back to interactive prompt..." >&2
  supabase db push --include-all --yes
fi

echo "✅ Done"

