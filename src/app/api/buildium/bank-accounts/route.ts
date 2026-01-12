import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/guards'
import { logger } from '@/lib/logger'
import { BuildiumBankAccountCreateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { buildiumFetch } from '@/lib/buildium-http'
import { getBuildiumOrgIdOr403 } from '@/lib/buildium-route-guard'

type BuildiumBankAccount = { Name?: string | null; Description?: string | null }

export async function GET(request: NextRequest) {
  try {
    // Authentication
    await requireRole('platform_admin');
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;
    logger.info({ action: 'get_buildium_bank_accounts' }, 'Fetching Buildium bank accounts');

    // Build query parameters (isActive, bankAccountType, limit, offset)
    const { searchParams } = new URL(request.url)
    const queryParams: Record<string, string> = {}
    if (searchParams.get('isActive') !== null) queryParams.isActive = searchParams.get('isActive')!
    if (searchParams.get('bankAccountType')) queryParams.bankAccountType = searchParams.get('bankAccountType')!
    if (searchParams.get('limit')) queryParams.limit = searchParams.get('limit')!
    if (searchParams.get('offset')) queryParams.offset = searchParams.get('offset')!

    // Buildium API call
    const response = await buildiumFetch('GET', '/bankaccounts', queryParams, undefined, orgId);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    let bankAccounts = (response.json ?? []) as unknown[];

    // Optional search (client-side filter on Name/Description)
    const search = searchParams.get('search')?.toLowerCase();
    if (search && Array.isArray(bankAccounts)) {
      bankAccounts = (bankAccounts as BuildiumBankAccount[]).filter((ba) => {
        const name = String(ba?.Name || '').toLowerCase();
        const desc = String(ba?.Description || '').toLowerCase();
        return name.includes(search) || desc.includes(search);
      });
    }

    return NextResponse.json({
      success: true,
      data: bankAccounts,
      count: Array.isArray(bankAccounts) ? bankAccounts.length : 0
    });

  } catch (error) {
    logger.error({ error }, 'Error fetching Buildium bank accounts');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium bank accounts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authentication
    await requireRole('platform_admin');
    const guard = await getBuildiumOrgIdOr403(request);
    if ('response' in guard) return guard.response;
    const { orgId } = guard;
    logger.info({ action: 'create_buildium_bank_account' }, 'Creating Buildium bank account');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumBankAccountCreateSchema);

    // Buildium API call
    const response = await buildiumFetch('POST', '/bankaccounts', undefined, data, orgId);

    if (!response.ok) {
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const newBankAccount = response.json ?? {};

    return NextResponse.json({
      success: true,
      data: newBankAccount
    }, { status: 201 });

  } catch (error) {
    logger.error({ error }, 'Error creating Buildium bank account');
    return NextResponse.json(
      { error: 'Failed to create Buildium bank account', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
