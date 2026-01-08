import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import ClearingPanel from '@/components/reconciliations/ClearingPanel';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';

type ReconciliationRow = {
  id: string;
  statement_ending_date: string | null;
  is_finished: boolean;
  last_synced_at?: string | null;
  last_sync_error?: string | null;
  unmatched_buildium_transaction_ids?: number[] | null;
};

type AuditRow = {
  id: string;
  action: string;
  created_at: string;
  transaction_id: string | null;
  bank_gl_account_id: string | null;
};

export default async function BankReconciliationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const authed = await getSupabaseServerClient();

  const { data: reconciliation } = await authed
    .from('reconciliation_log')
    .select('id, statement_ending_date, is_finished, last_synced_at, last_sync_error')
    .select(
      'id, statement_ending_date, is_finished, last_synced_at, last_sync_error, unmatched_buildium_transaction_ids',
    )
    .eq('bank_gl_account_id', id)
    .order('statement_ending_date', { ascending: false })
    .limit(1)
    .maybeSingle<ReconciliationRow>();

  if (!reconciliation) {
    redirect(`/bank-accounts/${id}`);
  }

  const { data: audits } = await authed
    .from('banking_audit_log')
    .select('id, action, created_at, transaction_id, bank_gl_account_id')
    .eq('reconciliation_id', reconciliation.id)
    .order('created_at', { ascending: false })
    .limit(20)
    .returns<AuditRow[]>();

  const statusBadge = reconciliation.is_finished ? (
    <Badge variant="secondary">Locked</Badge>
  ) : (
    <Badge variant="outline">Open</Badge>
  );

  const syncStaleness =
    reconciliation.last_sync_error ||
    (reconciliation.unmatched_buildium_transaction_ids?.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <Card className="border-border/70 border shadow-sm">
        <CardHeader className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Reconciliation</CardTitle>
            <div className="text-sm text-muted-foreground">
              As of {reconciliation.statement_ending_date ?? 'N/A'} · {statusBadge}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>
              Last synced:{' '}
              {reconciliation.last_synced_at
                ? new Date(reconciliation.last_synced_at).toLocaleString()
                : 'Never'}
            </div>
            {syncStaleness ? (
              <div className="text-amber-700">
                {reconciliation.last_sync_error ||
                  `${reconciliation.unmatched_buildium_transaction_ids?.length ?? 0} unmatched Buildium transactions`}
              </div>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <ClearingPanel reconciliationId={reconciliation.id} isFinished={reconciliation.is_finished} />
        </CardContent>
      </Card>

      <Card className="border-border/70 border shadow-sm">
        <CardHeader>
          <CardTitle>Recent banking audit</CardTitle>
        </CardHeader>
        <CardContent>
          {audits && audits.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {audits.map((row) => (
                <li
                  key={row.id}
                  className="border-border/70 flex items-center justify-between rounded border px-3 py-2"
                >
                  <span className="font-medium">{row.action}</span>
                  <span className="text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-muted-foreground text-sm">No recent audit entries.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
