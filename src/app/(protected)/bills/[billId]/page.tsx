import Link from 'next/link';
import { notFound } from 'next/navigation';

import type { PostgrestError } from '@supabase/supabase-js';
import { PageBody, PageColumns, PageHeader, PageShell } from '@/components/layout/page-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/ui/utils';
import { supabase, supabaseAdmin } from '@/lib/db';
import BillFileAttachmentsCard from '@/components/bills/BillFileAttachmentsCard';
import BillActionsMenu from '@/components/bills/BillActionsMenu';
import type { BillFileRecord } from '@/components/bills/types';
import type { Database } from '@/types/database';
import { BillApprovalWorkflow } from '@/components/bills/BillApprovalWorkflow';
import { BillApplicationsList } from '@/components/bills/BillApplicationsList';
import { BillPaymentForm } from '@/components/bills/BillPaymentForm';
import { VendorCreditForm } from '@/components/bills/VendorCreditForm';

export type BillPageParams = { billId: string };
type BillPageProps = { params: Promise<BillPageParams> };

type BillStatusLabel = '' | 'Overdue' | 'Due' | 'Partially paid' | 'Paid' | 'Cancelled';
type Option = { id: string; label: string; meta?: string | null };

type LineItem = {
  id: string;
  propertyId: string | null;
  propertyName: string;
  unitLabel: string;
  accountLabel: string;
  accountNumber: string | null;
  accountType: string | null;
  description: string;
  initialAmount: number;
  remainingAmount: number;
};

type DetailEntry = {
  name: string;
  value: string | React.ReactNode;
  multiline?: boolean;
};

type PaymentRow = Pick<
  Database['public']['Tables']['transactions']['Row'],
  | 'id'
  | 'date'
  | 'paid_date'
  | 'total_amount'
  | 'bank_gl_account_id'
  | 'payment_method'
  | 'reference_number'
  | 'check_number'
  | 'status'
  | 'transaction_type'
  | 'buildium_bill_id'
>;

type TransactionLineWithRelations = Database['public']['Tables']['transaction_lines']['Row'] & {
  gl_accounts?:
    | Pick<
        Database['public']['Tables']['gl_accounts']['Row'],
        'name' | 'account_number' | 'type'
      >
    | null;
  units?: Pick<Database['public']['Tables']['units']['Row'], 'unit_number' | 'unit_name'> | null;
  properties?: Pick<Database['public']['Tables']['properties']['Row'], 'name'> | null;
};

type VendorWithContact = Database['public']['Tables']['vendors']['Row'] & {
  contacts?:
    | Pick<Database['public']['Tables']['contacts']['Row'], 'display_name' | 'company_name'>
    | null;
};

type WorkOrderSummary = Pick<Database['public']['Tables']['work_orders']['Row'], 'id' | 'subject'>;

type ListQueryResult<T> = { data: T[]; error: PostgrestError | null };
type SingleQueryResult<T> = { data: T | null; error: PostgrestError | null };

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'numeric',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const isoLike = value.includes('T') ? value : `${value}T00:00:00Z`;
  const date = new Date(isoLike);
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

function formatCurrency(value?: number | null): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return currencyFormatter.format(0);
  return currencyFormatter.format(amount);
}

function normalizeBillStatus(value: unknown): BillStatusLabel {
  switch (String(value ?? '').toLowerCase()) {
    case 'overdue':
      return 'Overdue';
    case 'due':
    case 'pending':
      return 'Due';
    case 'partiallypaid':
    case 'partially_paid':
    case 'partially paid':
      return 'Partially paid';
    case 'paid':
      return 'Paid';
    case 'cancelled':
      return 'Cancelled';
    default:
      return '';
  }
}

function deriveBillStatusFromDates(
  currentStatus: BillStatusLabel,
  dueDateIso: string | null,
  paidDateIso: string | null,
): BillStatusLabel {
  if (currentStatus === 'Cancelled') return 'Cancelled';
  if (currentStatus === 'Partially paid') return 'Partially paid';
  if (currentStatus === 'Paid') return 'Paid';
  if (paidDateIso) return 'Paid';

  if (dueDateIso) {
    const due = new Date(`${dueDateIso}T00:00:00Z`);
    if (!Number.isNaN(due.getTime())) {
      const today = new Date();
      const todayUtc = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
      );
      if (due < todayUtc) {
        return 'Overdue';
      }
    }
  }

  return 'Due';
}

function statusToVariant(
  status: BillStatusLabel,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'Paid':
      return 'secondary';
    case 'Overdue':
      return 'destructive';
    case 'Partially paid':
      return 'default';
    case 'Cancelled':
      return 'outline';
    default:
      return 'outline';
  }
}

export default async function BillDetailsPage({ params }: BillPageProps) {
  const { billId } = await params;

  const db = supabaseAdmin || supabase;
  const dbAny = db as any;
  if (!db) {
    throw new Error('Database client is unavailable');
  }

  const billRes = await db
    .from('transactions')
    .select(
      'id, date, due_date, paid_date, total_amount, status, memo, reference_number, vendor_id, buildium_bill_id, transaction_type, org_id, work_order_id',
    )
    .eq('id', billId)
    .maybeSingle();

  const bill = billRes?.data;

  if (billRes?.error) {
    console.error('Failed to load bill', billRes.error);
  }

  if (!bill || bill.transaction_type !== 'Bill') {
    notFound();
  }

  if (!bill.org_id) {
    notFound();
  }

  const orgId = bill.org_id;

  const linesPromise: Promise<ListQueryResult<TransactionLineWithRelations>> = (async () => {
    const { data, error } = await db
      .from('transaction_lines')
      .select(
        `id,
           amount,
           memo,
           posting_type,
           property_id,
           unit_id,
           date,
           created_at,
           gl_accounts(name, account_number, type),
           units(unit_number, unit_name),
           properties(name)`,
      )
      .eq('transaction_id', bill.id)
      .order('created_at', { ascending: true });
    return { data: (data as TransactionLineWithRelations[] | null) ?? [], error };
  })();

  const vendorPromise: Promise<SingleQueryResult<VendorWithContact>> = bill.vendor_id
    ? (async () => {
        const vendorId = String(bill.vendor_id);
        const { data, error } = await db
          .from('vendors')
          .select('id, contacts(display_name, company_name)')
          .eq('id', vendorId)
          .maybeSingle();
        return { data: (data as VendorWithContact | null) ?? null, error };
      })()
    : Promise.resolve({ data: null, error: null });

  const paymentsPromise: Promise<ListQueryResult<PaymentRow>> = bill.buildium_bill_id
    ? (async () => {
        const buildiumBillId = Number(bill.buildium_bill_id);
        const { data, error } = await db
          .from('transactions')
          .select(
            'id, date, paid_date, total_amount, bank_gl_account_id, payment_method, reference_number, check_number, status, transaction_type, buildium_bill_id',
          )
          .eq('transaction_type', 'Payment')
          .eq('buildium_bill_id', buildiumBillId)
          .order('date', { ascending: false });
        return { data: (data as PaymentRow[] | null) ?? [], error };
      })()
    : Promise.resolve({ data: [], error: null });

  const workOrderPromise: Promise<SingleQueryResult<WorkOrderSummary>> = bill.work_order_id
    ? (async () => {
        const workOrderId = String(bill.work_order_id);
        const { data, error } = await db
          .from('work_orders')
          .select('id, subject')
          .eq('id', workOrderId)
          .maybeSingle();
        return { data: (data as WorkOrderSummary | null) ?? null, error };
      })()
    : Promise.resolve({ data: null, error: null });

  const workflowPromise = (async () => {
    const { data, error } = await dbAny
      .from('bill_workflow')
      .select('approval_state, submitted_at, approved_at, rejected_at, voided_at, reversal_transaction_id')
      .eq('bill_transaction_id', bill.id)
      .maybeSingle();
    return { data: (data as any) ?? null, error };
  })();

  const auditPromise = (async () => {
    const { data, error } = await dbAny
      .from('bill_approval_audit')
      .select('*')
      .eq('bill_transaction_id', bill.id)
      .order('created_at', { ascending: true });
    return { data: (data as any[] | null) ?? [], error };
  })();

  const applicationsPromise = (async () => {
    const { data, error } = await dbAny
      .from('bill_applications')
      .select(
        'id, applied_amount, applied_at, source_type, source_transaction_id, source:source_transaction_id(id, transaction_type, status, total_amount, payment_method, is_reconciled, date, reference_number, check_number)',
      )
      .eq('bill_transaction_id', bill.id);
    return { data: (data as any[] | null) ?? [], error };
  })();

  const bankAccountsPromise = (async () => {
    const { data, error } = await db
      .from('gl_accounts')
      .select('id, name, account_number')
      .eq('org_id', orgId)
      .eq('is_bank_account', true)
      .order('name', { ascending: true });
    return { data: (data as any[] | null) ?? [], error };
  })();

  const creditAccountsPromise = (async () => {
    const { data, error } = await db
      .from('gl_accounts')
      .select('id, name, account_number, is_bank_account')
      .eq('org_id', orgId)
      .neq('is_bank_account', true)
      .order('name', { ascending: true });
    return { data: (data as any[] | null) ?? [], error };
  })();

  const vendorListPromise = (async () => {
    const { data, error } = await db
      .from('vendors')
      .select('id, contacts(display_name, company_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true });
    return { data: (data as any[] | null) ?? [], error };
  })();

  const billOptionsPromise = (async () => {
    let billOptionsQuery = db
      .from('transactions')
      .select('id, reference_number, memo, total_amount, status, due_date')
      .eq('org_id', orgId)
      .eq('transaction_type', 'Bill')
      .not('status', 'eq', 'Cancelled')
      .order('due_date', { ascending: true });
    if (bill.vendor_id) {
      billOptionsQuery = billOptionsQuery.eq('vendor_id', bill.vendor_id);
    }
    const { data, error } = await billOptionsQuery;
    return { data: (data as any[] | null) ?? [], error };
  })();

  const [
    linesRes,
    vendorRes,
    paymentsRes,
    workOrderRes,
    workflowRes,
    auditRes,
    applicationsRes,
    bankAccountsRes,
    creditAccountsRes,
    vendorListRes,
    billOptionsRes,
  ] = await Promise.all([
    linesPromise,
    vendorPromise,
    paymentsPromise,
    workOrderPromise,
    workflowPromise,
    auditPromise,
    applicationsPromise,
    bankAccountsPromise,
    creditAccountsPromise,
    vendorListPromise,
    billOptionsPromise,
  ]);

  if (linesRes?.error) {
    console.error('Failed to load bill lines', linesRes.error);
  }

  if (vendorRes?.error) {
    console.error('Failed to load vendor for bill', vendorRes.error);
  }
  if (paymentsRes?.error) {
    console.error('Failed to load bill payments', paymentsRes.error);
  }
  if (workOrderRes?.error) {
    console.error('Failed to load work order for bill', workOrderRes.error);
  }
  if (workflowRes?.error) {
    console.error('Failed to load bill workflow', workflowRes.error);
  }
  if (auditRes?.error) {
    console.error('Failed to load bill approval audit', auditRes.error);
  }
  if (applicationsRes?.error) {
    console.error('Failed to load bill applications', applicationsRes.error);
  }
  if (bankAccountsRes?.error) {
    console.error('Failed to load bank accounts', bankAccountsRes.error);
  }
  if (creditAccountsRes?.error) {
    console.error('Failed to load credit accounts', creditAccountsRes.error);
  }
  if (vendorListRes?.error) {
    console.error('Failed to load vendors', vendorListRes.error);
  }
  if (billOptionsRes?.error) {
    console.error('Failed to load vendor bills for payment forms', billOptionsRes.error);
  }

  const rawLines = linesRes.data.filter(
    (line) => String(line?.posting_type || '').toLowerCase() !== 'credit',
  );
  const vendor = vendorRes?.data;

  const vendorContact = vendor && typeof vendor.contacts === 'object' ? vendor.contacts : null;
  const vendorName =
    (vendorContact?.display_name as string | undefined) ||
    (vendorContact?.company_name as string | undefined) ||
    'Vendor';
  const workOrder = workOrderRes?.data ?? null;
  const workflow = workflowRes?.data ?? null;
  const approvalState = (workflow as any)?.approval_state ?? 'draft';
  const auditEntries = auditRes?.data ?? [];
  const applications = applicationsRes?.data ?? [];
  const hasReconciledApplications = applications.some(
    (app: any) => (app?.source as any)?.is_reconciled,
  );
  const bankAccountOptions: Option[] = (bankAccountsRes?.data ?? []).map((row: any) => ({
    id: String(row.id),
    label: row.name || 'Bank account',
    meta: row.account_number ? `#${row.account_number}` : null,
  }));
  const creditAccountOptions: Option[] = (creditAccountsRes?.data ?? []).map((row: any) => ({
    id: String(row.id),
    label: row.name || 'GL account',
    meta: row.account_number ? `#${row.account_number}` : null,
  }));
  const vendorOptions: Option[] = (vendorListRes?.data ?? []).map((row: any) => ({
    id: String(row.id),
    label:
      (row?.contacts?.display_name as string) ||
      (row?.contacts?.company_name as string) ||
      'Vendor',
    meta: null,
  }));
  if (bill.vendor_id && !vendorOptions.some((v) => v.id === String(bill.vendor_id))) {
    vendorOptions.unshift({
      id: String(bill.vendor_id),
      label: vendorName,
      meta: null,
    });
  }
  const billOptions: Option[] = (billOptionsRes?.data ?? []).map((row: any) => ({
    id: String(row.id),
    label:
      row.reference_number ||
      row.memo ||
      (row.id ? `Bill ${String(row.id).slice(0, 6)}` : 'Bill'),
    meta: `${formatCurrency(row.total_amount ?? 0)} • Due ${formatDate(
      row.due_date || bill.due_date || bill.date,
    )}`,
  }));
  if (!billOptions.some((b) => b.id === bill.id)) {
    billOptions.unshift({
      id: bill.id,
      label: bill.reference_number || bill.memo || `Bill ${bill.id.slice(0, 6)}`,
      meta: `${formatCurrency(bill.total_amount ?? 0)} • Due ${formatDate(
        bill.due_date || bill.date,
      )}`,
    });
  }

  let billFiles: BillFileRecord[] = [];
  try {
    const orgId = bill.org_id;
    const billIdForLink = bill.id ? String(bill.id) : null;

    if (orgId && billIdForLink) {
      const { data: filesData, error: filesError } = await db
        .from('files')
        .select('id, title, file_name, created_at, created_by, buildium_file_id, buildium_href')
        .eq('org_id', orgId)
        .ilike('storage_key', `bill/${billIdForLink}/%`)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filesError) {
        console.error('Failed to load bill files', filesError);
      } else if (filesData?.length) {
        billFiles = filesData
          .map((file) => ({
            id: file.id,
            title: file.title || file.file_name || 'File',
            uploadedAt: file.created_at,
            uploadedBy: file.created_by || null,
            buildiumFileId: file.buildium_file_id || null,
            buildiumHref: file.buildium_href || null,
            buildiumSyncError: null,
          }))
          .filter((file: BillFileRecord) => file.uploadedAt)
          .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
      }
    }
  } catch (error) {
    console.error('Failed to load bill file attachments', error);
  }

  const payments: PaymentRow[] = paymentsRes.data;
  const bankAccountIds = payments
    .map((p) => p.bank_gl_account_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  let bankAccountMap = new Map<string, { name: string | null }>();
  if (bankAccountIds.length) {
    const { data: banks, error: bankErr } = await db
      .from('gl_accounts')
      .select('id, name')
      .in('id', bankAccountIds);
    if (bankErr) {
      console.error('Failed to load bank accounts for payments', bankErr);
    } else if (banks?.length) {
      bankAccountMap = new Map(banks.map((b) => [b.id, { name: b.name ?? null }]));
    }
  }
  // Fetch payment lines to derive amounts if total_amount is missing
  const paymentIds = payments.map((p) => p.id).filter(Boolean);
  let paymentLineSums = new Map<string, number>();
  if (paymentIds.length) {
    const { data: paymentLines, error: payLineErr } = await db
      .from('transaction_lines')
      .select('transaction_id, posting_type, amount')
      .in('transaction_id', paymentIds);
    if (payLineErr) {
      console.error('Failed to load payment lines', payLineErr);
    } else if (paymentLines) {
      paymentLineSums = paymentLines.reduce((map, line) => {
        const amt = Number(line?.amount ?? 0);
        const key = line?.transaction_id as string;
        const prev = map.get(key) ?? 0;
        // Sum debits as amount paid; if none, fall back to absolute total
        const isDebit = String(line?.posting_type || '').toLowerCase() === 'debit';
        const add = isDebit ? amt : 0;
        map.set(key, prev + add);
        return map;
      }, new Map<string, number>());
    }
  }

  const paymentsWithDisplay = payments.map((p) => {
    const debitSum = paymentLineSums.get(p.id) ?? 0;
    const rawAmount = Number(p.total_amount ?? 0) || debitSum || 0;
    const displayAmount = Math.abs(rawAmount);
    return {
      ...p,
      bankName: bankAccountMap.get(p.bank_gl_account_id || '')?.name ?? '—',
      displayDate: formatDate(p.paid_date || p.date),
      displayAmount,
      displayMethod: p.payment_method || (p.check_number ? 'Check' : '—'),
    };
  });
  const paymentsTotal = paymentsWithDisplay.reduce(
    (sum, p) => sum + (Number.isFinite(p.displayAmount) ? p.displayAmount : 0),
    0,
  );
  const appliedPaymentTotal = applications.reduce((sum: number, app: any) => {
    const amt = Number(app?.applied_amount ?? 0);
    return app?.source_type === 'payment' && Number.isFinite(amt) ? sum + amt : sum;
  }, 0);
  const appliedCreditTotal = applications.reduce((sum: number, app: any) => {
    const amt = Number(app?.applied_amount ?? 0);
    return app && ['credit', 'refund'].includes(String(app?.source_type || '')) && Number.isFinite(amt)
      ? sum + amt
      : sum;
  }, 0);
  const applicationNet = appliedPaymentTotal + appliedCreditTotal;

  const billAmount = Number(bill.total_amount ?? 0) || 0;
  const lineItemsInitialTotalFallback = rawLines.reduce((sum, line) => {
    const amount = Math.abs(Number(line?.amount ?? 0)) || 0;
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const billDueAmount = billAmount > 0 ? billAmount : lineItemsInitialTotalFallback;
  const billDateLabel = formatDate(bill.date);
  const billDueLabel = formatDate(bill.due_date);
  const ledgerStatus = normalizeBillStatus(bill.status);
  const statusNormalized = (() => {
    const paidAmount = applicationNet || paymentsTotal;
    if (paidAmount > 0 && paidAmount < billDueAmount) return 'Partially paid' as BillStatusLabel;
    if (paidAmount >= billDueAmount && billDueAmount > 0) return 'Paid' as BillStatusLabel;
    return normalizeBillStatus(bill.status);
  })();
  const statusLabel = deriveBillStatusFromDates(statusNormalized, bill.due_date ?? null, bill.paid_date ?? null);

  // First, calculate line items and totals
  const mappedLineItems = rawLines
    .map((line, index) => {
      const propertyName =
        (line?.properties && typeof line.properties === 'object' && 'name' in line.properties
          ? (line.properties as { name?: string | null }).name
          : undefined) || '—';
      const unitNumber =
        line?.units && typeof line.units === 'object'
          ? (line.units as { unit_number?: string | null; unit_name?: string | null })
              .unit_number ||
            (line.units as { unit_number?: string | null; unit_name?: string | null }).unit_name
          : null;
      const account =
        line?.gl_accounts && typeof line.gl_accounts === 'object'
          ? (line.gl_accounts as {
              name?: string | null;
              account_number?: string | number | null;
              type?: string | null;
            })
          : null;
      const accountName = account?.name || null;
      const accountNumber = account?.account_number || null;
      const accountType = account?.type || null;
      const normalizedAccountName = (accountName || '').trim().toLowerCase();

      const amountRaw = Number(line?.amount ?? 0);
      const initialAmount = Math.abs(amountRaw) || 0;
      const remainingAmount = statusLabel === 'Paid' ? 0 : initialAmount;

      return {
        item: {
          id: line?.id ? String(line.id) : `${bill.id}-line-${index}`,
          propertyId: line?.property_id ? String(line.property_id) : null,
          propertyName,
          unitLabel: unitNumber ? String(unitNumber) : 'Property level',
          accountLabel: accountName || (accountNumber ? String(accountNumber) : 'Account'),
          accountNumber: accountNumber ? String(accountNumber) : null,
          accountType: accountType ? String(accountType) : null,
          description: line?.memo || bill.memo || '—',
          initialAmount,
          remainingAmount,
        } satisfies LineItem,
        initialAmount,
        normalizedAccountName,
      };
    })
    .filter(({ initialAmount }) => initialAmount > 0);

  const withoutAccountsPayable = mappedLineItems.filter(
    ({ normalizedAccountName }) => !normalizedAccountName.startsWith('accounts payable'),
  );

  const debitLineItems = (
    withoutAccountsPayable.length ? withoutAccountsPayable : mappedLineItems
  ).map(({ item }) => item);

  // Calculate totals immediately after debitLineItems is defined
  const lineItemsInitialTotal = debitLineItems.reduce(
    (sum, item) => sum + (item.initialAmount || 0),
    0,
  );
  // Now calculate derived values that depend on the totals
  const baseDue = lineItemsInitialTotal || billAmount;
  const remainingAmount =
    statusLabel === 'Paid' ? 0 : Math.max(baseDue - (applicationNet || paymentsTotal), 0);

  const detailEntries: DetailEntry[] = [
    { name: 'Date', value: billDateLabel },
    { name: 'Due', value: billDueLabel },
    { name: 'Ledger status', value: statusLabel || ledgerStatus || '—' },
    {
      name: 'Approval',
      value: approvalState ? String(approvalState).replace(/_/g, ' ') : 'draft',
    },
    { name: 'Reference number', value: bill.reference_number || '—' },
    {
      name: 'Work order',
      value:
        workOrder?.id && workOrder.subject ? (
          <Link href={`/maintenance/work-orders/${workOrder.id}`} className="text-primary hover:underline">
            {workOrder.subject}
          </Link>
        ) : (
          '—'
        ),
    },
    { name: 'Pay to', value: vendorName || '—' },
    { name: 'Memo', value: bill.memo || 'Add a memo', multiline: true },
  ];
  if ((workflow as any)?.reversal_transaction_id) {
    detailEntries.push({
      name: 'Reversal transaction',
      value: (
        <Link
          href={`/transactions/${(workflow as any).reversal_transaction_id}`}
          className="text-primary hover:underline"
        >
          View reversal
        </Link>
      ),
    });
  }

  return (
    <PageShell>
      <PageHeader
        title={
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-foreground text-2xl font-semibold">{vendorName}</span>
            {statusLabel ? (
              <Badge
                variant={statusToVariant(statusLabel)}
                className={cn(
                  'uppercase',
                  statusLabel === 'Overdue' && 'border-destructive/40 bg-destructive/10 text-destructive',
                  statusLabel === 'Due' && 'border-amber-300 bg-amber-50 text-amber-700',
                )}
              >
                {statusLabel}
              </Badge>
            ) : null}
            <Badge variant="outline" className="capitalize">
              {String(approvalState || 'draft').replace(/_/g, ' ')}
            </Badge>
          </div>
        }
        description={`Bill ${formatCurrency(lineItemsInitialTotal || billAmount)} | Due: ${billDueLabel}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" asChild>
              <Link href={`/bills/${bill.id}/pay`}>Pay bill</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/bills/${bill.id}/edit`}>Enter charges</Link>
            </Button>
            <BillActionsMenu billId={bill.id} />
          </div>
        }
      />
      <PageBody>
        <div className="space-y-6">
          <Link
            href="/bills"
            className="text-muted-foreground inline-flex items-center gap-2 text-sm hover:text-primary"
          >
            <span aria-hidden>←</span>
            Back to bills
          </Link>
          {approvalState === 'approved' ? (
            <div className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This bill is approved. Amount and line edits are locked; only memo and reference updates are allowed.
            </div>
          ) : null}
          <PageColumns
            gap="xl"
            className="lg:grid-cols-[minmax(0,2fr)_minmax(480px,1.2fr)]"
            primaryClassName="min-w-0 space-y-6"
            secondaryClassName="space-y-6"
            primary={
              <>
                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="border-border/60 bg-muted/30 border-b">
                    <CardTitle>Bill details</CardTitle>
                  </CardHeader>
                  <CardContent className="px-6 py-6">
                    <dl className="grid gap-x-12 gap-y-6 text-sm md:grid-cols-3">
                      {detailEntries.map((entry) => (
                        <div key={entry.name} className="space-y-1.5">
                          <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                            {entry.name}
                          </dt>
                          <dd
                            className={cn(
                              'text-foreground text-sm',
                              entry.multiline ? 'whitespace-pre-wrap' : undefined,
                            )}
                          >
                            {entry.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>

                <BillApprovalWorkflow
                  billId={bill.id}
                  approvalState={approvalState}
                  audit={auditEntries}
                  canVoid={!hasReconciledApplications}
                />

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-3 border-b">
                    <CardTitle>Item details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="relative overflow-x-auto">
                      <Table className="min-w-[720px] text-sm">
                        <TableHeader>
                            <TableRow className="border-border/60 bg-muted/30 sticky top-0 z-10 border-b">
                              <TableHead className="text-foreground w-[18rem] px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                                Property or company
                              </TableHead>
                              <TableHead className="text-foreground w-[12rem] px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                                Unit
                            </TableHead>
                            <TableHead className="text-foreground w-[18rem] px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                              Account
                            </TableHead>
                            <TableHead className="text-foreground px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                              Description
                            </TableHead>
                            <TableHead className="text-foreground w-[10rem] px-4 py-3 text-right text-xs font-semibold tracking-wide uppercase">
                              Amount
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-border/60 divide-y">
                          {debitLineItems.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                              <TableCell
                                colSpan={5}
                                className="text-muted-foreground bg-background px-4 py-8 text-center text-sm"
                              >
                                No itemized charges recorded for this bill.
                              </TableCell>
                            </TableRow>
                          ) : (
                            <>
                              {debitLineItems.map((item, index) => (
                                <TableRow
                                  key={item.id}
                                  className={cn(
                                    'hover:bg-muted/20 transition-colors',
                                    index % 2 === 1 ? 'bg-muted/10' : undefined,
                                  )}
                                >
                                <TableCell className="text-foreground px-4 py-3">
                                  {item.propertyName}
                                </TableCell>
                                <TableCell className="text-foreground px-4 py-3">
                                  {item.unitLabel}
                                </TableCell>
                                <TableCell className="text-foreground px-4 py-3">
                                  <div className="font-medium">{item.accountLabel}</div>
                                  {(item.accountNumber || item.accountType) && (
                                    <div className="text-muted-foreground text-xs">
                                      {item.accountNumber ? `#${item.accountNumber}` : ''}
                                      {item.accountNumber && item.accountType ? ' • ' : ''}
                                      {item.accountType
                                        ? item.accountType.replace(/_/g, ' ').toLowerCase()
                                        : ''}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell className="text-foreground px-4 py-3 whitespace-pre-wrap">
                                  {item.description}
                                </TableCell>
                                <TableCell className="sticky right-0 border-b border-border/60 px-4 py-3 text-right font-semibold backdrop-blur supports-[backdrop-filter]:bg-background/80">
                                  {formatCurrency(item.initialAmount)}
                                </TableCell>
                                </TableRow>
                              ))}
                            </>
                          )}
                        </TableBody>
                        <TableFooter className="bg-background font-semibold">
                          <TableRow className="border-border/60 border-t">
                            <TableCell colSpan={4} className="text-foreground px-4 py-3">
                              Total
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              {formatCurrency(lineItemsInitialTotal || billAmount)}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                    <div className="border-border/60 bg-muted/10 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground uppercase tracking-wide">Remaining</span>
                        <span className="font-semibold">{formatCurrency(remainingAmount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground uppercase tracking-wide">Total</span>
                        <span className="font-semibold">
                          {formatCurrency(lineItemsInitialTotal || billAmount)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {hasReconciledApplications ? (
                  <div className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    One or more applications are reconciled and locked. Remove/void actions are disabled for those rows.
                  </div>
                ) : null}

                <BillApplicationsList billId={bill.id} applications={applications as any[]} />

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="border-border/60 bg-muted/30 border-b">
                    <CardTitle>Payment history</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="relative overflow-x-auto">
                      <Table className="min-w-[640px] text-sm">
                        <TableHeader>
                          <TableRow className="border-border/60 bg-muted/30 sticky top-0 z-10 border-b">
                            <TableHead className="text-foreground w-[14rem] px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                              Bank account
                            </TableHead>
                            <TableHead className="text-foreground w-[10rem] px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                              Date
                            </TableHead>
                            <TableHead className="text-foreground w-[10rem] px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                              Method
                            </TableHead>
                            <TableHead className="text-foreground w-[10rem] px-4 py-3 text-right text-xs font-semibold tracking-wide uppercase">
                              Amount paid
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody className="divide-border/60 divide-y">
                          {paymentsWithDisplay.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                              <TableCell
                                colSpan={4}
                                className="text-muted-foreground bg-background px-4 py-6 text-center text-sm"
                              >
                                No payments recorded for this bill.
                              </TableCell>
                            </TableRow>
                          ) : (
                            paymentsWithDisplay.map((p) => (
                              <TableRow key={p.id} className="hover:bg-muted/20 transition-colors">
                                <TableCell className="text-primary px-4 py-3">
                                  {p.bankName || '—'}
                                </TableCell>
                                <TableCell className="text-foreground px-4 py-3">
                                  {p.displayDate}
                                </TableCell>
                                <TableCell className="text-foreground px-4 py-3">
                                  {p.displayMethod || '—'}
                                </TableCell>
                                <TableCell className="text-foreground px-4 py-3 text-right font-medium">
                                  {formatCurrency(p.displayAmount)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <BillFileAttachmentsCard
                  billId={bill.id}
                  uploaderName={vendorName}
                  initialFiles={billFiles}
                />
              </>
            }
            secondary={
              <>
                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="border-border/60 bg-muted/30 border-b">
                    <CardTitle>Bill amount</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 px-6 py-6">
                    <div className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                      Remaining
                    </div>
                    <div className="text-foreground text-2xl font-semibold">
                      {formatCurrency(remainingAmount)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/70 shadow-sm">
                  <CardHeader className="border-border/60 bg-muted/30 border-b">
                    <CardTitle>
                      Available credits <span className="text-muted-foreground text-xs">(i)</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 px-6 py-6 text-sm">
                    <div className="border-border/60 bg-muted/20 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center">
                      <div className="text-foreground text-lg font-semibold">0.00</div>
                      <div className="text-muted-foreground text-xs">No vendor credits</div>
                    </div>
                    <Button type="button" variant="outline" size="sm">
                      Add a credit
                    </Button>
                  </CardContent>
                </Card>

                <BillPaymentForm
                  defaultBillId={bill.id}
                  bankAccounts={bankAccountOptions}
                  billOptions={billOptions}
                />
                <VendorCreditForm
                  vendorId={bill.vendor_id ? String(bill.vendor_id) : ''}
                  vendorOptions={vendorOptions}
                  creditAccounts={creditAccountOptions}
                  billOptions={billOptions}
                  defaultBillId={bill.id}
                />
              </>
            }
          />
        </div>
      </PageBody>
    </PageShell>
  );
}
