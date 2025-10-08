import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumGeneralLedgerAccountCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { getServerSupabaseClient } from '@/lib/supabase-client';

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
    // Buildium docs: /v1/glaccounts supports type, subType, isActive, limit, offset
    const orderby = searchParams.get('orderby'); // keep passthrough if provided
    const type = searchParams.get('type') || searchParams.get('accountType');
    const subType = searchParams.get('subType');
    const isActive = searchParams.get('isActive');

    // Proxy to Edge function list
    const supabase = getServerSupabaseClient('gl accounts list');
    const { data, error } = await supabase.functions.invoke('buildium-sync', {
      body: {
        method: 'GET',
        entityType: 'glAccounts',
        params: { limit, offset, orderby, type, subType, isActive }
      }
    })
    if (error) {
      logger.error({ error }, 'Edge function error fetching GL accounts')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const accounts = data?.data || data
    return NextResponse.json({ success: true, data: accounts, count: Array.isArray(accounts) ? accounts.length : undefined })

  } catch (error) {
    logger.error(`Error fetching Buildium general ledger accounts`);

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
    const validatedData = sanitizeAndValidate(body, BuildiumGeneralLedgerAccountCreateSchema);

    // Proxy to Edge function create
    const supabase = getServerSupabaseClient('gl accounts create');
    const { data, error } = await supabase.functions.invoke('buildium-sync', {
      body: {
        entityType: 'glAccount',
        operation: 'create',
        entityData: validatedData
      }
    })
    if (error) {
      logger.error({ error }, 'Edge function error creating GL account')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const account = data?.data || data
    return NextResponse.json({ success: true, data: account }, { status: 201 })

  } catch (error) {
    logger.error(`Error creating Buildium general ledger account`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
