import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { AppRole, hasRole } from './roles';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function requireAuth() {
  // NOTE: TEST_AUTH_BYPASS is disabled - it was causing issues with invalid UUIDs
  // If you need to bypass auth for testing, use real Supabase authentication instead
  // The test mode bypass was returning fake user IDs that broke database queries
  // if (process.env.TEST_AUTH_BYPASS === 'true') {
  //   // Even in test mode, use real authentication
  // }

  const jar = await cookies();
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return jar.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  const roles = ((user.app_metadata as any)?.claims?.roles ?? []) as AppRole[];
  return { supabase, user, roles };
}

export async function requireRole(required: AppRole | AppRole[]) {
  const { supabase, user, roles } = await requireAuth();
  if (!hasRole(roles, required)) throw new Error('FORBIDDEN');
  return { supabase, user, roles };
}

export async function requireOrg(orgId: string) {
  const { supabase, user } = await requireAuth();
  const orgs = ((user.app_metadata as any)?.claims?.org_ids ?? []) as string[];
  if (!orgs.includes(orgId)) throw new Error('ORG_FORBIDDEN');
  return { supabase, user, orgId };
}
