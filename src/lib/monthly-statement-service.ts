import 'server-only';
/**
 * Monthly Statement Service
 *
 * Handles data fetching, PDF generation, and storage for monthly statements.
 */

import React from 'react';
import fs from 'fs';
import path from 'path';
import { supabaseAdmin } from '@/lib/db';
import { generatePDFFromHTML } from '@/lib/pdf-generator';
import MonthlyStatementTemplate, {
  type StatementData,
} from '@/components/monthly-logs/MonthlyStatementTemplate';
import { getOwnerDrawSummary } from '@/lib/monthly-log-calculations';
import { calculateNetToOwnerValue } from '@/types/monthly-log';

const STATEMENT_BUCKET = process.env.STATEMENT_PDF_BUCKET || 'documents';

const DEPOSIT_ACCOUNT_MATCHERS: Array<{ label: string; predicate: (name: string) => boolean }> = [
  { label: 'Reserve', predicate: (name) => name.includes('reserve') },
  { label: 'Property Tax Escrow', predicate: (name) => name.includes('tax escrow') || (name.includes('escrow') && !name.includes('security')) },
  { label: 'Tenant Security Deposit', predicate: (name) => (name.includes('security') && name.includes('deposit')) || name.includes('tenant security') },
];

const normalizeString = (value?: string | null) => value?.toLowerCase().trim() ?? '';

const signedAmountForGlType = (
  amount: number,
  postingType?: string | null,
  glType?: string | null,
) => {
  const isCredit = normalizeString(postingType).includes('credit');
  const normalizedType = normalizeString(glType);

  // Assets/expenses grow with debits; income/liabilities/equity grow with credits.
  const debitPositive =
    normalizedType === 'asset' ||
    normalizedType === 'expense' ||
    normalizedType === 'receivable' ||
    normalizedType === 'prepayment';

  if (debitPositive) {
    return isCredit ? -amount : amount;
  }

  return isCredit ? amount : -amount;
};

const isEscrowAccount = (category?: string | null, name?: string | null) => {
  const normalizedCategory = normalizeString(category);
  const normalizedName = normalizeString(name);
  return (
    normalizedCategory === 'deposit' ||
    normalizedName.includes('escrow') ||
    normalizedName.includes('reserve') ||
    normalizedName.includes('security deposit')
  );
};

type EscrowRow = {
  date: string;
  memo: string | null;
  amount: number;
  posting_type: 'Credit' | 'Debit' | string;
  gl_accounts?: {
    name?: string | null;
    type?: string | null;
    gl_account_category?: {
      category?: string | null;
    } | null;
  } | null;
};

type PropertyRecord = {
  name?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
} | null;

type UnitRecord = {
  unit_number?: string | null;
  unit_name?: string | null;
} | null;

async function fetchTenantName(tenantId?: string | null) {
  if (!tenantId) return null;

  const { data: tenant } = await supabaseAdmin
    .from('tenants')
    .select('first_name, last_name, company_name, contacts(display_name)')
    .eq('id', tenantId)
    .single();

  if (!tenant) return null;

  if (tenant.company_name) {
    return tenant.company_name;
  }

  if (tenant.first_name || tenant.last_name) {
    return `${tenant.first_name || ''} ${tenant.last_name || ''}`.trim() || null;
  }

  if (tenant.contacts && Array.isArray(tenant.contacts) && tenant.contacts[0]) {
    return tenant.contacts[0].display_name || null;
  }

  return null;
}

async function fetchOwnerNames(propertyId?: string | number | null) {
  if (!propertyId) return [];

  const normalizeOwners = (ownerships: any[] | null | undefined) => {
    if (!ownerships) return [];

    return ownerships
      .map((row: any) => {
        const owner = row.owners || {};
        const contact = Array.isArray(owner.contacts) ? owner.contacts[0] : owner.contacts;
        const contactName =
          (contact?.company_name as string | undefined) ||
          [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim() ||
          (contact?.display_name as string | undefined);
        const directName = owner.company_name as string | undefined;
        const finalName = (directName || contactName || '').trim();
        return finalName || null;
      })
      .filter(Boolean) as string[];
  };

  const fetchForId = async (id: string | number) => {
    const { data: ownerships, error: ownershipError } = await supabaseAdmin
      .from('ownerships')
      .select(
        `
        owners!inner(
          company_name,
          contacts (
            display_name,
            first_name,
            last_name,
            company_name
          )
        )
      `,
      )
      .eq('property_id', id);

    if (ownershipError || !ownerships) return [];
    return normalizeOwners(ownerships);
  };

  const ownerNames = await fetchForId(propertyId);

  if (ownerNames.length === 0) {
    const numericId = Number(propertyId);
    if (!Number.isNaN(numericId)) {
      ownerNames.push(...(await fetchForId(numericId)));
    }
  }

  return ownerNames.filter((name, idx) => ownerNames.indexOf(name) === idx);
}

async function fetchHoldingLinesForStatement(
  monthlyLog: { unit_id?: string | null; property_id?: string | null },
  statementDate: string,
) {
  if (monthlyLog.unit_id == null && !monthlyLog.property_id) {
    return { holdingLines: null, error: null };
  }

  try {
    const holdingQuery = supabaseAdmin
      .from('transaction_lines')
      .select(
        `
        id,
        date,
        memo,
        amount,
        posting_type,
        unit_id,
        property_id,
        gl_accounts!inner(
          name,
          type,
          gl_account_category!inner(category)
        )
      `,
      )
      .lte('date', statementDate)
      .order('date', { ascending: true });

    if (monthlyLog.unit_id && monthlyLog.property_id) {
      holdingQuery.or(
        `unit_id.eq.${monthlyLog.unit_id},and(unit_id.is.null,property_id.eq.${monthlyLog.property_id})`,
      );
    } else if (monthlyLog.unit_id) {
      holdingQuery.eq('unit_id', monthlyLog.unit_id);
    } else if (monthlyLog.property_id) {
      holdingQuery.eq('property_id', monthlyLog.property_id);
    }

    const { data, error } = await holdingQuery;
    return { holdingLines: (data as EscrowRow[] | null) ?? null, error };
  } catch (error) {
    return { holdingLines: null, error };
  }
}

function resolveLogoUrl(rawLogo?: string | null): string | undefined {
  if (!rawLogo) return undefined;
  if (/^https?:\/\//i.test(rawLogo) || rawLogo.startsWith('data:')) return rawLogo;

  // Treat relative paths as files under /public for PDF generation where no host is present
  const trimmed = rawLogo.replace(/^\/+/, '');
  const publicPath = path.join(process.cwd(), 'public', trimmed);
  try {
    const fileBuffer = fs.readFileSync(publicPath);
    const ext = path.extname(trimmed).toLowerCase();
    const mime =
      ext === '.svg'
        ? 'image/svg+xml'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : 'image/png';
    return `data:${mime};base64,${fileBuffer.toString('base64')}`;
  } catch {
    // Fallback to the raw value; better a broken logo than blocking statement generation
    return rawLogo;
  }
}

interface StatementDataFetchResult {
  success: boolean;
  data?: StatementData;
  error?: string;
}

const STATEMENT_LOGO_URL = process.env.STATEMENT_LOGO_URL || '/ora-statement-logo.svg';

const computeDepositAccountTotals = (
  escrowMovements: EscrowRow[] | null | undefined,
): Array<{ label: string; balance: number }> => {
  const totals: Record<string, number> = {};

  const safeNormalize = (value?: string | null) => value?.toLowerCase().trim() ?? '';

  (escrowMovements ?? []).forEach((movement) => {
    const name = safeNormalize(movement.gl_accounts?.name);
    if (!name) return;

    const matcher = DEPOSIT_ACCOUNT_MATCHERS.find(({ predicate }) => predicate(name));
    if (!matcher) return;

    const amount = Math.abs(Number(movement.amount) || 0);
    if (amount === 0) return;

    const signedAmount = signedAmountForGlType(
      amount,
      movement.posting_type,
      movement.gl_accounts?.type,
    );

    totals[matcher.label] = (totals[matcher.label] ?? 0) + signedAmount;
  });

  return DEPOSIT_ACCOUNT_MATCHERS.map(({ label }) => ({
    label,
    balance: totals[label] ?? 0,
  }));
};

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
    // Fetch monthly log with all related data and financial summary (single round-trip)
    const monthlyLogPromise = supabaseAdmin
      .from('monthly_logs')
      .select(
        `
        id,
        period_start,
        property_id,
        unit_id,
        tenant_id,
        charges_amount,
        payments_amount,
        bills_amount,
        escrow_amount,
        management_fees_amount,
        previous_lease_balance,
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

    // Fetch all transaction lines with GL account information for categorization
    const transactionLinesPromise = supabaseAdmin
      .from('transaction_lines')
      .select(
        `
        id,
        date,
        memo,
        amount,
        posting_type,
        unit_id,
        property_id,
        transactions!inner(
          id,
          date,
          memo,
          transaction_type
        ),
        gl_accounts(
          id,
          name,
          default_account_name,
          type,
          gl_account_category(
            category
          )
        )
      `,
      )
      .eq('transactions.monthly_log_id', monthlyLogId)
      .order('date', { ascending: true });

    const [{ data: monthlyLog, error: logError }, { data: transactionLines }] = await Promise.all([
      monthlyLogPromise,
      transactionLinesPromise,
    ]);

    if (logError || !monthlyLog) {
      return { success: false, error: 'Monthly log not found' };
    }

    const financialData = monthlyLog as {
      charges_amount?: number;
      payments_amount?: number;
      bills_amount?: number;
      escrow_amount?: number;
      management_fees_amount?: number;
      previous_lease_balance?: number;
    };

    const statementGeneratedAt = new Date();
    const statementDateISO = statementGeneratedAt.toISOString();
    const statementDate = statementDateISO.slice(0, 10);

    const holdingLinesPromise = fetchHoldingLinesForStatement(monthlyLog, statementDate);
    const tenantNamePromise = fetchTenantName(monthlyLog.tenant_id);
    const ownerNamesPromise = fetchOwnerNames(monthlyLog.property_id);
    const ownerDrawPromise = getOwnerDrawSummary(monthlyLogId);

    // Fetch holding-related lines for the unit up to the statement date
    const [{ holdingLines, error: holdingLinesError }, tenantName, ownerNames, ownerDrawSummary] =
      await Promise.all([holdingLinesPromise, tenantNamePromise, ownerNamesPromise, ownerDrawPromise]);

    if (holdingLinesError) {
      console.warn('Failed to fetch holding transaction lines for statement', holdingLinesError);
    }

    // Categorize transaction lines by GL account type/category
    type CategorizedLine = {
      label: string;
      amount: number;
      date: string;
    };

    const incomeItems: CategorizedLine[] = [];
    const expenseItems: CategorizedLine[] = [];
    const escrowItems: CategorizedLine[] = [];

    (transactionLines || []).forEach((line: any) => {
      const glAccount = line.gl_accounts;
      const category = glAccount?.gl_account_category?.category || '';
      const glType = glAccount?.type || '';
      const accountNameRaw = glAccount?.name || '';
      const defaultAccountNameRaw = glAccount?.default_account_name || '';
      const accountName = normalizeString(accountNameRaw);
      const postingType = line.posting_type || '';
      const amount = Math.abs(Number(line.amount) || 0);
      const transaction = line.transactions || {};
      const memo = (line.memo || transaction.memo || '').trim();
      const transactionType = normalizeString(transaction.transaction_type);
      const accountLabel = (accountNameRaw || '').trim();
      const defaultAccountLabel = (defaultAccountNameRaw || '').trim();
      const label =
        (accountLabel && accountLabel !== '-' ? accountLabel : '') ||
        (defaultAccountLabel && defaultAccountLabel !== '-' ? defaultAccountLabel : '') ||
        memo ||
        (transaction.memo || '').trim() ||
        'Transaction';
      const isCharge = transactionType === 'charge';

      if (!amount) return;
      if (accountName.includes('owner draw')) return; // handled separately

      const signedAmount = signedAmountForGlType(amount, postingType, glType);

      if (isEscrowAccount(category, accountNameRaw)) {
        // Escrow/Deposit activity shown as negative in summary
        const displayAmount = -Math.abs(signedAmount);
        escrowItems.push({
          label,
          amount: displayAmount,
          date: line.date || transaction.date || '',
        });
        return;
      }

      const normalizedType = normalizeString(glType);

      if (!isCharge && (normalizedType === 'income' || normalizedType === 'revenue')) {
        incomeItems.push({
          label,
          amount: Math.abs(signedAmount),
          date: line.date || transaction.date || '',
        });
        return;
      }

      if (normalizedType === 'expense') {
        expenseItems.push({
          label,
          amount: -Math.abs(signedAmount),
          date: line.date || transaction.date || '',
        });
        return;
      }

      // Fallback: infer from transaction type if GL type is missing
      if (!isCharge && (transactionType === 'payment' || transactionType === 'credit')) {
        incomeItems.push({
          label,
          amount: Math.abs(signedAmount),
          date: line.date || transaction.date || '',
        });
        return;
      }

      const disallowedExpenseTypes = ['asset', 'liability', 'equity', 'deposit', 'other'];
      if (transactionType === 'bill' && !disallowedExpenseTypes.includes(normalizedType)) {
        expenseItems.push({
          label,
          amount: -Math.abs(signedAmount),
          date: line.date || transaction.date || '',
        });
        return;
      }
    });

    if (incomeItems.length === 0) {
      incomeItems.push({
        label: 'Rent Income',
        amount: Math.abs(Number(financialData?.payments_amount ?? 0)),
        date: '',
      });
    }

    if (expenseItems.length === 0) {
      const billsAmount = Math.abs(Number(financialData?.bills_amount ?? 0));
      const managementFeesAmount = Math.abs(Number(financialData?.management_fees_amount ?? 0));

      if (billsAmount > 0) {
        expenseItems.push({ label: 'Bills Paid', amount: -billsAmount, date: '' });
      }

      if (managementFeesAmount > 0) {
        expenseItems.push({ label: 'Management Fee', amount: -managementFeesAmount, date: '' });
      }
    }

    if (escrowItems.length === 0 && Number(financialData?.escrow_amount ?? 0) !== 0) {
      escrowItems.push({
        label: 'Property Tax Escrow',
        amount: -Math.abs(Number(financialData?.escrow_amount ?? 0)),
        date: '',
      });
    }

    if (escrowItems.length === 0) {
      escrowItems.push({
        label: 'Property Tax Escrow',
        amount: 0,
        date: '',
      });
    }

    // Legacy format for compatibility
    const charges: Array<{ date: string; description: string; amount: number }> = [];
    const payments: Array<{ date: string; description: string; amount: number; paymentMethod?: string }> = [];
    const bills: Array<{ date: string; description: string; vendor?: string; amount: number }> = [];
    const escrow: Array<{
      date: string;
      description: string;
      type: 'deposit' | 'withdrawal';
      amount: number;
    }> = [];

    const accountTotals = computeDepositAccountTotals(holdingLines as EscrowRow[] | null | undefined);

    // Calculate financial summary
    const totalCharges = financialData?.charges_amount || 0;
    const totalCredits = 0;
    const totalPayments = financialData?.payments_amount || 0;
    const totalBills = financialData?.bills_amount || 0;
    const escrowAmount = financialData?.escrow_amount || 0;
    const managementFees = financialData?.management_fees_amount || 0;
    const previousLeaseBalance = financialData?.previous_lease_balance || 0;

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
    const statementData: StatementData = {
      monthlyLogId: monthlyLog.id,
      periodStart: monthlyLog.period_start,
      generatedAt: statementDateISO,
      property: {
        name: ((monthlyLog.properties as PropertyRecord)?.name) || 'Unknown Property',
        address: ((monthlyLog.properties as PropertyRecord)?.address_line1) || '',
        city: ((monthlyLog.properties as PropertyRecord)?.city) || '',
        state: ((monthlyLog.properties as PropertyRecord)?.state) || '',
        zipCode: ((monthlyLog.properties as PropertyRecord)?.postal_code) || '',
      },
      unit: {
        unitNumber: ((monthlyLog.units as UnitRecord)?.unit_number) || '',
        unitName: ((monthlyLog.units as UnitRecord)?.unit_name) || null,
      },
      tenant: tenantName ? { name: tenantName } : null,
      propertyOwners: ownerNames,
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
      accountTotals,
      incomeItems,
      expenseItems,
      escrowItems,
      company: {
        name: process.env.COMPANY_NAME || 'Property Management Company',
        address: process.env.COMPANY_ADDRESS,
        phone: process.env.COMPANY_PHONE,
        email: process.env.COMPANY_EMAIL,
        logo: resolveLogoUrl(STATEMENT_LOGO_URL),
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
 * Render the monthly statement HTML using the shared template.
 */
export async function renderMonthlyStatementHTML(data: StatementData): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const markup = renderToStaticMarkup(React.createElement(MonthlyStatementTemplate, { data }));
  return '<!DOCTYPE html>' + markup;
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

    const html = await renderMonthlyStatementHTML(dataResult.data);

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
  return uploadStatementPDFToPath(`monthly-statements/${monthlyLogId}.pdf`, pdfBuffer, {
    updateMonthlyLogId: monthlyLogId,
    upsert: true,
  });
}

/**
 * Upload a versioned copy of a statement PDF without mutating the monthly log record.
 * The uploaded file is unique per call and safe from later regenerations.
 */
export async function uploadStatementSnapshot(
  monthlyLogId: string,
  pdfBuffer: Buffer,
): Promise<{ success: boolean; url?: string; error?: string }> {
  const timestamp = Date.now();
  const fileName = `monthly-statements/${monthlyLogId}/history/${timestamp}.pdf`;
  return uploadStatementPDFToPath(fileName, pdfBuffer, { upsert: false });
}

async function ensureStatementBucketExists() {
  try {
    const { error: bucketError } = await supabaseAdmin.storage.createBucket(STATEMENT_BUCKET, {
      public: true,
    });
    if (bucketError && bucketError.message && !bucketError.message.includes('already exists')) {
      console.warn('Error creating bucket for statements', bucketError);
    }
  } catch (bucketException) {
    console.warn('Unexpected error creating statement bucket', bucketException);
  }
}

async function uploadStatementPDFToPath(
  fileName: string,
  pdfBuffer: Buffer,
  options: { updateMonthlyLogId?: string; upsert?: boolean } = {},
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    await ensureStatementBucketExists();

    // Upload to Supabase storage
    const { error } = await supabaseAdmin.storage
      .from(STATEMENT_BUCKET)
      .upload(fileName, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: options.upsert ?? false,
      });

    if (error) {
      console.error('Error uploading PDF to storage:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage.from(STATEMENT_BUCKET).getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      return { success: false, error: 'Failed to get public URL' };
    }

    if (options.updateMonthlyLogId) {
      const { error: updateError } = await supabaseAdmin
        .from('monthly_logs')
        .update({ pdf_url: urlData.publicUrl })
        .eq('id', options.updateMonthlyLogId);

      if (updateError) {
        console.error('Error updating monthly log with PDF URL:', updateError);
        return { success: false, error: updateError.message };
      }
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
