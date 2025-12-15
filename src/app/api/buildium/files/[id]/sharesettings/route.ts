/* eslint-disable @typescript-eslint/ban-ts-comment */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumFileShareSettingsUpdateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/files/${id}/sharing`;
    
    const response = await fetch(buildiumUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID || '',
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET || '',
      },
    });

    if (!response.ok) {
      const rawText = await response.text().catch(() => '');
      let errorData: any = {};
      try {
        errorData = rawText ? JSON.parse(rawText) : {};
      } catch (parseError) {
        errorData = { raw: rawText || 'Unauthorized' };
      }
      logger.error({ status: response.status, errorData }, 'Buildium file share settings fetch failed');

      return NextResponse.json(
        { 
          error: 'Failed to fetch file share settings from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const shareSettings = await response.json();

    logger.info(`Buildium file share settings fetched successfully`);

    return NextResponse.json({
      success: true,
      data: shareSettings,
    });

  } catch (error) {
    logger.error(`Error fetching Buildium file share settings`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const { id } = await params;

    // Parse and validate request body
    const body = await request.json();
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumFileShareSettingsUpdateSchema);

    // Make request to Buildium API
    const buildiumUrl = `${process.env.BUILDIUM_BASE_URL}/files/${id}/sharing`;
    
    const response = await fetch(buildiumUrl, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID || '',
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET || '',
      },
      body: JSON.stringify(validatedData),
    });

    if (!response.ok) {
      const rawText = await response.text().catch(() => '');
      let errorData: any = {};
      try {
        errorData = rawText ? JSON.parse(rawText) : {};
      } catch (parseError) {
        errorData = { raw: rawText || 'Unauthorized' };
      }
      logger.error({ status: response.status, errorData }, 'Buildium file share settings update failed');

      return NextResponse.json(
        { 
          error: 'Failed to update file share settings in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const shareSettings = await response.json();

    logger.info(`Buildium file share settings updated successfully`);

    return NextResponse.json({
      success: true,
      data: shareSettings,
    });

  } catch (error) {
    logger.error(`Error updating Buildium file share settings`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
