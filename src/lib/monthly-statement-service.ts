/**
 * Monthly Statement Service
 *
 * Handles data fetching, PDF generation, and storage for monthly statements.
 */

import { supabaseAdmin } from '@/lib/db';
import { generatePDFFromHTML } from '@/lib/pdf-generator';
import MonthlyStatementTemplate from '@/components/monthly-logs/MonthlyStatementTemplate';
import React from 'react';
import { designTokens } from '@/lib/design-tokens';
import { getOwnerDrawSummary } from '@/lib/monthly-log-calculations';
import { calculateNetToOwnerValue } from '@/types/monthly-log';

interface StatementDataFetchResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Fetch all data needed for monthly statement generation
 *
 * @param monthlyLogId - UUID of the monthly log
 * @returns Complete dataset for statement template
 */
export async function fetchMonthlyStatementData(
  monthlyLogId: string,
): Promise<StatementDataFetchResult> {
  try {
    // Fetch monthly log with all related data
    const { data: monthlyLog, error: logError } = await supabaseAdmin
      .from('monthly_logs')
      .select(
        `
        id,
        period_start,
        property_id,
        unit_id,
        tenant_id,
        properties (
          name,
          address_line1,
          city,
          state,
          postal_code
        ),
        units (
          unit_number,
          unit_name
        )
      `,
      )
      .eq('id', monthlyLogId)
      .single();

    if (logError || !monthlyLog) {
      return { success: false, error: 'Monthly log not found' };
    }

    // Fetch financial summary
    const { data: financialData } = await supabaseAdmin
      .from('monthly_logs')
      .select(
        'charges_amount, payments_amount, bills_amount, escrow_amount, management_fees_amount, previous_lease_balance',
      )
      .eq('id', monthlyLogId)
      .single();

    // Fetch all transactions for this monthly log
    const { data: transactions } = await supabaseAdmin
      .from('transactions')
      .select('id, date, memo, total_amount, transaction_type, payment_method, reference_number')
      .eq('monthly_log_id', monthlyLogId)
      .order('date', { ascending: true });

    // Fetch escrow movements
    const { data: escrowMovements } = await supabaseAdmin
      .from('transaction_lines')
      .select(
        `
        id,
        date,
        memo,
        amount,
        posting_type,
        gl_accounts!inner(
          gl_account_category!inner(category)
        )
      `,
      )
      .eq('monthly_log_id', monthlyLogId)
      .eq('gl_accounts.gl_account_category.category', 'deposit')
      .order('date', { ascending: true });

    // Fetch tenant info if available
    let tenantName = null;
    if (monthlyLog.tenant_id) {
      const { data: tenant } = await supabaseAdmin
        .from('tenants')
        .select('first_name, last_name, company_name, contacts(display_name)')
        .eq('id', monthlyLog.tenant_id)
        .single();

      if (tenant) {
        if (tenant.company_name) {
          tenantName = tenant.company_name;
        } else if (tenant.first_name || tenant.last_name) {
          tenantName = `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim();
        } else if (tenant.contacts && Array.isArray(tenant.contacts) && tenant.contacts[0]) {
          tenantName = tenant.contacts[0].display_name;
        }
      }
    }

    // Organize transactions by type
    const charges = (transactions || [])
      .filter((t) => t.transaction_type === 'Charge')
      .map((t) => ({
        date: t.date,
        description: t.memo || 'Charge',
        amount: Math.abs(t.total_amount),
      }));

    const payments = (transactions || [])
      .filter((t) => t.transaction_type === 'Payment' || t.transaction_type === 'Credit')
      .map((t) => ({
        date: t.date,
        description: t.memo || 'Payment',
        amount: Math.abs(t.total_amount),
        paymentMethod: t.payment_method || undefined,
      }));

    const bills = (transactions || [])
      .filter((t) => t.transaction_type === 'Bill')
      .map((t) => ({
        date: t.date,
        description: t.memo || 'Bill',
        vendor: undefined, // TODO: Fetch vendor name from vendor_id
        amount: Math.abs(t.total_amount),
      }));

    const escrow = (escrowMovements || []).map((m: any) => ({
      date: m.date,
      description: m.memo || (m.posting_type === 'Credit' ? 'Escrow Deposit' : 'Escrow Withdrawal'),
      type: m.posting_type === 'Credit' ? ('deposit' as const) : ('withdrawal' as const),
      amount: Math.abs(m.amount),
    }));

    // Calculate financial summary
    const totalCharges = financialData?.charges_amount || 0;
    const totalCredits = 0;
    const totalPayments = financialData?.payments_amount || 0;
    const totalBills = financialData?.bills_amount || 0;
    const escrowAmount = financialData?.escrow_amount || 0;
    const managementFees = financialData?.management_fees_amount || 0;
    const previousLeaseBalance = financialData?.previous_lease_balance || 0;

    const ownerDrawSummary = await getOwnerDrawSummary(monthlyLogId);
    const ownerDraw = ownerDrawSummary.total;
    const netToOwner = calculateNetToOwnerValue({
      previousBalance: previousLeaseBalance,
      totalPayments,
      totalBills,
      escrowAmount,
      managementFees,
      ownerDraw,
    });
    const balance = totalCharges - totalCredits - totalPayments;

    // Compile complete statement data
    const statementData = {
      monthlyLogId: monthlyLog.id,
      periodStart: monthlyLog.period_start,
      generatedAt: new Date().toISOString(),
      property: {
        name: (monthlyLog.properties as any)?.name || 'Unknown Property',
        address: (monthlyLog.properties as any)?.address_line1 || '',
        city: (monthlyLog.properties as any)?.city || '',
        state: (monthlyLog.properties as any)?.state || '',
        zipCode: (monthlyLog.properties as any)?.postal_code || '',
      },
      unit: {
        unitNumber: (monthlyLog.units as any)?.unit_number || '',
        unitName: (monthlyLog.units as any)?.unit_name || null,
      },
      tenant: tenantName ? { name: tenantName } : null,
      financialSummary: {
        totalCharges,
        totalCredits,
        totalPayments,
        totalBills,
        escrowAmount,
        managementFees,
        ownerDraw,
        netToOwner,
        balance,
        previousLeaseBalance,
      },
      charges,
      payments,
      bills,
      escrowMovements: escrow,
      company: {
        name: process.env.COMPANY_NAME || 'Property Management Company',
        address: process.env.COMPANY_ADDRESS,
        phone: process.env.COMPANY_PHONE,
        email: process.env.COMPANY_EMAIL,
        logo: process.env.COMPANY_LOGO_URL,
      },
    };

    return { success: true, data: statementData };
  } catch (error) {
    console.error('Error fetching monthly statement data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch statement data',
    };
  }
}

/**
 * Generate PDF for monthly statement
 *
 * @param monthlyLogId - UUID of the monthly log
 * @returns Buffer containing the PDF or error
 */
export async function generateMonthlyStatementPDF(
  monthlyLogId: string,
): Promise<{ success: boolean; pdf?: Buffer; error?: string }> {
  try {
    // Fetch statement data
    const dataResult = await fetchMonthlyStatementData(monthlyLogId);
    if (!dataResult.success || !dataResult.data) {
      return { success: false, error: dataResult.error };
    }

    // Render React component to HTML string (placeholder until serialization is wired up)
    const htmlString = React.createElement(MonthlyStatementTemplate, { data: dataResult.data });

    const palette = designTokens.colors;
    const typography = designTokens.typography;
    const spacing = designTokens.spacing;

    // For now, we'll use a simple HTML template approach
    // TODO: Implement proper React-to-HTML rendering
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Monthly Statement</title>
          <style>
            body { font-family: ${typography.body}; margin: ${spacing.lg}; background: ${palette.surfaceDefault}; color: ${palette.textPrimary}; }
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
            <h1>Monthly Statement</h1>
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

    // Generate PDF from HTML
    const pdfBuffer = await generatePDFFromHTML(html, {
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
    });

    return { success: true, pdf: pdfBuffer };
  } catch (error) {
    console.error('Error generating monthly statement PDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate PDF',
    };
  }
}

/**
 * Upload PDF to Supabase storage
 *
 * @param monthlyLogId - UUID of the monthly log
 * @param pdfBuffer - PDF data buffer
 * @returns Public URL of the uploaded PDF
 */
export async function uploadStatementPDF(
  monthlyLogId: string,
  pdfBuffer: Buffer,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const fileName = `monthly-statements/${monthlyLogId}.pdf`;

    // Upload to Supabase storage
    const { error } = await supabaseAdmin.storage.from('documents').upload(fileName, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true, // Replace if exists
    });

    if (error) {
      console.error('Error uploading PDF to storage:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from('documents').getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return { success: false, error: 'Failed to get public URL' };
    }

    // Update monthly_logs with PDF URL
    const { error: updateError } = await supabaseAdmin
      .from('monthly_logs')
      .update({ pdf_url: urlData.publicUrl })
      .eq('id', monthlyLogId);

    if (updateError) {
      console.error('Error updating monthly log with PDF URL:', updateError);
      return { success: false, error: updateError.message };
    }

    return { success: true, url: urlData.publicUrl };
  } catch (error) {
    console.error('Error in uploadStatementPDF:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload PDF',
    };
  }
}

/**
 * Generate and store monthly statement PDF
 *
 * Complete workflow: fetch data, generate PDF, upload to storage.
 *
 * @param monthlyLogId - UUID of the monthly log
 * @returns Public URL of the generated statement
 */
export async function generateAndStoreMonthlyStatement(
  monthlyLogId: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
  // Generate PDF
  const pdfResult = await generateMonthlyStatementPDF(monthlyLogId);
  if (!pdfResult.success || !pdfResult.pdf) {
    return { success: false, error: pdfResult.error };
  }

  // Upload to storage
  const uploadResult = await uploadStatementPDF(monthlyLogId, pdfResult.pdf);
  if (!uploadResult.success) {
    return { success: false, error: uploadResult.error };
  }

  return { success: true, url: uploadResult.url };
}
