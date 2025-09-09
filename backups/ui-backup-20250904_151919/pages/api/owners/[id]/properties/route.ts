import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/db'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { checkRateLimit } from '@/lib/rate-limit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    console.log('🔍 Owner Properties API: Starting request for owner ID:', resolvedParams.id);
    
    // Rate limiting
    const rateLimit = await checkRateLimit(request);
    if (!rateLimit.success) {
      console.log('🔍 Owner Properties API: Rate limit exceeded');
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: rateLimit.retryAfter },
        { status: 429 }
      );
    }

    console.log('🔍 Owner Properties API: Rate limit check passed');

    // Authentication
    const user = await requireUser(request);
    console.log('🔍 Owner Properties API: User authenticated:', user.id);

    // Fetch properties owned by this owner through ownerships table
    console.log('🔍 Owner Properties API: About to query Supabase...');
    const { data: ownerships, error } = await supabaseAdmin
      .from('ownerships')
      .select(`
        id,
        property_id,
        "primary",
        ownership_percentage,
        disbursement_percentage,
        properties (
          id,
          name,
          address_line1,
          address_line2,
          address_line3,
          city,
          state,
          postal_code,
          country,
          total_units,
          status,
          rental_sub_type,
          year_built,
          reserve,
          created_at,
          updated_at
        )
      `)
      .eq('owner_id', resolvedParams.id)
      .order('properties(name)', { ascending: true });

    console.log('🔍 Owner Properties API: Supabase query completed');
    console.log('🔍 Owner Properties API: Error:', error);
    console.log('🔍 Owner Properties API: Data count:', ownerships?.length || 0);

    if (error) {
      console.error('🔍 Owner Properties API: Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch owner properties', details: error.message },
        { status: 500 }
      );
    }

    // Transform data to flatten property information
    console.log('🔍 Owner Properties API: Transforming data...');
    const transformedProperties = ownerships?.map(ownership => {
      const property = Array.isArray(ownership.properties) ? ownership.properties[0] : ownership.properties;
      return {
        id: property.id,
        name: property.name,
        address_line1: property.address_line1,
        address_line2: property.address_line2,
        address_line3: property.address_line3,
        city: property.city,
        state: property.state,
        postal_code: property.postal_code,
        country: property.country,
        total_units: property.total_units || 0,
        status: property.status,
        rental_sub_type: property.rental_sub_type,
        year_built: property.year_built,
        reserve: property.reserve,
        created_at: property.created_at,
        updated_at: property.updated_at,
        // Ownership information
        ownership_id: ownership.id,
        ownership_percentage: ownership.ownership_percentage || 0,
        disbursement_percentage: ownership.disbursement_percentage || 0,
        is_primary: ownership.primary || false
      };
    }) || [];

    console.log('🔍 Owner Properties API: Transformation completed');
    console.log('🔍 Owner Properties API: Final count:', transformedProperties.length);

    return NextResponse.json(transformedProperties);
  } catch (error) {
    console.error('🔍 Owner Properties API: Caught error:', error);
    
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      console.log('🔍 Owner Properties API: Authentication error');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('🔍 Owner Properties API: Unexpected error:', errorMessage);
    return NextResponse.json(
      { error: 'Failed to fetch owner properties', details: errorMessage },
      { status: 500 }
    );
  }
}
