import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/database"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

/**
 * Shared client options to optimize connection reuse and reduce catalog queries.
 * See src/lib/db.ts for details.
 */
const sharedClientOptions = {
  db: {
    schema: 'public',
  },
  global: {
    headers: {
      'x-client-info': 'property-manager@1.0.0',
    },
  },
} as const;

// Server-side Supabase client for RSC/route handlers.
// Note: In Server Components we cannot set cookies; setters are no-ops.
export async function getSupabaseServerClient() {
  const store = await cookies()
  return createServerClient<Database>(url, anon, {
    ...sharedClientOptions,
    cookies: {
      get(name: string) {
        return store.get(name)?.value
      },
      // In server components, cookie mutation is not supported
      set() {},
      remove() {},
    },
  })
}
