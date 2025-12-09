/**
 * Lightweight validation script for service catalog migration.
 * Checks for overlapping pricing windows, duplicate billing events, and missing rent_basis on percent_rent.
 */
import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';

async function main() {
  const overlaps = await supabaseAdmin.rpc('check_property_service_pricing_overlap');
  if (overlaps.error) {
    logger.error({ error: overlaps.error }, 'Overlap check failed');
  } else if ((overlaps.data || []).length > 0) {
    logger.warn({ count: overlaps.data.length }, 'Found overlapping pricing records');
  }

  const duplicates = await supabaseAdmin.rpc('check_duplicate_billing_events');
  if (duplicates.error) {
    logger.error({ error: duplicates.error }, 'Duplicate billing event check failed');
  } else if ((duplicates.data || []).length > 0) {
    logger.warn({ count: duplicates.data.length }, 'Found duplicate billing events');
  }

  const missingRentBasis = await supabaseAdmin
    .from('property_service_pricing')
    .select('id')
    .eq('billing_basis', 'percent_rent')
    .is('rent_basis', null)
    .limit(10);
  if (missingRentBasis.error) {
    logger.error({ error: missingRentBasis.error }, 'Missing rent_basis check failed');
  } else if ((missingRentBasis.data || []).length > 0) {
    logger.warn({ count: missingRentBasis.data.length }, 'percent_rent without rent_basis');
  }
}

main().catch((err) => {
  logger.error({ err }, 'Validation script failed');
  process.exit(1);
});
