import { notFound } from 'next/navigation';

import {
  PageBody,
  PageHeader,
  PageShell,
} from '@/components/layout/page-shell';
import { supabase, supabaseAdmin } from '@/lib/db';
import { getBillsForCheckPreparation } from '@/server/bills/pay-bills-by-check';
import PreparePaymentForm, {
  type PreparePaymentBill,
  type PreparePaymentGroup,
} from '@/components/bills/PreparePaymentForm';

type SearchParams = {
  billIds?: string;
};

export default async function PreparePaymentPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await (searchParams || Promise.resolve({}))) as Record<
    string,
    string | undefined
  >;

  const billIdsParam = sp.billIds || '';
  const billIds = billIdsParam
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  if (!billIds.length) {
    notFound();
  }

  const bills = await getBillsForCheckPreparation(billIds);
  if (!bills.length) {
    notFound();
  }

  const db = supabaseAdmin || supabase;
  const bankGlIds = Array.from(
    new Set(
      bills
        .map((b) => b.operating_bank_gl_account_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const bankLabelById = new Map<string | null, string>();
  if (bankGlIds.length) {
    const { data: bankRows } = await db
      .from('gl_accounts')
      .select('id, name, bank_account_number')
      .in('id', bankGlIds);
    for (const row of bankRows || []) {
      const id = (row as any).id as string;
      const name = (row as any).name || 'Bank account';
      const acct = (row as any).bank_account_number as string | null;
      const lastFour = acct && acct.length > 4 ? acct.slice(-4) : acct;
      const suffix = lastFour ? ` ••••${lastFour}` : '';
      bankLabelById.set(id, `${name}${suffix}`);
    }
  }

  const groups = Array.from(
    bills.reduce((map, bill) => {
      const bankId = bill.operating_bank_gl_account_id;
      const key = bankId ?? '_none';
      const label =
        bankId && bankLabelById.get(bankId)
          ? bankLabelById.get(bankId)
          : bankId
            ? 'Bank account'
            : 'No operating bank account';
      const group =
        map.get(key) ??
        {
          bankGlAccountId: bankId,
          bankLabel: label,
          bills: [] as typeof bills,
        };
      group.bills.push(bill);
      map.set(key, group);
      return map;
    }, new Map<string, { bankGlAccountId: string | null; bankLabel: string; bills: typeof bills }>()),
  );

  const total = bills.reduce((sum, bill) => sum + (bill.remaining_amount || 0), 0);

  const formGroups: PreparePaymentGroup[] = groups.map((group) => ({
    bankGlAccountId: group.bankGlAccountId,
    bankLabel: group.bankLabel,
    bills: group.bills.map(
      (bill): PreparePaymentBill => ({
        id: bill.id,
        vendorName: bill.vendor_name,
        propertyName: bill.property_name,
        remainingAmount: bill.remaining_amount,
        bankGlAccountId: bill.operating_bank_gl_account_id,
      }),
    ),
  }));

  return (
    <PageShell>
      <PageHeader
        title="Pay bills by check"
        description="Review and confirm check payments for the selected bills."
      />
      <PageBody>
        <div className="flex min-h-[60vh] items-start justify-center py-10">
          <PreparePaymentForm totalAmount={total} groups={formGroups} />
        </div>
      </PageBody>
    </PageShell>
  );
}
