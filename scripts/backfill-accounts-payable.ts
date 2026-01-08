#!/usr/bin/env npx tsx
/**
 * Backfill Accounts Payable legs for Bills and Bill Payments.
 * - Adds A/P credit lines to Bills/Charges if missing.
 * - For Bill Payment/Owner Draw outflows, adds A/P debit and bank credit if missing.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

const isApply = process.argv.includes('--apply');
const propIdx = process.argv.indexOf('--property');
const propertyId = propIdx !== -1 ? process.argv[propIdx + 1] : null;

async function resolveApGlAccountId(orgId: string | null): Promise<string | null> {
  if (!orgId) return null;
  const { data, error } = await supabase.rpc('resolve_ap_gl_account_id', { p_org_id: orgId });
  if (error) throw error;
  return (data as any) ?? null;
}

async function getPropertyContext(propertyId: string) {
  const { data, error } = await supabase
    .from('properties')
    .select('operating_bank_gl_account_id, deposit_trust_gl_account_id, org_id')
    .eq('id', propertyId)
    .maybeSingle();
  if (error) throw error;
  return {
    bankGlId: (data as any)?.operating_bank_gl_account_id ?? null,
    depositTrustGlId: (data as any)?.deposit_trust_gl_account_id ?? null,
    orgId: (data as any)?.org_id ?? null,
  };
}

async function main() {
  if (!propertyId) {
    console.error('Usage: backfill-accounts-payable --property <propertyId> [--apply]');
    process.exit(1);
  }

  const propertyContext = await getPropertyContext(propertyId);
  const bankGlId = propertyContext.bankGlId ?? propertyContext.depositTrustGlId ?? null;
  const apId = await resolveApGlAccountId(propertyContext.orgId ?? null);

  if (!apId) {
    console.error('Accounts Payable GL not found for property org.');
    process.exit(1);
  }

  // Bills/Charges: add AP credit (select Bills via their lines for the property)
  const { data: billLines } = await supabase
    .from('transaction_lines')
    .select(
      'id, transaction_id, gl_account_id, amount, posting_type, property_id, unit_id, lease_id, date, transactions(transaction_type, total_amount, date)',
    )
    .eq('property_id', propertyId)
    .or('transactions.transaction_type.ilike.%Bill%,transactions.transaction_type.ilike.%Charge%');

  const billsMap = new Map<
    string,
    { transaction_type: string; total_amount: number | null; date: string | null }
  >();
  for (const line of billLines || []) {
    const txId = line.transaction_id;
    if (!txId) continue;
    if (!billsMap.has(txId)) {
      billsMap.set(txId, {
        transaction_type: (line as any)?.transactions?.transaction_type || '',
        total_amount: (line as any)?.transactions?.total_amount ?? 0,
        date: (line as any)?.transactions?.date ?? null,
      });
    }
  }

  const linesByTx = new Map<string, any[]>();
  for (const line of billLines || []) {
    const arr = linesByTx.get(line.transaction_id) || [];
    arr.push(line);
    linesByTx.set(line.transaction_id, arr);
  }

  for (const [billId, billMeta] of billsMap.entries()) {
    const txLines = linesByTx.get(billId) || [];
    const hasAp = txLines.some((l) => l.gl_account_id === apId);
    if (hasAp) continue;
    const debits = txLines
      .filter((l) => l.posting_type === 'Debit')
      .reduce((sum, l) => sum + Math.abs(Number(l.amount) || 0), 0);
    const amount = debits || Math.abs(Number(billMeta.total_amount) || 0);
    if (!amount) continue;
    const baseLine = txLines[0] || {};
    const lineDate = billMeta.date ?? baseLine.date ?? new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const apLine = {
      transaction_id: billId,
      gl_account_id: apId,
      amount,
      posting_type: 'Credit',
      date: lineDate,
      account_entity_type: 'Rental',
      property_id: baseLine.property_id ?? propertyId,
      unit_id: baseLine.unit_id ?? null,
      lease_id: baseLine.lease_id ?? null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    if (isApply) {
      const { error } = await supabase.from('transaction_lines').insert(apLine);
      if (error) throw error;
    }
    console.log(`${isApply ? '[added]' : '[would add]'} A/P credit on bill tx=${billId} amount=${amount}`);
  }

  // Bill Payments / Owner Draw: add A/P debit + bank credit (select via lines for the property)
  const { data: payLines } = await supabase
    .from('transaction_lines')
    .select(
      'id, transaction_id, gl_account_id, amount, posting_type, property_id, unit_id, lease_id, date, gl_accounts(is_bank_account), transactions(transaction_type, total_amount, date)',
    )
    .eq('property_id', propertyId)
    .or('transactions.transaction_type.ilike.%BillPayment%,transactions.transaction_type.ilike.%Owner%');

  const payByTx = new Map<string, any[]>();
  for (const l of payLines || []) {
    const arr = payByTx.get(l.transaction_id) || [];
    arr.push(l);
    payByTx.set(l.transaction_id, arr);
  }

  const payMeta = new Map<string, { transaction_type: string; total_amount: number | null; date: string | null }>();
  for (const line of payLines || []) {
    const txId = line.transaction_id;
    if (!txId) continue;
    if (!payMeta.has(txId)) {
      payMeta.set(txId, {
        transaction_type: (line as any)?.transactions?.transaction_type || '',
        total_amount: (line as any)?.transactions?.total_amount ?? 0,
        date: (line as any)?.transactions?.date ?? null,
      });
    }
  }

  for (const [payId, meta] of payMeta.entries()) {
    const txLines = payByTx.get(payId) || [];
    const hasBank = txLines.some((l) => l.gl_accounts?.is_bank_account);
    const hasAp = txLines.some((l) => l.gl_account_id === apId);
    const amt = Math.abs(Number(meta.total_amount) || 0);
    if (!amt || !bankGlId) continue;
    const baseLine = txLines[0] || {};
    const lineDate = meta.date ?? baseLine.date ?? new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    if (!hasBank) {
      const bankLine = {
        transaction_id: payId,
        gl_account_id: bankGlId,
        amount: amt,
        posting_type: 'Credit',
        date: lineDate,
        account_entity_type: 'Rental',
        property_id: baseLine.property_id ?? propertyId,
        unit_id: baseLine.unit_id ?? null,
        lease_id: baseLine.lease_id ?? null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      if (isApply) {
        const { error } = await supabase.from('transaction_lines').insert(bankLine);
        if (error) throw error;
      }
      console.log(`${isApply ? '[added]' : '[would add]'} bank credit on payment tx=${payId} amount=${amt}`);
    }
    if (!hasAp) {
      const apDebit = {
        transaction_id: payId,
        gl_account_id: apId,
        amount: amt,
        posting_type: 'Debit',
        date: lineDate,
        account_entity_type: 'Rental',
        property_id: baseLine.property_id ?? propertyId,
        unit_id: baseLine.unit_id ?? null,
        lease_id: baseLine.lease_id ?? null,
        created_at: nowIso,
        updated_at: nowIso,
      };
      if (isApply) {
        const { error } = await supabase.from('transaction_lines').insert(apDebit);
        if (error) throw error;
      }
      console.log(`${isApply ? '[added]' : '[would add]'} A/P debit on payment tx=${payId} amount=${amt}`);
    }
  }

  console.log('Backfill complete.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
