import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumPropertyCreateEnhancedSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { getOrgScopedBuildiumEdgeClient } from '@/lib/buildium-edge-client';
import { resolveOrgIdFromRequest } from '@/lib/org/resolve-org-id';

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

    // Require platform admin
    const { user } = await requireRole('platform_admin');

    // Resolve orgId from request context
    let orgId: string | undefined;
    try {
      orgId = await resolveOrgIdFromRequest(request, user.id);
    } catch (error) {
      // If orgId resolution fails, allow undefined (will use env vars)
      logger.warn({ userId: user.id, error }, 'Could not resolve orgId, falling back to env vars');
    }

    // Use org-scoped client
    const client = await getOrgScopedBuildiumEdgeClient(orgId);

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');
    const propertyType = searchParams.get('propertyType');
    const isActive = searchParams.get('isActive');

    // Build query parameters for Buildium API
    const queryParams = new URLSearchParams();
    if (limit) queryParams.append('limit', limit);
    if (offset) queryParams.append('offset', offset);
    if (orderby) queryParams.append('orderby', orderby);
    if (propertyType) queryParams.append('propertyType', propertyType);
    if (isActive) queryParams.append('isActive', isActive);

    // Proxy via Edge function (keeps secrets at Edge)
    const proxy = await client.proxyRaw('GET', '/rentals', Object.fromEntries(queryParams.entries()));
    if (!proxy.success) return NextResponse.json({ error: proxy.error || 'Failed to fetch properties from Buildium' }, { status: 502 });
    const properties = Array.isArray(proxy.data) ? proxy.data : [];

    logger.info(`Buildium properties fetched successfully`);

    return NextResponse.json({
      success: true,
      data: properties,
      count: properties.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium properties`);

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

    // Require platform admin
    const { user } = await requireRole('platform_admin');

    // Resolve orgId from request context
    let orgId: string | undefined;
    try {
      orgId = await resolveOrgIdFromRequest(request, user.id);
    } catch (error) {
      // If orgId resolution fails, allow undefined (will use env vars)
      logger.warn({ userId: user.id, error }, 'Could not resolve orgId, falling back to env vars');
    }

    // Use org-scoped client
    const client = await getOrgScopedBuildiumEdgeClient(orgId);

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumPropertyCreateEnhancedSchema);

    const created = await client.proxyRaw('POST', '/rentals', undefined, validatedData);
    if (!created.success) return NextResponse.json({ error: created.error || 'Failed to create property in Buildium' }, { status: 502 });
    const property = created.data;

    logger.info(`Buildium property created successfully`);

    return NextResponse.json({
      success: true,
      data: property,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium property`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
