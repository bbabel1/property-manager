/**
 * Monthly Statement HTML Preview API
 *
 * GET /api/monthly-logs/[logId]/preview-statement
 * Returns HTML preview of the monthly statement (useful for debugging).
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { hasPermission } from '@/lib/permissions';
import { fetchMonthlyStatementData } from '@/lib/monthly-statement-service';
import { designTokens } from '@/lib/design-tokens';

export async function GET(request: Request, { params }: { params: Promise<{ logId: string }> }) {
  try {
    // Auth check
    const auth = await requireAuth();

    if (!hasPermission(auth.roles, 'monthly_logs.read')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // Parse parameters
    const { logId } = await params;

    // Fetch statement data
    const dataResult = await fetchMonthlyStatementData(logId);
    if (!dataResult.success || !dataResult.data) {
      return NextResponse.json(
        {
          error: { code: 'DATA_FETCH_FAILED', message: dataResult.error || 'Failed to fetch data' },
        },
        { status: 500 },
      );
    }

    const palette = designTokens.colors;
    const typography = designTokens.typography;
    const spacing = designTokens.spacing;

    // Generate HTML template
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Monthly Statement Preview</title>
          <style>
            body { font-family: ${typography.body}; margin: ${spacing.lg}; color: ${palette.textPrimary}; background: ${palette.surfaceDefault}; }
            .header { text-align: center; margin-bottom: ${spacing.xl}; }
            .section { margin-bottom: ${spacing.lg}; }
            .financial-summary { background: ${palette.surfaceHighlight}; padding: ${spacing.md}; border-radius: 8px; border: 1px solid ${palette.borderAccent}; }
            table { width: 100%; border-collapse: collapse; margin-top: ${spacing.sm}; }
            th, td { border: 1px solid ${palette.borderStrong}; padding: ${spacing.xs}; text-align: left; }
            th { background-color: ${palette.surfacePanel}; }
            .amount { text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Monthly Statement Preview</h1>
            <p>${dataResult.data.property.name}</p>
            <p>${dataResult.data.property.address}, ${dataResult.data.property.city}, ${dataResult.data.property.state} ${dataResult.data.property.zipCode}</p>
            <p>Period: ${new Date(dataResult.data.periodStart).toLocaleDateString()}</p>
          </div>
          
          <div class="section financial-summary">
            <h2>Financial Summary</h2>
            <table>
              <tr><td>Total Charges:</td><td class="amount">$${dataResult.data.financialSummary.totalCharges.toFixed(2)}</td></tr>
              <tr><td>Total Credits:</td><td class="amount">-$${dataResult.data.financialSummary.totalCredits.toFixed(2)}</td></tr>
              <tr><td>Total Payments:</td><td class="amount">$${dataResult.data.financialSummary.totalPayments.toFixed(2)}</td></tr>
              <tr><td>Total Bills:</td><td class="amount">$${dataResult.data.financialSummary.totalBills.toFixed(2)}</td></tr>
              <tr><td>Escrow Amount:</td><td class="amount">$${dataResult.data.financialSummary.escrowAmount.toFixed(2)}</td></tr>
              <tr><td>Management Fees:</td><td class="amount">$${dataResult.data.financialSummary.managementFees.toFixed(2)}</td></tr>
              <tr><td>Balance:</td><td class="amount">$${dataResult.data.financialSummary.balance.toFixed(2)}</td></tr>
            </table>
          </div>
          
          <div class="section">
            <h2>Charges</h2>
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Amount</th></tr>
              </thead>
              <tbody>
                ${dataResult.data.charges
                  .map(
                    (charge: any) =>
                      `<tr><td>${new Date(charge.date).toLocaleDateString()}</td><td>${charge.description}</td><td class="amount">$${charge.amount.toFixed(2)}</td></tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <h2>Payments</h2>
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Amount</th></tr>
              </thead>
              <tbody>
                ${dataResult.data.payments
                  .map(
                    (payment: any) =>
                      `<tr><td>${new Date(payment.date).toLocaleDateString()}</td><td>${payment.description}</td><td class="amount">$${payment.amount.toFixed(2)}</td></tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <h2>Bills</h2>
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Amount</th></tr>
              </thead>
              <tbody>
                ${dataResult.data.bills
                  .map(
                    (bill: any) =>
                      `<tr><td>${new Date(bill.date).toLocaleDateString()}</td><td>${bill.description}</td><td class="amount">$${bill.amount.toFixed(2)}</td></tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <h2>Escrow Movements</h2>
            <table>
              <thead>
                <tr><th>Date</th><th>Description</th><th>Type</th><th>Amount</th></tr>
              </thead>
              <tbody>
                ${dataResult.data.escrowMovements
                  .map(
                    (movement: any) =>
                      `<tr><td>${new Date(movement.date).toLocaleDateString()}</td><td>${movement.description}</td><td>${movement.type}</td><td class="amount">$${movement.amount.toFixed(2)}</td></tr>`,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
          
          <div class="section">
            <p><em>Generated on ${new Date().toLocaleDateString()}</em></p>
          </div>
        </body>
      </html>
    `;

    // Return HTML response
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/monthly-logs/[logId]/preview-statement:', error);

    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
