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
        first_name,
        last_name,
        email,
        phone,
        role,
        is_active,
        created_at,
        updated_at
      `)
      .eq('is_active', true)
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })

    if (error) {
      console.error('Error fetching staff:', error)
      // If the table doesn't exist, return empty array instead of error
      if (error.message.includes('does not exist') || error.message.includes('Could not find the table')) {
        console.log('Staff table not found, returning empty array')
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
      displayName: `${member.first_name} ${member.last_name}`.trim()
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