import { supabaseAdmin } from '@/lib/db';

/**
 * Get organization timezone, defaulting to America/New_York if not configured
 * For now, organizations don't have a timezone setting, so we default to US/Eastern
 * This can be enhanced later to fetch from org settings or user preferences
 */
export async function getOrgTimezone(orgId: string): Promise<string> {
  // TODO: When org timezone setting is available, fetch from organizations table
  // For now, default to America/New_York (US/Eastern)
  try {
    // Could query organizations table for timezone if it exists
    // const { data } = await supabaseAdmin
    //   .from('organizations')
    //   .select('timezone')
    //   .eq('id', orgId)
    //   .maybeSingle()
    // return data?.timezone || 'America/New_York'
    return 'America/New_York';
  } catch {
    return 'America/New_York';
  }
}

