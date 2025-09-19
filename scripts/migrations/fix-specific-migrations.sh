#!/bin/bash

# Fix the remaining problematic migration files
set -e

cd "$(dirname "$0")/../.."

echo "🔧 Fixing specific migration naming issues..."

# Fix remaining 20250912_ files
git mv supabase/migrations/20250913_additional_perf_indexes.sql supabase/migrations/20250913000000_077_additional_perf_indexes.sql
git mv supabase/migrations/20250913_performance_indexes.sql supabase/migrations/20250913000001_078_performance_indexes.sql

# Fix 20250914_ files  
git mv supabase/migrations/20250914_property_images.sql supabase/migrations/20250914000001_079_property_images.sql

# Fix 20250915_ files
git mv supabase/migrations/20250915_staff_profile_enum_and_links.sql supabase/migrations/20250915000000_080_staff_profile_enum_and_links.sql
git mv supabase/migrations/20250915b_staff_columns_only.sql supabase/migrations/20250915000001_081_staff_columns_only.sql  
git mv supabase/migrations/20250915c_convert_roles_to_enum.sql supabase/migrations/20250915000002_082_convert_roles_to_enum.sql
git mv supabase/migrations/20250915d_buildium_sync_runs.sql supabase/migrations/20250915000003_083_buildium_sync_runs.sql

# Fix 20250919_ files
git mv supabase/migrations/20250919_add_onetime_to_rent_cycle_enum.sql supabase/migrations/20250919000000_084_add_onetime_to_rent_cycle_enum.sql
git mv supabase/migrations/20250919_constraints_and_indexes.sql supabase/migrations/20250919000001_085_constraints_and_indexes.sql
git mv supabase/migrations/20250919_idempotency_enhancements.sql supabase/migrations/20250919000002_086_idempotency_enhancements.sql
git mv supabase/migrations/20250919_update_fn_create_lease_aggregate_bigint_and_lock.sql supabase/migrations/20250919000003_087_update_fn_create_lease_aggregate_bigint_and_lock.sql
git mv supabase/migrations/20250919_webhook_events_unique.sql supabase/migrations/20250919000004_088_webhook_events_unique.sql

echo "✅ Fixed specific migration naming issues!"
echo "📋 Migration sequence should now be more consistent."
