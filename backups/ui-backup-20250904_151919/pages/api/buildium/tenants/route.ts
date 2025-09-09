import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumTenantCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumEdgeClient } from '@/lib/buildium-edge-client'

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
    const lastupdatedfrom = searchParams.get('lastupdatedfrom');
    const lastupdatedto = searchParams.get('lastupdatedto');

    // Build query parameters for Buildium API
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (orderby) queryParams.append('orderby', orderby);
    if (lastupdatedfrom) queryParams.append('lastupdatedfrom', lastupdatedfrom);
    if (lastupdatedto) queryParams.append('lastupdatedto', lastupdatedto);

    // Make request to Buildium API
    const proxy = await buildiumEdgeClient.proxyRaw('GET', '/rentals/tenants', Object.fromEntries(queryParams.entries()))
    if (!proxy.success) return NextResponse.json({ error: proxy.error || 'Failed to fetch tenants from Buildium' }, { status: 502 })
    const tenants = proxy.data

    logger.info(`Buildium tenants fetched successfully`);

    return NextResponse.json({
      success: true,
      data: tenants,
      count: tenants.length,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium tenants`);

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
    const validatedData = sanitizeAndValidate(body, BuildiumTenantCreateSchema);

    // Make request to Buildium API
    const created = await buildiumEdgeClient.proxyRaw('POST', '/rentals/tenants', undefined, validatedData)
    if (!created.success) return NextResponse.json({ error: created.error || 'Failed to create tenant in Buildium' }, { status: 502 })
    const tenant = created.data

    logger.info(`Buildium tenant created successfully`);

    return NextResponse.json({
      success: true,
      data: tenant,
    }, { status: 201 });

  } catch (error) {
    logger.error(`Error creating Buildium tenant`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
