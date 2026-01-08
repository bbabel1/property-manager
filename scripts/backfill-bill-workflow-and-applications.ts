#!/usr/bin/env npx tsx
/**
 * Backfill bill_workflow and bill_applications with per-org batching.
 * Supports DRY_RUN=true to preview changes without writes.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

config({ path: '.env.local' });

const DRY_RUN = process.env.DRY_RUN === 'true';
const BATCH_SIZE = 100;

interface MigrationMetrics {
  orgsProcessed: number;
  workflowsCreated: number;
  applicationsCreated: number;
  failures: Array<{ orgId: string; error: string }>;
  apAccountResolved: number;
  apAccountMissing: number;
  workflowsSkipped: number;
  applicationsSkipped: number;
  validation: {
    billsMissingWorkflow: number;
    billLinksMissingApplication: number;
  };
}

const metrics: MigrationMetrics = {
  orgsProcessed: 0,
  workflowsCreated: 0,
  applicationsCreated: 0,
  failures: [],
  apAccountResolved: 0,
  apAccountMissing: 0,
  workflowsSkipped: 0,
  applicationsSkipped: 0,
  validation: {
    billsMissingWorkflow: 0,
    billLinksMissingApplication: 0,
  },
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
);

async function listOrgIds(): Promise<string[]> {
  const { data, error } = await supabase.from('organizations').select('id');
  if (error) throw error;
  return (data || []).map((row: any) => String(row.id));
}

async function backfillWorkflowForOrg(orgId: string) {
  let offset = 0;
  while (true) {
    const { data: bills, error } = await supabase
      .from('transactions')
      .select('id, created_at, total_amount')
      .eq('transaction_type', 'Bill')
      .eq('org_id', orgId)
      .range(offset, offset + BATCH_SIZE - 1);
    if (error) throw error;
    if (!bills || bills.length === 0) break;

    const billIds = bills.map((b: any) => b.id);
    const { data: existing } = await supabase
      .from('bill_workflow')
      .select('bill_transaction_id')
      .in('bill_transaction_id', billIds);
    const existingSet = new Set((existing || []).map((r: any) => String(r.bill_transaction_id)));

    // Determine which have payments via legacy bill_transaction_id link
    const { data: payments } = await supabase
      .from('transactions')
      .select('bill_transaction_id')
      .eq('org_id', orgId)
      .in('bill_transaction_id', billIds)
      .in('transaction_type', ['Payment', 'Check']);
    const paidSet = new Set((payments || []).map((p: any) => String(p.bill_transaction_id)));

    const inserts = bills
      .filter((b: any) => !existingSet.has(String(b.id)))
      .map((b: any) => {
        const approved = paidSet.has(String(b.id));
        return {
          bill_transaction_id: b.id,
          org_id: orgId,
          approval_state: approved ? 'approved' : 'draft',
          submitted_at: approved ? b.created_at : null,
          approved_at: approved ? b.created_at : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

    if (inserts.length) {
      if (DRY_RUN) {
        metrics.workflowsCreated += inserts.length;
      } else {
        const { error: insertErr } = await supabase.from('bill_workflow').upsert(inserts, {
          onConflict: 'bill_transaction_id',
        });
        if (insertErr) throw insertErr;
        metrics.workflowsCreated += inserts.length;
      }
    } else {
      metrics.workflowsSkipped += bills.length;
    }

    offset += BATCH_SIZE;
  }
}

async function backfillApplicationsForOrg(orgId: string) {
  let offset = 0;
  while (true) {
    const { data: payments, error } = await supabase
      .from('transactions')
      .select('id, bill_transaction_id, total_amount')
      .eq('org_id', orgId)
      .not('bill_transaction_id', 'is', null)
      .in('transaction_type', ['Payment', 'Check'])
      .range(offset, offset + BATCH_SIZE - 1);
    if (error) throw error;
    if (!payments || payments.length === 0) break;

    const inserts = payments
      .filter((p: any) => p.bill_transaction_id)
      .map((p: any) => ({
        bill_transaction_id: p.bill_transaction_id,
        source_transaction_id: p.id,
        source_type: 'payment',
        applied_amount: Math.abs(Number(p.total_amount ?? 0)),
        applied_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        org_id: orgId,
      }));

    for (const row of inserts) {
      if (row.applied_amount <= 0) {
        metrics.applicationsSkipped += 1;
        continue;
      }
      if (DRY_RUN) {
        metrics.applicationsCreated += 1;
        continue;
      }
      const { error: insertErr } = await supabase
        .from('bill_applications')
        .upsert(row, { onConflict: 'bill_transaction_id,source_transaction_id' });
      if (insertErr) {
        // Unique violations are safe to skip
        if (insertErr.code === '23505') {
          metrics.applicationsSkipped += 1;
          continue;
        }
        throw insertErr;
      }
      metrics.applicationsCreated += 1;
    }

    offset += BATCH_SIZE;
  }
}

async function backfillApAccount(orgId: string) {
  const { data: org } = await supabase
    .from('organizations')
    .select('ap_gl_account_id')
    .eq('id', orgId)
    .maybeSingle();
  if (org?.ap_gl_account_id) return;

  const { data: resolved, error } = await supabase.rpc('resolve_ap_gl_account_id', {
    p_org_id: orgId,
  });
  if (error) throw error;
  const apId = resolved as string | null;
  if (!apId) {
    metrics.apAccountMissing += 1;
    console.warn(`[${orgId}] AP account not resolved`);
    return;
  }
  if (!DRY_RUN) {
    const { error: updateErr } = await supabase
      .from('organizations')
      .update({ ap_gl_account_id: apId, updated_at: new Date().toISOString() })
      .eq('id', orgId);
    if (updateErr) throw updateErr;
  }
  metrics.apAccountResolved += 1;
}

async function validateTotals() {
  const { count: billCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('transaction_type', 'Bill');
  const { count: workflowCount } = await supabase
    .from('bill_workflow')
    .select('bill_transaction_id', { count: 'exact', head: true });
  const { count: linkCount } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('transaction_type', 'Payment')
    .not('bill_transaction_id', 'is', null);
  const { count: appCount } = await supabase
    .from('bill_applications')
    .select('id', { count: 'exact', head: true })
    .eq('source_type', 'payment');

  metrics.validation.billsMissingWorkflow = Math.max(
    (billCount ?? 0) - (workflowCount ?? 0),
    0,
  );
  metrics.validation.billLinksMissingApplication = Math.max(
    (linkCount ?? 0) - (appCount ?? 0),
    0,
  );
}

async function main() {
  try {
    const orgIds = await listOrgIds();
    console.log(`Found ${orgIds.length} orgs. DRY_RUN=${DRY_RUN}`);

    for (const orgId of orgIds) {
      try {
        await backfillWorkflowForOrg(orgId);
        await backfillApplicationsForOrg(orgId);
        await backfillApAccount(orgId);
        metrics.orgsProcessed += 1;
      } catch (err: any) {
        metrics.failures.push({ orgId, error: err?.message || String(err) });
        console.error(`[${orgId}] Error`, err);
        continue;
      }
    }

    await validateTotals();

    const reportPath = `backfill-report-${Date.now()}.json`;
    writeFileSync(reportPath, JSON.stringify({ metrics, DRY_RUN }, null, 2));
    console.log(`Report written to ${reportPath}`);

    if (metrics.failures.length) {
      console.error('Completed with failures');
      process.exit(1);
    }
    console.log('Backfill completed', metrics);
  } catch (error) {
    console.error('Fatal error', error);
    process.exit(1);
  }
}

main();
