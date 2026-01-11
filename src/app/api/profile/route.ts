import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/db'
import { isValidTimezone } from '@/lib/timezones'

const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY'] as const
const NUMBER_FORMATS = ['1,234.00', '1.234,00'] as const
const CURRENCIES = ['USD', 'CAD', 'EUR'] as const
const LANDING_PAGES = ['dashboard', 'properties', 'maintenance', 'financials', 'board'] as const
const WORK_ROLES = [
  'org_admin',
  'org_manager',
  'org_staff',
  'owner_portal',
  'tenant_portal',
  'vendor_portal',
  'platform_admin',
] as const

const ProfilePayloadSchema = z.object({
  full_name: z.string().trim().max(255).optional(),
  display_name: z.string().trim().max(255).optional(),
  phone: z.string().trim().max(50).optional(),
  timezone: z
    .string()
    .trim()
    .max(100)
    .optional()
    .refine((value) => value === undefined || isValidTimezone(value), 'Invalid timezone'),
  locale: z.string().trim().max(20).optional(),
  date_format: z.enum(DATE_FORMATS).optional(),
  currency: z.enum(CURRENCIES).optional(),
  number_format: z.enum(NUMBER_FORMATS).optional(),
  notification_preferences: z
    .object({
      critical: z.boolean().optional(),
      financial: z.boolean().optional(),
      compliance: z.boolean().optional(),
    })
    .optional(),
  personal_integrations: z
    .object({
      calendar: z.boolean().optional(),
      email_logging: z.boolean().optional(),
    })
    .optional(),
  favorite_properties: z.array(z.string().trim()).max(50).optional(),
  landing_page: z.enum(LANDING_PAGES).optional(),
  avatar_url: z.string().url().max(1024).optional(),
  two_factor_enabled: z.boolean().optional(),
  primary_work_role: z.enum(WORK_ROLES).optional(),
})

type ProfilePayload = z.infer<typeof ProfilePayloadSchema>

const normalizePhone = (phone?: string | null) => {
  if (!phone) return null
  const digits = phone.replace(/\D+/g, '')
  if (!digits) return null
  if (digits.length === 10) return `+1${digits}`
  return `+${digits}`
}

const splitFullName = (value?: string | null) => {
  if (!value) return { first_name: null, last_name: null }
  const parts = value.trim().split(/\s+/)
  if (parts.length === 1) return { first_name: parts[0], last_name: null }
  const last = parts.pop() || null
  return { first_name: parts.join(' '), last_name: last }
}

const fetchProfile = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) throw error
  return data
}

const fetchOrgMemberships = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from('membership_roles')
    .select('org_id, role_id, roles(name)')
    .eq('user_id', userId)

  if (error) throw error
  return (data ?? []).map((row) => ({
    org_id: (row as { org_id?: string | null })?.org_id ?? null,
    role:
      (row as { roles?: { name?: string | null } | null })?.roles?.name ??
      (row as { role_id?: string | null })?.role_id ??
      null,
  }))
}

const ensureContact = async (userId: string, payload: ProfilePayload & { email?: string | null }) => {
  const { data: existing } = await supabaseAdmin
    .from('contacts')
    .select('id, first_name, last_name, display_name, primary_phone')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (existing) return existing.id

  const { first_name, last_name } = splitFullName(payload.full_name || payload.display_name || '')
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({
      user_id: userId,
      first_name,
      last_name,
      display_name: payload.display_name || payload.full_name || payload.email || null,
      primary_email: payload.email || null,
      primary_phone: normalizePhone(payload.phone),
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id
}

export async function GET() {
  try {
    const { user } = await requireAuth()
    const [profile, memberships] = await Promise.all([fetchProfile(user.id), fetchOrgMemberships(user.id)])
    return NextResponse.json({ profile, memberships })
  } catch (error: unknown) {
    console.error('Profile GET error', error)
    const message = error instanceof Error ? error.message : 'Failed to load profile'
    const status =
      typeof (error as { status?: number })?.status === 'number' ? (error as { status?: number }).status : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PUT(request: Request) {
  try {
    const { user } = await requireAuth()
    const json = await request.json()
    const parsed = ProfilePayloadSchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const payload = parsed.data
    const normalizedPhone = normalizePhone(payload.phone)
    const contactId = await ensureContact(user.id, { ...payload, email: user.email })
    const nameParts = splitFullName(payload.full_name || payload.display_name || null)

    const contactUpdate: Record<string, unknown> = {}
    if (nameParts.first_name !== null) contactUpdate.first_name = nameParts.first_name
    if (nameParts.last_name !== null) contactUpdate.last_name = nameParts.last_name
    if (payload.display_name) contactUpdate.display_name = payload.display_name
    if (normalizedPhone !== null) contactUpdate.primary_phone = normalizedPhone

    if (Object.keys(contactUpdate).length) {
      const { error: contactError } = await supabaseAdmin
        .from('contacts')
        .update(contactUpdate)
        .eq('id', contactId)
      if (contactError) {
        console.error('Contact update failed', contactError)
        return NextResponse.json({ error: contactError.message }, { status: 500 })
      }
    }

    const profileUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }
    if (payload.full_name !== undefined) profileUpdate.full_name = payload.full_name
    if (payload.display_name !== undefined) profileUpdate.display_name = payload.display_name
    if (payload.timezone !== undefined) profileUpdate.timezone = payload.timezone
    if (payload.locale !== undefined) profileUpdate.locale = payload.locale
    if (payload.date_format !== undefined) profileUpdate.date_format = payload.date_format
    if (payload.currency !== undefined) profileUpdate.currency = payload.currency
    if (payload.number_format !== undefined) profileUpdate.number_format = payload.number_format
    if (payload.notification_preferences !== undefined)
      profileUpdate.notification_preferences = payload.notification_preferences
    if (payload.personal_integrations !== undefined) profileUpdate.personal_integrations = payload.personal_integrations
    if (payload.favorite_properties !== undefined) profileUpdate.favorite_properties = payload.favorite_properties
    if (payload.landing_page !== undefined) profileUpdate.landing_page = payload.landing_page
    if (payload.avatar_url !== undefined) profileUpdate.avatar_url = payload.avatar_url
    if (payload.two_factor_enabled !== undefined) profileUpdate.two_factor_enabled = payload.two_factor_enabled
    if (payload.primary_work_role !== undefined) profileUpdate.primary_work_role = payload.primary_work_role
    if (normalizedPhone !== null) profileUpdate.phone = normalizedPhone

    const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
      user_id: user.id,
      email: user.email,
      ...profileUpdate,
    })

    if (profileError) {
      console.error('Profile upsert failed', profileError)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    const [profile, memberships] = await Promise.all([fetchProfile(user.id), fetchOrgMemberships(user.id)])
    return NextResponse.json({ profile, memberships })
  } catch (error: unknown) {
    console.error('Profile PUT error', error)
    const message = error instanceof Error ? error.message : 'Failed to save profile'
    const status =
      typeof (error as { status?: number })?.status === 'number' ? (error as { status?: number }).status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
