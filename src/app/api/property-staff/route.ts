import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import type { Database } from '@/types/database'
import { getServerSupabaseClient, hasSupabaseAdmin, requireSupabaseAdmin, SupabaseAdminUnavailableError } from '@/lib/supabase-client'

type PropertyStaffInsert = Database['public']['Tables']['property_staff']['Insert']

const AssignmentSchema = z.object({
  property_id: z.string().min(1, 'property_id is required'),
  staff_id: z
    .union([z.number(), z.string().regex(/^\d+$/)])
    .transform((value) => (typeof value === 'number' ? value : Number(value)))
    .refine((value) => Number.isInteger(value) && value > 0, 'staff_id must be a positive integer'),
  role: z.string().optional()
})

const PayloadSchema = z.object({
  assignments: z.array(AssignmentSchema).nonempty('assignments are required')
})

const PROPERTY_ROLE_ALIASES: Record<string, PropertyStaffInsert['role']> = {
  property_manager: 'PROPERTY_MANAGER',
  propertymanager: 'PROPERTY_MANAGER',
  assistant_property_manager: 'ASSISTANT_PROPERTY_MANAGER',
  assistantpropertymanager: 'ASSISTANT_PROPERTY_MANAGER',
  operations_manager: 'ADMINISTRATOR',
}

function normalizePropertyRole(value?: string | null): PropertyStaffInsert['role'] {
  if (!value) return 'PROPERTY_MANAGER'
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (PROPERTY_ROLE_ALIASES[normalized]) return PROPERTY_ROLE_ALIASES[normalized]

  const upper = value.trim().toUpperCase()
  const allowedRoles: PropertyStaffInsert['role'][] = [
    'PROPERTY_MANAGER',
    'ASSISTANT_PROPERTY_MANAGER',
    'MAINTENANCE_COORDINATOR',
    'ACCOUNTANT',
    'ADMINISTRATOR',
  ]

  return allowedRoles.includes(upper as PropertyStaffInsert['role'])
    ? (upper as PropertyStaffInsert['role'])
    : 'PROPERTY_MANAGER'
}

// POST /api/property-staff
// Body: { assignments: Array<{ property_id: string; staff_id: number | string; role?: string }> }
// - For PROPERTY_MANAGER: enforce one per property by replacing any existing row for that property/role
// - For other roles: insert if missing; update updated_at if exists
export async function POST(request: NextRequest) {
  try {
    await requireUser(request)
    const raw = await request.json().catch(() => ({}))
    const parsed = PayloadSchema.safeParse(raw)
    if (!parsed.success) {
      const message = parsed.error.issues.map(issue => issue.message).join('\n') || 'assignments are required'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const client = hasSupabaseAdmin()
      ? requireSupabaseAdmin('property staff assignments')
      : getServerSupabaseClient()

    const errors: string[] = []
    for (const assignment of parsed.data.assignments) {
      const role = normalizePropertyRole(assignment.role)
      const timestamp = new Date().toISOString()
      if (role === 'PROPERTY_MANAGER') {
        const { error: deleteError } = await client
          .from('property_staff')
          .delete()
          .eq('property_id', assignment.property_id)
          .eq('role', role)
        if (deleteError) {
          errors.push(deleteError.message)
          continue
        }
      }

      const upsertPayload: PropertyStaffInsert = {
        property_id: assignment.property_id,
        staff_id: assignment.staff_id,
        role,
        updated_at: timestamp,
        created_at: timestamp
      }

      const { error } = await client
        .from('property_staff')
        .upsert(upsertPayload, { onConflict: 'property_id,staff_id,role' })

      if (error) errors.push(error.message)
    }

    if (errors.length) {
      return NextResponse.json({ error: 'One or more assignments failed', details: errors }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof SupabaseAdminUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 501 })
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
