import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { BuildiumCheckCreateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const user = await requireUser(request);
    logger.info({ userId: user.id, action: 'get_buildium_checks' }, 'Fetching Buildium checks');

    // Buildium API call
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/checks', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      }
    });

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const checks = await response.json();

    return NextResponse.json({
      success: true,
      data: checks,
      count: Array.isArray(checks) ? checks.length : 0
    });

  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium checks');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium checks', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const user = await requireUser(request);
    logger.info({ userId: user.id, action: 'create_buildium_check' }, 'Creating Buildium check');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumCheckCreateSchema);

    // Buildium API call
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts/checks', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newCheck = await response.json();

    return NextResponse.json({
      success: true,
      data: newCheck
    }, { status: 201 });

  } catch (error) {
    logger.error({ error }, 'Error creating Buildium check');
    return NextResponse.json(
      { error: 'Failed to create Buildium check', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
