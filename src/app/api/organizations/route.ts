import { NextRequest, NextResponse } from 'next/server'
import { hasSupabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase-client'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'

const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

const uniqueSlug = async (name: string, admin: ReturnType<typeof requireSupabaseAdmin>): Promise<string> => {
  const base = slugify(name) || `org-${Date.now()}`
  let slug = base

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data, error } = await admin.from('organizations').select('id').eq('slug', slug).maybeSingle()
    if (error && (!error.code || error.code !== 'PGRST116')) {
      throw error
    }
    if (!data) return slug
    const randomSuffix = Math.random().toString(36).slice(2, 6)
    slug = `${base}-${randomSuffix}`
  }

  return `${base}-${Date.now()}`
}

export async function POST(request: NextRequest) {
  try {
    await requireRole('platform_admin')

    if (!hasSupabaseAdmin()) {
      return NextResponse.json({ error: 'Service role not configured' }, { status: 500 })
    }
    const supabaseAdmin = requireSupabaseAdmin('create manager organization')

    const body = await request.json().catch(() => null)
    const rawName = typeof body?.name === 'string' ? body.name : typeof body?.company_name === 'string' ? body.company_name : ''
    const name = rawName.trim()
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const slugInput = typeof body?.slug === 'string' ? body.slug : undefined
    const slug = slugInput && slugInput.trim().length ? slugify(slugInput) : await uniqueSlug(name, supabaseAdmin)

    const insertPayload = {
      name,
      company_name: name,
      slug,
    }

    const { data, error } = await supabaseAdmin
      .from('organizations')
      .insert(insertPayload)
      .select('id, public_id, name, company_name, slug, created_at')
      .single()

    if (error) {
      logger.error({ error }, 'Failed to create organization')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ organization: data })
  } catch (error: any) {
    const msg = error?.message || 'Internal Server Error'
    const status = msg === 'FORBIDDEN' ? 403 : msg === 'UNAUTHENTICATED' ? 401 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}
