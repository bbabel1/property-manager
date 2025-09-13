import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { AppRole, hasRole } from './roles'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function requireAuth() {
  const jar = await cookies()
  const supabase = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return jar.get(name)?.value
      },
      set() {},
      remove() {},
    },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('UNAUTHENTICATED')
  return { supabase, user }
}

export async function requireRole(required: AppRole | AppRole[]) {
  const { supabase, user } = await requireAuth()
  const roles = ((user.app_metadata as any)?.claims?.roles ?? []) as AppRole[]
  if (!hasRole(roles, required)) throw new Error('FORBIDDEN')
  return { supabase, user, roles }
}

export async function requireOrg(orgId: string) {
  const { supabase, user } = await requireAuth()
  const orgs = ((user.app_metadata as any)?.claims?.org_ids ?? []) as string[]
  if (!orgs.includes(orgId)) throw new Error('ORG_FORBIDDEN')
  return { supabase, user, orgId }
}
