import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { BuildiumBankAccountCreateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'

export async function GET(request: NextRequest) {
  try {
    // Authentication
    const user = await requireUser(request);
    logger.info({ userId: user.id, action: 'get_buildium_bank_accounts' }, 'Fetching Buildium bank accounts');

    // Build query parameters (isActive, bankAccountType, limit, offset)
    const { searchParams } = new URL(request.url)
    const qp = new URLSearchParams()
    if (searchParams.get('isActive') !== null) qp.set('isActive', searchParams.get('isActive')!)
    if (searchParams.get('bankAccountType')) qp.set('bankAccountType', searchParams.get('bankAccountType')!)
    if (searchParams.get('limit')) qp.set('limit', searchParams.get('limit')!)
    if (searchParams.get('offset')) qp.set('offset', searchParams.get('offset')!)

    // Buildium API call
    const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/bankaccounts${qp.toString() ? `?${qp}` : ''}` as string, {
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

    let bankAccounts = await response.json();

    // Optional search (client-side filter on Name/Description)
    const search = searchParams.get('search')?.toLowerCase();
    if (search && Array.isArray(bankAccounts)) {
      bankAccounts = bankAccounts.filter((ba: any) => {
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
    const user = await requireUser(request);
    logger.info({ userId: user.id, action: 'create_buildium_bank_account' }, 'Creating Buildium bank account');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumBankAccountCreateSchema);

    // Buildium API call
    const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/bankaccounts`, {
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

    const newBankAccount = await response.json();

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
