"use client"

import { createBrowserClient } from "@supabase/ssr"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Returns a browser-side Supabase client configured for cookie-based auth
export function getSupabaseBrowserClient() {
  return createBrowserClient(url, anon)
}

