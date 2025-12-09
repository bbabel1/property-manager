import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!hasPermission(auth.roles, 'settings.read') && !hasPermission(auth.roles, 'properties.read')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: offerings, error } = await supabaseAdmin
      .from('service_offerings')
      .select('*')
      .order('category')
      .order('name');

    if (error) {
      console.error('Error fetching service offerings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch service offerings', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: offerings || [] });
  } catch (err) {
    console.error('Error in GET /api/services/catalog:', err);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
