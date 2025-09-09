import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { supabase } from '@/lib/db'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { StaffQuerySchema } from '@/schemas/staff'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const query = sanitizeAndValidate(Object.fromEntries(searchParams), StaffQuerySchema);
    console.log('Staff API: Validated query parameters:', query);

    // Fetch staff from database
    const { data: staff, error } = await supabase
      .from('staff')
      .select(`
        id,
        role,
        is_active,
        created_at,
        updated_at,
        buildium_user_id
      `)
      .eq('is_active', true)
      .not('buildium_user_id', 'is', null)
      .order('id', { ascending: true })

    if (error) {
      console.error('Error fetching staff:', error)
      // If schema/columns are missing or table is absent, return an empty list for dev
      const msg = String(error.message || '')
      const code = (error as any).code
      if (code === '42703' || msg.includes('does not exist') || msg.includes('Could not find the table')) {
        console.log('Staff schema incomplete or table missing, returning empty array')
        return NextResponse.json([])
      }
      return NextResponse.json(
        { error: 'Failed to fetch staff', details: error.message },
        { status: 500 }
      )
    }

    // Transform data to include display name
    const transformedStaff = staff?.map(member => ({
      ...member,
      displayName: `Staff ${member.id}` // Since we don't have name fields, use ID
    })) || []

    return NextResponse.json(transformedStaff)
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.error('Error in staff GET:', error)
    return NextResponse.json(
      { error: 'Failed to fetch staff' },
      { status: 500 }
    )
  }
}
