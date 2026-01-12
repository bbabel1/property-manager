import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/guards';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { BuildiumBillPaymentCreateSchema } from '@/schemas/buildium';
import { sanitizeAndValidate } from '@/lib/sanitize';
import { buildiumFetch } from '@/lib/buildium-http';
import type { BuildiumBill } from '@/types/buildium';
import { requireBuildiumEnabledOr403 } from '@/lib/buildium-route-guard';

type BuildiumBillLine = NonNullable<BuildiumBill['Lines']>[number] & {
  GLAccount?: { Id?: number | null } | number | null;
  GLAccountID?: number | null;
  AccountingEntity?:
    | (NonNullable<BuildiumBill['Lines']>[number]['AccountingEntity'] & {
        Type?: string | null;
        Unit?: { Id?: number | null } | null;
      })
    | null;
};

type PaymentLine = {
  BillLineId?: number;
  GLAccountId: number;
  AccountingEntity?:
    | {
        Id: number;
        AccountingEntityType: string;
        UnitId?: number;
      }
    | undefined;
  Amount: number;
  Memo?: string;
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    const { id } = await context.params;

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    const offset = searchParams.get('offset') || '0';
    const orderby = searchParams.get('orderby');

    // Build query parameters for Buildium API
    const queryParams: Record<string, string> = {};
    if (limit) queryParams.limit = limit;
    if (offset) queryParams.offset = offset;
    if (orderby) queryParams.orderby = orderby;

    // Make request to Buildium API
    const response = await buildiumFetch('GET', `/bills/${id}/payments`, queryParams, undefined, orgId);

    if (!response.ok) {
      const errorData: unknown = response.json ?? {};
      logger.error(`Buildium bill payments fetch failed`);

      return NextResponse.json(
        { 
          error: 'Failed to fetch bill payments from Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const paymentsJson: unknown = response.json ?? [];
    const payments = Array.isArray(paymentsJson) ? paymentsJson : [];

    logger.info(`Buildium bill payments fetched successfully`);

    return NextResponse.json({
      success: true,
      data: payments,
      count: payments.length,
    });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error fetching Buildium bill payments`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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
    await requireRole('platform_admin');
    const orgIdResult = await requireBuildiumEnabledOr403(request);
    if (orgIdResult instanceof NextResponse) return orgIdResult;
    const orgId = orgIdResult;

    const { id } = await context.params;

    // Parse and validate request body
    const body: unknown = await request.json().catch(() => ({}));
    
    // Validate request body against schema
    const validatedData = sanitizeAndValidate(body, BuildiumBillPaymentCreateSchema);

    // Buildium requires payment lines; fetch the bill to mirror its lines
    const billResponse = await buildiumFetch('GET', `/bills/${id}`, undefined, undefined, orgId);

    if (!billResponse.ok) {
      const errorData: unknown = billResponse.json ?? {};
      logger.error(`Failed to fetch Buildium bill ${id} before creating payment`);

      return NextResponse.json(
        {
          error: 'Failed to load Buildium bill for payment',
          details: errorData,
        },
        { status: 502 },
      );
    }

    const buildiumBill = (billResponse.json ?? {}) as BuildiumBill;
    const billLines: BuildiumBillLine[] = Array.isArray(buildiumBill?.Lines)
      ? (buildiumBill.Lines as BuildiumBillLine[])
      : [];
    if (!billLines.length) {
      return NextResponse.json(
        {
          error: 'Buildium bill has no payable lines',
          details: { billId: id },
        },
        { status: 400 },
      );
    }

    const totalBillAmount = billLines.reduce((sum: number, line) => {
      const amt = Number(line?.Amount ?? 0);
      return sum + (Number.isFinite(amt) ? Math.abs(amt) : 0);
    }, 0);

    if (!Number.isFinite(totalBillAmount) || totalBillAmount <= 0) {
      return NextResponse.json(
        {
          error: 'Buildium bill has no amount to pay',
          details: { billId: id },
        },
        { status: 400 },
      );
    }

    if (validatedData.Amount > totalBillAmount) {
      return NextResponse.json(
        {
          error: 'Payment amount exceeds Buildium bill total',
          details: {
            paymentAmount: validatedData.Amount,
            billAmount: totalBillAmount,
          },
        },
        { status: 400 },
      );
    }

    const entryDateObj = new Date(validatedData.Date);
    if (Number.isNaN(entryDateObj.getTime())) {
      return NextResponse.json(
        { error: 'Invalid payment date' },
        { status: 400 },
      );
    }
    const entryDate = entryDateObj.toISOString().slice(0, 10);

    const round = (value: number) => Math.round(value * 100) / 100;
    const ratio = validatedData.Amount / totalBillAmount;

    const paymentLines = billLines
      .map((line): PaymentLine | null => {
        const lineAny = line as any;
        const baseAmount = Number(lineAny?.Amount ?? 0);
        const billLineId = Number(lineAny?.Id);
        const glAccountId = Number(
          (typeof lineAny?.GLAccount === 'number' ? lineAny.GLAccount : lineAny?.GLAccount?.Id) ??
            lineAny?.GLAccountId ??
            lineAny?.GLAccountID ??
            lineAny?.GlAccountId,
        );

        if (!Number.isFinite(glAccountId) || !Number.isFinite(billLineId)) return null;

        const accountingEntity = line?.AccountingEntity ?? null;
        const unitId =
          (accountingEntity?.Unit?.Id as number | undefined) ??
          (accountingEntity?.UnitId as number | undefined);

        return {
          BillLineId: billLineId,
          GLAccountId: glAccountId,
          AccountingEntity: accountingEntity?.Id
            ? {
                Id: accountingEntity.Id,
                AccountingEntityType:
                  accountingEntity.AccountingEntityType ??
                  accountingEntity.Type ??
                  'Rental',
                ...(unitId ? { UnitId: unitId } : {}),
              }
            : undefined,
          Amount: round(baseAmount * ratio),
          ...(line?.Memo ? { Memo: line.Memo } : {}),
        };
      })
      .filter((line): line is PaymentLine => Boolean(line));

    if (!paymentLines.length) {
      return NextResponse.json(
        {
          error: 'Unable to map Buildium bill lines for payment',
          details: { billId: id },
        },
        { status: 400 },
      );
    }

    // Fix rounding drift so the line total matches the requested amount
    const linesTotal = paymentLines.reduce((sum, line) => sum + line.Amount, 0);
    const roundingDiff = round(validatedData.Amount - linesTotal);
    if (roundingDiff !== 0) {
      paymentLines[paymentLines.length - 1].Amount = round(
        paymentLines[paymentLines.length - 1].Amount + roundingDiff,
      );
    }

    const payload = {
      BankAccountId: validatedData.BankAccountId,
      Amount: round(validatedData.Amount),
      EntryDate: entryDate,
      ReferenceNumber: validatedData.ReferenceNumber,
      Memo: validatedData.Memo,
      Lines: paymentLines,
    };

    // Make request to Buildium API
    const response = await buildiumFetch('POST', `/bills/${id}/payments`, undefined, payload, orgId);

    if (!response.ok) {
      const errorData: unknown = response.json ?? {};
      logger.error(`Buildium bill payment creation failed`);

      return NextResponse.json(
        { 
          error: 'Failed to create bill payment in Buildium',
          details: errorData
        },
        { status: response.status }
      );
    }

    const paymentJson: unknown = response.json ?? {};
    const payment =
      paymentJson && typeof paymentJson === 'object'
        ? (paymentJson as Record<string, unknown>)
        : {};

    logger.info(`Buildium bill payment created successfully`);

    return NextResponse.json({
      success: true,
      data: payment,
    }, { status: 201 });

  } catch (error) {
    logger.error({ error });
    logger.error(`Error creating Buildium bill payment`);

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
