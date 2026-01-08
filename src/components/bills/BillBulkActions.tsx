'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type BillRow = { id: string; approval_state: string | null };

type Props = {
  bills: BillRow[];
};

export function BillBulkActions({ bills }: Props) {
  const [isSubmitting, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<'submit' | 'approve' | 'reject' | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const targets = useMemo(() => {
    const submit = bills.filter((b) => !b.approval_state || b.approval_state === 'draft');
    const approve = bills.filter((b) => b.approval_state === 'pending_approval');
    const reject = approve;
    return { submit, approve, reject };
  }, [bills]);

  const runAction = (action: 'submit' | 'approve' | 'reject') => {
    const list = targets[action];
    if (!list.length) {
      toast.info(`No bills are eligible to ${action}.`);
      return;
    }

    setBusyAction(action);
    setLastResult(null);
    startTransition(async () => {
      const endpoint = {
        submit: (id: string) => `/api/bills/${id}/submit`,
        approve: (id: string) => `/api/bills/${id}/approve`,
        reject: (id: string) => `/api/bills/${id}/reject`,
      }[action];

      let successCount = 0;
      for (const bill of list) {
        try {
          const res = await fetch(endpoint(bill.id), { method: 'POST' });
          if (res.ok) successCount += 1;
          else {
            const body = await res.json().catch(() => null);
            const msg = body?.error || `Failed to ${action} bill`;
            toast.error(msg, { description: `Bill ${bill.id}` });
          }
        } catch (error) {
          toast.error(`Failed to ${action} bill`, {
            description: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (successCount) {
        toast.success(`${successCount} bill${successCount === 1 ? '' : 's'} ${action}ed`);
        setLastResult(`${successCount} ${action}ed`);
      } else {
        setLastResult('No changes applied');
      }
      setBusyAction(null);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
      <span className="text-muted-foreground">Bulk actions:</span>
      <Button
        size="sm"
        variant="outline"
        disabled={isSubmitting || !targets.submit.length}
        onClick={() => runAction('submit')}
      >
        Submit ({targets.submit.length})
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isSubmitting || !targets.approve.length}
        onClick={() => runAction('approve')}
      >
        Approve ({targets.approve.length})
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isSubmitting || !targets.reject.length}
        onClick={() => runAction('reject')}
      >
        Reject ({targets.reject.length})
      </Button>
      <Badge variant="outline" className="ml-2">
        {busyAction
          ? busyAction === 'submit'
            ? 'Submitting…'
            : busyAction === 'approve'
              ? 'Approving…'
              : 'Rejecting…'
          : lastResult || `Showing ${bills.length} bills`}
      </Badge>
    </div>
  );
}
