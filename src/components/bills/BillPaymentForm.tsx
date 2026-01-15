'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hasPermission, type Permission } from '@/lib/permissions';
import type { AppRole } from '@/lib/auth/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Body, Heading } from '@/ui/typography';

type Allocation = { bill_id: string; amount: string };
type Option = { id: string; label: string; meta?: string | null };

type Props = {
  defaultBillId: string;
  bankAccounts: Option[];
  billOptions: (Option & { remaining?: number | null })[];
};

function labelForOption(opt: Option) {
  return opt.meta ? `${opt.label} • ${opt.meta}` : opt.label;
}

function canDo(roles: AppRole[] | null | undefined, perm: Permission) {
  if (!roles?.length) return true;
  return hasPermission(roles, perm);
}

export function BillPaymentForm({ defaultBillId, bankAccounts, billOptions }: Props) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [bankAccountId, setBankAccountId] = useState<string>(() => bankAccounts?.[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [allocations, setAllocations] = useState<Allocation[]>([
    { bill_id: defaultBillId, amount: '' },
  ]);
  const [isSubmitting, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    if (bankAccounts?.length && !bankAccountId) {
      setBankAccountId(bankAccounts[0].id);
    }
  }, [bankAccounts, bankAccountId]);

  const canSubmit = useMemo(() => canDo(roles, 'bills.write'), [roles]);

  const handleAllocationChange = (index: number, field: keyof Allocation, value: string) => {
    setAllocations((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const addAllocationRow = () =>
    setAllocations((prev) => [...prev, { bill_id: billOptions?.[0]?.id ?? '', amount: '' }]);

  const handleSubmit = () => {
    setFormError(null);
    setFormSuccess(null);
    startTransition(async () => {
      if (!canSubmit) {
        setFormError('You do not have permission to record payments.');
        return;
      }

      const parsed = allocations
        .map((row) => ({ bill_id: row.bill_id.trim(), amount: Number(row.amount || 0) }))
        .filter((row) => row.bill_id && row.amount > 0);

      if (!bankAccountId.trim() || !amount || !paymentDate || !parsed.length) {
        setFormError('Provide bank account, amount, date, and at least one allocation.');
        return;
      }

      const body = {
        bank_account_id: bankAccountId.trim(),
        amount: Number(amount),
        payment_date: paymentDate,
        bill_allocations: parsed,
      };

      try {
        const res = await fetch('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          const message = payload?.error || 'Failed to create payment';
          setFormError(message);
          toast.error(message);
          return;
        }
        setFormSuccess('Payment recorded');
        toast.success('Payment recorded');
        window.location.reload();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to record payment';
        setFormError(message);
        toast.error(message);
      }
    });
  };

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle headingSize="h6">Record payment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label>Bank account (GL)</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {labelForOption(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Payment date</Label>
            <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Payment amount</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Heading as="div" size="h6">
              Bill allocations
            </Heading>
            <Button size="sm" variant="ghost" onClick={addAllocationRow}>
              Add bill
            </Button>
          </div>
          <div className="space-y-2">
            {allocations.map((alloc, idx) => (
              <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Select
                  value={alloc.bill_id}
                  onValueChange={(val) => handleAllocationChange(idx, 'bill_id', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bill" />
                  </SelectTrigger>
                  <SelectContent>
                    {billOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {labelForOption(opt)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={alloc.amount}
                  onChange={(e) => handleAllocationChange(idx, 'amount', e.target.value)}
                />
                <Body as="div" size="sm" tone="muted" className="flex items-center">
                  {billOptions.find((b) => b.id === alloc.bill_id)?.meta || 'Apply amount to bill'}
                </Body>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-x-2">
            {!canSubmit ? <Badge variant="outline">No permission</Badge> : null}
            {formError ? <Badge variant="destructive">{formError}</Badge> : null}
            {formSuccess ? <Badge variant="secondary">{formSuccess}</Badge> : null}
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? 'Saving…' : 'Save payment'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
