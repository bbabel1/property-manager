import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { BuildiumBankAccountUpdateSchema } from '@/schemas/buildium'
import { sanitizeAndValidate } from '@/lib/sanitize'
import { buildiumFetch } from '@/lib/buildium-http'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const user = await requireUser(request);
    const bankAccountId = (await params).id;
    
    logger.info({ userId: user.id, bankAccountId, action: 'get_buildium_bank_account' }, 'Fetching Buildium bank account details');

    const prox = await buildiumFetch('GET', `/bankaccounts/${bankAccountId}`)
    if (!prox.ok) {
      if (prox.status === 404) {
        return NextResponse.json(
          { error: 'Bank account not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${prox.status} ${prox.errorText || ''}`);
    }
    const bankAccount = prox.json;

    return NextResponse.json({
      success: true,
      data: bankAccount
    });

  } catch (error) {
    logger.error({ error, bankAccountId: (await params).id }, 'Error fetching Buildium bank account details');
    return NextResponse.json(
      { error: 'Failed to fetch Buildium bank account details', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authentication
    const user = await requireUser(request);
    const bankAccountId = (await params).id;
    
    logger.info({ userId: user.id, bankAccountId, action: 'update_buildium_bank_account' }, 'Updating Buildium bank account');

    // Parse and validate request body
    const body = await request.json();
    const data = sanitizeAndValidate(body, BuildiumBankAccountUpdateSchema);

    const prox = await buildiumFetch('PUT', `/bankaccounts/${bankAccountId}`, undefined, data)
    if (!prox.ok) {
      if (prox.status === 404) {
        return NextResponse.json(
          { error: 'Bank account not found' },
          { status: 404 }
        );
      }
      throw new Error(`Buildium API error: ${prox.status} ${prox.errorText || ''}`);
    }
    const updatedBankAccount = prox.json;

    return NextResponse.json({
      success: true,
      data: updatedBankAccount
    });

  } catch (error) {
    logger.error({ error, bankAccountId: (await params).id }, 'Error updating Buildium bank account');
    return NextResponse.json(
      { error: 'Failed to update Buildium bank account', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
