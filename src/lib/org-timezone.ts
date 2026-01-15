import { supabaseAdmin } from '@/lib/db';

/**
 * Get organization timezone, defaulting to America/New_York if not configured
 * For now, organizations don't have a timezone setting, so we default to US/Eastern
 * This can be enhanced later to fetch from org settings or user preferences
 */
export async function getOrgTimezone(orgId: string): Promise<string> {
  const defaultTimezone = process.env.DEFAULT_ORG_TIMEZONE || 'America/New_York';
  try {
    // Attempt to read timezone from organizations table if the column exists
    const { data, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();

    const timezone =
      (data as { timezone?: string | null } | null)?.timezone ?? null;

    if (!error && typeof timezone === 'string' && timezone) {
      return timezone;
    }
  } catch {
    // Ignore and fall back
  }
  return defaultTimezone;
}
