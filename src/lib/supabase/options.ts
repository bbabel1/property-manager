import { safeSupabaseFetch } from './safe-fetch';

export const SUPABASE_CLIENT_INFO = 'property-manager@1.0.0';

export const supabaseGlobalOptions = {
  headers: {
    'x-client-info': SUPABASE_CLIENT_INFO,
  },
  fetch: safeSupabaseFetch,
} as const;
