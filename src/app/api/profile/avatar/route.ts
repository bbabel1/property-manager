import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/db'

const AVATAR_BUCKET = 'avatars'
const MAX_SIZE = 5 * 1024 * 1024 // 5MB

export async function POST(request: Request) {
  try {
    const { user } = await requireAuth()
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File missing' }, { status: 400 })
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop() || 'bin'
    const key = `${user.id}/avatar-${randomUUID()}.${ext}`

    const { error: uploadError } = await supabaseAdmin.storage.from(AVATAR_BUCKET).upload(key, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true,
    })
    if (uploadError) {
      console.error('Avatar upload failed', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(key)
    const publicUrl = publicUrlData?.publicUrl
    if (!publicUrl) {
      return NextResponse.json({ error: 'Could not get public URL' }, { status: 500 })
    }

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      user_id: user.id,
      avatar_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    if (profileError) {
      console.error('Avatar profile update failed', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const { data: profile, error: fetchError } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    if (fetchError) {
      console.error('Profile fetch failed', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('org_memberships')
      .select('org_id, role')
      .eq('user_id', user.id)
    if (membershipError) {
      console.error('Membership fetch failed', membershipError)
      return NextResponse.json({ error: membershipError.message }, { status: 500 })
    }

    return NextResponse.json({ profile, memberships })
  } catch (error) {
    console.error('Avatar upload error', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload avatar' },
      { status: 500 },
    )
  }
}
