"use client"

import { createBrowserClient } from "@supabase/ssr"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

// Returns a browser-side Supabase client configured for cookie-based auth
export function getSupabaseBrowserClient() {
  // Persist session in cookies so middleware and server can read it
  const cookies = {
    get(name: string) {
      if (typeof document === 'undefined') return undefined
      const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'))
      return match ? decodeURIComponent(match[1]) : undefined
    },
    set(name: string, value: string, options?: { maxAge?: number; expires?: string | number | Date; path?: string; domain?: string; secure?: boolean }) {
      if (typeof document === 'undefined') return
      let cookie = `${name}=${encodeURIComponent(value)}`
      cookie += `; Path=${options?.path || '/'}`
      cookie += '; SameSite=Lax'
      if (options?.maxAge) cookie += `; Max-Age=${options.maxAge}`
      if (options?.expires) cookie += `; Expires=${new Date(options.expires).toUTCString()}`
      if (options?.domain) cookie += `; Domain=${options.domain}`
      if (options?.secure ?? (location.protocol === 'https:')) cookie += '; Secure'
      document.cookie = cookie
    },
    remove(name: string, options?: { path?: string; domain?: string }) {
      if (typeof document === 'undefined') return
      let cookie = `${name}=; Path=${options?.path || '/'}`
      cookie += '; Max-Age=0; SameSite=Lax'
      if (options?.domain) cookie += `; Domain=${options.domain}`
      document.cookie = cookie
    },
  }
  return createBrowserClient(url, anon, { cookies })
}
