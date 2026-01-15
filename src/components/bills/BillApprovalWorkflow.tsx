'use client';

import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hasPermission } from '@/lib/permissions';
import type { AppRole } from '@/lib/auth/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Body, Heading, Label } from '@/ui/typography';

type AuditEntry = {
  id?: string;
  action?: string | null;
  from_state?: string | null;
  to_state?: string | null;
  user_id?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

type Props = {
  billId: string;
  approvalState: string | null;
  audit?: AuditEntry[];
  disabled?: boolean;
  canVoid?: boolean;
};

function approvalVariant(state: string | null) {
  const s = (state || 'draft').toLowerCase();
  if (s === 'approved') return 'secondary';
  if (s === 'pending_approval') return 'default';
  if (s === 'rejected') return 'destructive';
  if (s === 'voided') return 'outline';
  return 'outline';
}

function formatDate(value?: string | null) {
  if (!value) return '';
  const iso = value.includes('T') ? value : `${value}T00:00:00Z`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString();
}

export function BillApprovalWorkflow({
  billId,
  approvalState,
  audit = [],
  disabled,
  canVoid = false,
}: Props) {
  const [action, setAction] = useState<null | 'submit' | 'approve' | 'reject' | 'void'>(null);
  const [voidReason, setVoidReason] = useState('');
  const [pending, startTransition] = useTransition();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    const supa = getSupabaseBrowserClient();
    supa.auth
      .getUser()
      .then(({ data }) => {
        const roleList =
          ((data.user?.app_metadata as any)?.roles ||
            (data.user?.user_metadata as any)?.roles ||
            []) as AppRole[];
        if (Array.isArray(roleList)) {
          setRoles(roleList.filter((r): r is AppRole => typeof r === 'string'));
        }
      })
      .catch(() => setRoles([]));
  }, []);

  const canSubmit = hasPermission(roles, 'bills.write');
  const canApprove = hasPermission(roles, 'bills.approve');
  const canVoidPermission = hasPermission(roles, 'bills.void');

  const run = (nextAction: typeof action) => {
    if (!nextAction) return;
    if (
      (nextAction === 'submit' && !canSubmit) ||
      ((nextAction === 'approve' || nextAction === 'reject') && !canApprove) ||
      (nextAction === 'void' && !canVoidPermission)
    ) {
      setPermissionError('You do not have permission for this action.');
      return;
    }
    setPermissionError(null);
    setAction(nextAction);
    startTransition(async () => {
      try {
        const path =
          nextAction === 'submit'
            ? `/api/bills/${billId}/submit`
            : nextAction === 'approve'
              ? `/api/bills/${billId}/approve`
              : nextAction === 'reject'
                ? `/api/bills/${billId}/reject`
                : `/api/bills/${billId}/void`;

        const body =
          nextAction === 'void'
            ? { reason: voidReason || 'Voided from bill page' }
            : undefined;

        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          const msg = payload?.error || `Failed to ${nextAction} bill`;
          toast.error(msg);
        } else {
          toast.success(
            nextAction === 'submit'
              ? 'Bill submitted for approval'
              : nextAction === 'approve'
                ? 'Bill approved'
                : nextAction === 'reject'
                  ? 'Bill rejected'
                  : 'Bill voided',
          );
          window.location.reload();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Unexpected error');
      } finally {
        setAction(null);
      }
    });
  };

  const isPendingAction = pending && action !== null;
  const normalized = approvalState ?? 'draft';

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle headingSize="h6">Approval workflow</CardTitle>
        <Badge variant={approvalVariant(normalized)} className="capitalize">
          {normalized.replace(/_/g, ' ')}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || isPendingAction || normalized !== 'draft' || !canSubmit}
            onClick={() => run('submit')}
          >
            Submit
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || isPendingAction || normalized !== 'pending_approval' || !canApprove}
            onClick={() => run('approve')}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={disabled || isPendingAction || normalized !== 'pending_approval' || !canApprove}
            onClick={() => run('reject')}
          >
            Reject
          </Button>
          {canVoid ? (
            <div className="flex items-center gap-2">
              <Textarea
                className="min-w-[12rem]"
                placeholder="Void reason"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                disabled={disabled || isPendingAction}
              />
              <Button
                size="sm"
                variant="destructive"
                disabled={disabled || isPendingAction || !canVoidPermission}
                onClick={() => run('void')}
              >
                Void
              </Button>
            </div>
          ) : null}
        </div>
        {permissionError ? (
          <Body as="div" size="xs" className="text-destructive">
            {permissionError}
          </Body>
        ) : null}

        <div className="space-y-2">
          <Label as="div" size="xs" tone="muted" className="uppercase">
            Approval history
          </Label>
          {audit.length === 0 ? (
            <Body as="p" size="sm" tone="muted">
              No approval history yet.
            </Body>
          ) : (
            <div className="flex flex-col gap-2">
              {audit
                .slice()
                .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
                .map((entry, idx) => (
                  <div key={entry.id ?? idx} className="rounded-md border bg-muted/40 p-2">
                    <div className="flex items-center justify-between">
                      <Label as="span" className="capitalize">
                        {entry.action || 'change'}
                      </Label>
                      <Body as="span" size="xs" tone="muted">
                        {formatDate(entry.created_at) || '—'}
                      </Body>
                    </div>
                    <Body as="div" size="xs" tone="muted">
                      {entry.from_state ? entry.from_state.replace(/_/g, ' ') : '—'} →{' '}
                      {entry.to_state ? entry.to_state.replace(/_/g, ' ') : '—'}
                    </Body>
                    {entry.notes ? <Body as="div" size="sm">{entry.notes}</Body> : null}
                  </div>
                ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
