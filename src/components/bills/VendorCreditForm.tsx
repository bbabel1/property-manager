'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { hasPermission, type Permission } from '@/lib/permissions';
import type { AppRole } from '@/lib/auth/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Body, Heading, Label } from '@/ui/typography';

type Allocation = { bill_id: string; amount: string };
type Option = { id: string; label: string; meta?: string | null };

type Props = {
  vendorId: string;
  vendorOptions: Option[];
  creditAccounts: Option[];
  billOptions: Option[];
  defaultBillId?: string | null;
};

function labelForOption(opt: Option) {
  return opt.meta ? `${opt.label} • ${opt.meta}` : opt.label;
}

function canDo(roles: AppRole[] | null | undefined, perm: Permission) {
  if (!roles?.length) return true;
  return hasPermission(roles, perm);
}

export function VendorCreditForm({
  vendorId,
  vendorOptions,
  creditAccounts,
  billOptions,
  defaultBillId,
}: Props) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [creditDate, setCreditDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState('');
  const [glAccountId, setGlAccountId] = useState<string>(() => creditAccounts?.[0]?.id || '');
  const [propertyId, setPropertyId] = useState('');
  const [memo, setMemo] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string>(vendorId);
  const [allocations, setAllocations] = useState<Allocation[]>(
    defaultBillId ? [{ bill_id: defaultBillId, amount: '' }] : [],
  );
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
    if (!selectedVendor && vendorOptions?.length) {
      setSelectedVendor(vendorOptions[0].id);
    }
  }, [selectedVendor, vendorOptions]);

  useEffect(() => {
    if (creditAccounts?.length && !glAccountId) {
      setGlAccountId(creditAccounts[0].id);
    }
  }, [creditAccounts, glAccountId]);

  const canSubmit = useMemo(() => canDo(roles, 'bills.write'), [roles]);

  const addAllocationRow = () =>
    setAllocations((prev) => [...prev, { bill_id: billOptions?.[0]?.id ?? '', amount: '' }]);

  const updateAlloc = (idx: number, field: keyof Allocation, value: string) => {
    setAllocations((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const handleSubmit = () => {
    setFormError(null);
    setFormSuccess(null);
    startTransition(async () => {
      const parsed = allocations
        .map((row) => ({ bill_id: row.bill_id.trim(), amount: Number(row.amount || 0) }))
        .filter((row) => row.bill_id && row.amount > 0);

      if (!selectedVendor || !creditDate || !amount || !glAccountId) {
        setFormError('Provide vendor, date, amount, and GL account.');
        return;
      }
      if (!canSubmit) {
        setFormError('You do not have permission to record vendor credits.');
        return;
      }

      const body: any = {
        vendor_id: selectedVendor,
        credit_date: creditDate,
        amount: Number(amount),
        gl_account_id: glAccountId.trim(),
        memo: memo || null,
        property_id: propertyId || null,
      };
      if (parsed.length) {
        body.bill_allocations = parsed;
      }

      try {
        const res = await fetch('/api/vendor-credits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          const message = payload?.error || 'Failed to record vendor credit';
          setFormError(message);
          toast.error(message);
          return;
        }
        setFormSuccess('Vendor credit recorded');
        toast.success('Vendor credit recorded');
        window.location.reload();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to record credit';
        setFormError(message);
        toast.error(message);
      }
    });
  };

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle headingAs="h3" headingSize="h6">
          Vendor credit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Vendor</Label>
            <Select value={selectedVendor} onValueChange={setSelectedVendor}>
              <SelectTrigger>
                <SelectValue placeholder="Select vendor" />
              </SelectTrigger>
              <SelectContent>
                {vendorOptions.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {labelForOption(v)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Credit date</Label>
            <Input type="date" value={creditDate} onChange={(e) => setCreditDate(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Total amount</Label>
            <Input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1">
            <Label>Credit GL account</Label>
            <Select value={glAccountId} onValueChange={setGlAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select GL account" />
              </SelectTrigger>
              <SelectContent>
                {creditAccounts.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {labelForOption(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Property (optional)</Label>
            <Input
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              placeholder="Property id"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Memo</Label>
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Memo" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label as="span">Apply to bills</Label>
            <Button size="sm" variant="ghost" onClick={addAllocationRow}>
              Add bill
            </Button>
          </div>
          <div className="space-y-2">
            {allocations.length === 0 ? (
              <div className="rounded-md border bg-muted/40 px-3 py-2">
                <Body size="sm" tone="muted">
                  No allocations. Add a bill to apply this credit.
                </Body>
              </div>
            ) : (
              allocations.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Select
                    value={row.bill_id}
                    onValueChange={(val) => updateAlloc(idx, 'bill_id', val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select bill" />
                    </SelectTrigger>
                    <SelectContent>
                      {billOptions.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {labelForOption(b)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Amount"
                    value={row.amount}
                    onChange={(e) => updateAlloc(idx, 'amount', e.target.value)}
                  />
                  <Body as="div" size="sm" tone="muted" className="flex items-center">
                    Apply credit
                  </Body>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-x-2">
            {!canSubmit ? <Badge variant="outline">No permission</Badge> : null}
            {formError ? <Badge variant="destructive">{formError}</Badge> : null}
            {formSuccess ? <Badge variant="secondary">{formSuccess}</Badge> : null}
          </div>
          <Button onClick={handleSubmit} disabled={isSubmitting || !canSubmit}>
            {isSubmitting ? 'Saving…' : 'Save credit'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
