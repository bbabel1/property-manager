import { NextResponse } from 'next/server'
import type { TypedSupabaseClient } from '@/lib/db'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'

const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

const uniqueSlug = async (name: string, admin: TypedSupabaseClient): Promise<string> => {
  const base = slugify(name) || `org-${Date.now()}`
  let slug = base

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin
      .from('organizations')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (error) {
      if (!error.code || error.code !== 'PGRST116') {
        throw error
      }
    }

    if (!data) return slug

    const randomSuffix = Math.random().toString(36).slice(2, 8)
    slug = `${base}-${randomSuffix}`
  }

  return `${base}-${Date.now()}`
}

export async function GET() {
  try {
    await requireRole('platform_admin')
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }
    const supabaseAdmin = requireSupabaseAdmin('list organizations')
    const { data, error } = await supabaseAdmin.from('organizations').select('id, name').order('name')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ organizations: data || [] })
  } catch (e: unknown) {
    const error = e as { message?: string }
    const msg = error?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: Request) {
  try {
    await requireRole('platform_admin')
    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }
    const supabaseAdmin = requireSupabaseAdmin('create organization')
    const body = await request.json().catch(() => null)
    const name = body?.name?.trim()
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

    const slug = await uniqueSlug(name, supabaseAdmin)

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .insert({ name, slug })
      .select('id, name, slug')
      .single()

    if (error) {
      const isDuplicate = error.code === '23505' || /duplicate key value/i.test(error.message || '')
      if (isDuplicate) {
        const fallbackSlug = `${slug}-${Math.random().toString(36).slice(2, 6)}`
        const retry = await supabaseAdmin
          .from('organizations')
          .insert({ name, slug: fallbackSlug })
          .select('id, name, slug')
          .single()
        if (retry.error) {
          return NextResponse.json({ error: retry.error.message }, { status: 500 })
        }
        return NextResponse.json({ organization: retry.data })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ organization: data })
  } catch (e: unknown) {
    const error = e as { message?: string }
    const msg = error?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
