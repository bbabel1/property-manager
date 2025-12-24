import { supabaseAdmin } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Refresh service-level materialized views for profitability dashboards.
 * Intended to run on a monthly cadence after billing_events are generated.
 */
export async function refreshServiceMetricsViews(): Promise<void> {
  const views = [
    'v_service_revenue_by_property',
    'v_service_revenue_by_unit',
    'v_service_revenue_by_owner',
    'v_service_revenue_by_offering',
    'v_service_costs',
    'v_service_profitability',
  ];

  for (const view of views) {
    const { error } = await supabaseAdmin.rpc('refresh_mat_view_concurrently', {
      view_name: view,
    });
    if (error) {
      logger.error({ error, view }, 'Failed to refresh materialized view');
      // Continue to attempt other views rather than failing the entire job
    }
  }
}

export default async function handler(): Promise<void> {
  await refreshServiceMetricsViews();
}
