import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { BuildiumBankAccountUpdateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication
    const user = await requireUser(request);
    const bankAccountId = params.id;
    
    logger.info({ userId: user.id, bankAccountId, action: 'get_buildium_bank_account' }, 'Fetching Buildium bank account details');

    // Buildium API call
    const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/bankaccounts/${bankAccountId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Bank account not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const bankAccount = await response.json();

    return NextResponse.json({
      success: true,
      data: bankAccount
    });

  } catch (error) {
    logger.error({ error, bankAccountId: params.id }, 'Error fetching Buildium bank account details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium bank account details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authentication
    const user = await requireUser(request);
    const bankAccountId = params.id;
    
    logger.info({ userId: user.id, bankAccountId, action: 'update_buildium_bank_account' }, 'Updating Buildium bank account');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumBankAccountUpdateSchema);

    // Buildium API call
    const response = await fetch(`${process.env.BUILDIUM_BASE_URL}/bankaccounts/${bankAccountId}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-buildium-client-id': process.env.BUILDIUM_CLIENT_ID!,
        'x-buildium-client-secret': process.env.BUILDIUM_CLIENT_SECRET!
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'Bank account not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${response.status} ${response.statusText}`);
    }

    const updatedBankAccount = await response.json();

    return NextResponse.json({
      success: true,
      data: updatedBankAccount
    });

  } catch (error) {
    logger.error({ error, bankAccountId: params.id }, 'Error updating Buildium bank account');
    return NextResponse.json(
      { error: 'Failed to update Buildium bank account', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
