import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; serviceHistoryId: string }> }) {
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

    const { id, serviceHistoryId } = await params;

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/appliances/${id}/servicehistory/${serviceHistoryId}`;
    
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
      logger.error(`Buildium appliance service history fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch appliance service history from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const serviceHistory = await response.json();

    logger.info(`Buildium appliance service history fetched successfully`);

    return NextResponse.json({
      success: true,
      data: serviceHistory,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium appliance service history`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; serviceHistoryId: string }> }) {
  try {
    const rateLimitResult = await checkRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const user = await requireUser()
    const { id, serviceHistoryId } = await params
    const body = await request.json()

    // The service history update schema is identical to create per Buildium docs
    // We can reuse the create schema for validation to keep it simple
    const { BuildiumApplianceServiceHistoryCreateSchema } = await import('@/schemas/buildium')
    const { sanitizeAndValidate } = await import('@/lib/sanitize')
    const validated = sanitizeAndValidate(body, BuildiumApplianceServiceHistoryCreateSchema)

    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/rentals/appliances/${id}/servicehistory/${serviceHistoryId}`

    const response = await fetch(buildiumUrl, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!,
      },
      body: JSON.stringify(validated),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      logger.error(`Buildium appliance service history update failed`)
      return NextResponse.json(
        { error: 'Failed to update appliance service history in Buildium', details: errorData },
        { status: response.status }
      )
    }

    const updated = await response.json()
    logger.info(`Buildium appliance service history updated successfully`)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    logger.error(`Error updating Buildium appliance service history`)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
