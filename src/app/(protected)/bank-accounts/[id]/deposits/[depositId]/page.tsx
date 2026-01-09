import { redirect } from 'next/navigation';
import { supabase, supabaseAdmin } from '@/lib/db';

export default async function BankAccountDepositByIdPage({
  params,
}: {
  params: Promise<{ id: string; depositId: string }>;
}) {
  const { id: bankAccountId, depositId } = await params;
  const db = supabaseAdmin || supabase;
  if (!db) {
    redirect(`/bank-accounts/${bankAccountId}`);
  }

  const { data: meta } = await (db as any)
    .from('deposit_meta')
    .select('transaction_id')
    .eq('deposit_id', depositId)
    .maybeSingle();

  const transactionId = meta?.transaction_id ?? depositId;
  redirect(`/bank-accounts/${bankAccountId}/deposits/${transactionId}`);
}
