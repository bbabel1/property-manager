#!/bin/bash
# Push migrations to Supabase
# Run this from your local machine: bash push-migrations.sh

PROJECT_REF="cidfgplknvueaivsxiqa"
PASSWORD="@2Tampa2015"

# Encode password for URL
ENCODED_PASS=$(node -e "console.log(encodeURIComponent('$PASSWORD'))" 2>/dev/null || python3 -c "import urllib.parse; print(urllib.parse.quote('$PASSWORD'))" 2>/dev/null || echo "%402Tampa2015")

# Construct DB URL
DB_URL="postgresql://postgres:${ENCODED_PASS}@db.${PROJECT_REF}.supabase.co:5432/postgres"

echo "🚀 Pushing migrations to Supabase..."
echo "📍 Project: ${PROJECT_REF}"
echo ""

# Push migrations
npx supabase db push --db-url "$DB_URL" --yes

echo ""
echo "✅ Done! Verify with:"
echo "SELECT COUNT(*) FROM transaction_lines WHERE account_entity_type IS NULL;"
