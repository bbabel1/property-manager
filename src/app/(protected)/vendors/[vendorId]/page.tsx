import { notFound } from 'next/navigation';

import { supabase, supabaseAdmin } from '@/lib/db';
import type { Database } from '@/types/database';

import {
  VendorsDetailsClient,
  type RecentVendorWorkOrder,
  type VendorBillRow,
} from './_components/VendorDetailsClient';

type VendorRow = Database['public']['Tables']['vendors']['Row'];
type ContactRow = Database['public']['Tables']['contacts']['Row'];
type VendorCategoryRow = Database['public']['Tables']['vendor_categories']['Row'];

type VendorRecord = VendorRow & {
  contact: ContactRow | null;
  category: Pick<VendorCategoryRow, 'id' | 'name'> | null;
};

export default async function VendorDetailsPage({
  params,
}: {
  params: Promise<{ vendorId: string }>;
}) {
  const { vendorId } = await params;
  const db = supabaseAdmin || supabase;

  const [vendorRes, categoriesRes, expenseAccountsRes] = await Promise.all([
    db
      .from('vendors')
      .select(
        `
        id,
        buildium_vendor_id,
        buildium_category_id,
        contact_id,
        vendor_category,
        is_active,
        website,
        insurance_provider,
        insurance_policy_number,
        insurance_expiration_date,
        account_number,
        expense_gl_account_id,
        tax_payer_type,
        tax_id,
        tax_payer_name1,
        tax_payer_name2,
        include_1099,
        tax_address_line1,
        tax_address_line2,
        tax_address_line3,
        tax_address_city,
        tax_address_state,
        tax_address_postal_code,
        tax_address_country,
        notes,
        contact:contact_id(
          id,
          display_name,
          company_name,
          first_name,
          last_name,
          is_company,
          primary_email,
          alt_email,
          primary_phone,
          alt_phone,
          primary_address_line_1,
          primary_address_line_2,
          primary_city,
          primary_state,
          primary_postal_code,
          primary_country
        ),
        category:vendor_category(
          id,
          name
        )
      `,
      )
      .eq('id', vendorId)
      .maybeSingle(),
    db.from('vendor_categories').select('id, name').order('name', { ascending: true }),
    db
      .from('gl_accounts')
      .select('buildium_gl_account_id, name, account_number, type, is_active')
      .eq('type', 'Expense')
      .eq('is_active', true)
      .order('account_number', { ascending: true }),
  ]);

  if (vendorRes.error) {
    console.error('Failed to fetch vendor', vendorRes.error);
  }
  if (categoriesRes.error) {
    console.error('Failed to fetch vendor categories', categoriesRes.error);
  }
  if (expenseAccountsRes.error) {
    console.error('Failed to fetch expense accounts', expenseAccountsRes.error);
  }

  const vendor = (vendorRes.data as VendorRecord | null) ?? null;
  if (!vendor) {
    notFound();
  }

  let recentWorkOrders: RecentVendorWorkOrder[] = [];
  let bills: VendorBillRow[] = [];
  try {
    const workOrdersRes = await db
      .from('work_orders')
      .select(
        `
        id,
        subject,
        status,
        priority,
        scheduled_date,
        updated_at,
        created_at,
        property:property_id(
          id,
          name
        )
      `,
      )
      .eq('vendor_id', vendor.id)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (workOrdersRes.error) {
      console.error('Failed to load vendor work orders', workOrdersRes.error);
    } else if (Array.isArray(workOrdersRes.data)) {
      recentWorkOrders = (workOrdersRes.data as any[]).map((workOrder) => {
        const property =
          workOrder?.property && typeof workOrder.property === 'object'
            ? (workOrder.property as { id?: string | null; name?: string | null })
            : null;

        const record: RecentVendorWorkOrder = {
          id: String(workOrder.id),
          subject: typeof workOrder.subject === 'string' ? workOrder.subject : 'Work order',
          status: typeof workOrder.status === 'string' ? workOrder.status : null,
          priority: typeof workOrder.priority === 'string' ? workOrder.priority : null,
          scheduledDate:
            typeof workOrder.scheduled_date === 'string' ? workOrder.scheduled_date : null,
          propertyId: property?.id ?? null,
          propertyName: property?.name ?? null,
          updatedAt:
            typeof workOrder.updated_at === 'string'
              ? workOrder.updated_at
              : typeof workOrder.created_at === 'string'
                ? workOrder.created_at
                : null,
        };

        return record;
      });
    }
  } catch (error) {
    console.error('Failed to load vendor work orders', error);
  }

  try {
    const billsRes = await db
      .from('transactions')
      .select(
        'id, date, due_date, total_amount, memo, reference_number, buildium_bill_id, transaction_type',
      )
      .eq('vendor_id', vendor.id)
      .eq('transaction_type', 'Bill')
      .order('due_date', { ascending: false })
      .order('date', { ascending: false });

    if (billsRes.error) {
      console.error('Failed to load vendor bills', billsRes.error);
    }

    const billRows = (billsRes.data as any[] | null) ?? [];
    const billIds = billRows
      .map((row) => (row?.id != null ? String(row.id) : null))
      .filter((id): id is string => Boolean(id));

    const lineByTransactionId = new Map<
      string,
      {
        propertyName: string | null;
        unitLabel: string | null;
        accountName: string | null;
        accountNumber: string | null;
        lineMemo: string | null;
      }
    >();

    if (billIds.length) {
      const linesRes = await db
        .from('transaction_lines')
        .select(
          'transaction_id, memo, gl_accounts(name, account_number), properties(name), units(unit_number, unit_name)',
        )
        .in('transaction_id', billIds);

      if (linesRes.error) {
        console.error('Failed to load vendor bill lines', linesRes.error);
      } else if (Array.isArray(linesRes.data)) {
        for (const line of linesRes.data as any[]) {
          const txId = line?.transaction_id ? String(line.transaction_id) : null;
          if (!txId || lineByTransactionId.has(txId)) continue;
          const unitLabel =
            (line?.units as any)?.unit_number ||
            (line?.units as any)?.unit_name ||
            null;

          lineByTransactionId.set(txId, {
            propertyName: (line?.properties as any)?.name ?? null,
            unitLabel: unitLabel || null,
            accountName: (line?.gl_accounts as any)?.name ?? null,
            accountNumber: (line?.gl_accounts as any)?.account_number ?? null,
            lineMemo: typeof line?.memo === 'string' ? line.memo : null,
          });
        }
      }
    }

    bills = billRows
      .map((row) => {
        const txId = row?.id != null ? String(row.id) : '';
        if (!txId) return null;
        const line = lineByTransactionId.get(txId);
        const billDate =
          typeof row?.due_date === 'string' && row.due_date
            ? row.due_date
            : typeof row?.date === 'string'
              ? row.date
              : null;

        const buildiumIdRaw = row?.buildium_bill_id;
        const parsedBuildiumId =
          typeof buildiumIdRaw === 'number'
            ? buildiumIdRaw
            : typeof buildiumIdRaw === 'string' && buildiumIdRaw.trim() !== ''
              ? Number(buildiumIdRaw)
              : null;
        const buildiumBillId =
          typeof parsedBuildiumId === 'number' && Number.isFinite(parsedBuildiumId)
            ? parsedBuildiumId
            : null;
        const amount = Number(row?.total_amount ?? 0);
        const mapped: VendorBillRow = {
          id: txId,
          billDate,
          totalAmount: Number.isFinite(amount) ? amount : 0,
          memo:
            typeof row?.memo === 'string' && row.memo.trim()
              ? row.memo
              : line?.lineMemo || null,
          referenceNumber:
            typeof row?.reference_number === 'string' && row.reference_number.trim()
              ? row.reference_number
              : null,
          buildiumBillId,
          propertyName: line?.propertyName || null,
          unitLabel: line?.unitLabel || null,
          accountName: line?.accountName || null,
          accountNumber: line?.accountNumber || null,
        };

        return mapped;
      })
      .filter((row): row is VendorBillRow => Boolean(row?.id));
  } catch (error) {
    console.error('Failed to load vendor bills', error);
  }

  const categories = (
    (categoriesRes.data as Pick<VendorCategoryRow, 'id' | 'name'>[] | null) ?? []
  ).map((cat) => ({
    id: cat.id,
    name: cat.name,
  }));

  const expenseAccounts = (
    (expenseAccountsRes.data as Array<{
      buildium_gl_account_id: number;
      name: string;
      account_number: string | null;
    }> | null) ?? []
  ).map((account) => ({
    id: account.buildium_gl_account_id,
    name: account.name,
    accountNumber: account.account_number,
  }));

  const vendorDetails = {
    id: vendor.id,
    buildium_vendor_id: vendor.buildium_vendor_id,
    buildium_category_id: vendor.buildium_category_id,
    contact_id: vendor.contact_id,
    vendor_category: vendor.vendor_category,
    is_active: vendor.is_active !== false,
    website: vendor.website,
    account_number: vendor.account_number,
    expense_gl_account_id: vendor.expense_gl_account_id,
    tax_payer_type: vendor.tax_payer_type,
    tax_id: vendor.tax_id,
    tax_payer_name1: vendor.tax_payer_name1,
    tax_payer_name2: vendor.tax_payer_name2,
    include_1099: vendor.include_1099,
    tax_address_line1: vendor.tax_address_line1,
    tax_address_line2: vendor.tax_address_line2,
    tax_address_line3: vendor.tax_address_line3,
    tax_address_city: vendor.tax_address_city,
    tax_address_state: vendor.tax_address_state,
    tax_address_postal_code: vendor.tax_address_postal_code,
    tax_address_country: vendor.tax_address_country,
    notes: vendor.notes,
    insurance_provider: vendor.insurance_provider,
    insurance_policy_number: vendor.insurance_policy_number,
    insurance_expiration_date: vendor.insurance_expiration_date,
    contact: vendor.contact,
    category: vendor.category,
  };

  return (
    <VendorsDetailsClient
      vendor={vendorDetails}
      categories={categories}
      expenseAccounts={expenseAccounts}
      recentWorkOrders={recentWorkOrders}
      bills={bills}
    />
  );
}
