import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Server-side Supabase client for RSC/route handlers.
// Note: In Server Components we cannot set cookies; setters are no-ops.
export async function getSupabaseServerClient() {
  const store = await cookies()
  return createServerClient(url, anon, {
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
