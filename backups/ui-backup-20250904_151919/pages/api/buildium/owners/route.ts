import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumOwnerCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';

export async function GET(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication
    const user = await requireUser();

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const isActive = searchParams.get('isActive');
    const lastupdatedfrom = searchParams.get('lastupdatedfrom');
    const lastupdatedto = searchParams.get('lastupdatedto');
    const search = searchParams.get('search');

    // Build query parameters for Buildium API
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (orderby) queryParams.append('orderby', orderby);
    if (isActive) queryParams.append('isActive', isActive);
    if (lastupdatedfrom) queryParams.append('lastupdatedfrom', lastupdatedfrom);
    if (lastupdatedto) queryParams.append('lastupdatedto', lastupdatedto);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/owners?${queryParams.toString()}`;
    
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium owners fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch owners from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    let owners = await response.json();

    // Optional local search filter (client-side) across name/email when provided
    if (search) {
      const term = search.toLowerCase();
      owners = (Array.isArray(owners) ? owners : []).filter((o: any) => {
        const first = (o?.FirstName || '').toLowerCase();
        const last = (o?.LastName || '').toLowerCase();
        const email = (o?.Email || '').toLowerCase();
        const company = (o?.CompanyName || '').toLowerCase();
        return first.includes(term) || last.includes(term) || email.includes(term) || company.includes(term);
      });
    }

    logger.info(`Buildium owners fetched successfully`);

    return NextResponse.json({
      success: true,
      data: owners,
      count: owners.length,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium owners`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limiting
    const rateLimitResult = await checkRateLimit(request);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      );
    }

    // Require authentication
    const user = await requireUser();

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumOwnerCreateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/owners`;
    
    const response = await fetch(buildiumUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(`Buildium owner creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create owner in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const owner = await response.json();

    logger.info(`Buildium owner created successfully`);

    return NextResponse.json({
      success: true,
      data: owner,
    }, { status: 201 });

  } catch (error) {
    logger.error(`Error creating Buildium owner`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
