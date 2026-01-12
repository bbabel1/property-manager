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
      .from('organizations' as any)
      .select('timezone')
      .eq('id', orgId)
      .maybeSingle();

    if (!error && data && typeof (data as any).timezone === 'string' && (data as any).timezone) {
      return (data as any).timezone as string;
    }
  } catch {
    // Ignore and fall back
  }
  return defaultTimezone;
}
