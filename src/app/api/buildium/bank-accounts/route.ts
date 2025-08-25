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

    // Buildium API call
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts', {
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

    const bankAccounts = await response.json();

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
    const response = await fetch('https://apisandbox.buildium.com/v1/bankaccounts', {
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
