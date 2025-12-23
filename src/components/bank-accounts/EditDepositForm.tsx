'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type BankAccountOption = {
  id: string;
  name: string;
  account_number?: string | null;
};

type PaymentTransaction = {
  id: string;
  date: string;
  property_name?: string | null;
  unit_number?: string | null;
  unit_name?: string | null;
  memo?: string | null;
  check_number?: string | null;
  amount: number;
};

type DepositData = {
  id: string;
  date: string;
  memo?: string | null;
  total_amount: number;
  bank_gl_account_id?: string | null;
  payment_transactions: PaymentTransaction[];
};

const fmtUsd = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const fmtDate = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

export default function EditDepositForm(props: {
  deposit: DepositData;
  bankAccounts: BankAccountOption[];
  patchUrl: string;
  deleteUrl: string;
  returnHref: string;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState(() => ({
    bankAccountId: props.deposit.bank_gl_account_id || '',
    date: props.deposit.date ? props.deposit.date.slice(0, 10) : '',
    memo: props.deposit.memo || '',
  }));

  const paymentCount = props.deposit.payment_transactions?.length ?? 0;
  const paymentTotal =
    props.deposit.payment_transactions?.reduce((sum, p) => sum + Number(p.amount || 0), 0) ?? 0;
  const totalAmount =
    paymentTotal > 0
      ? paymentTotal
      : Number.isFinite(Number(props.deposit.total_amount))
        ? Number(props.deposit.total_amount)
        : 0;

  const handleCancel = useCallback(() => {
    router.replace(props.returnHref);
  }, [props.returnHref, router]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      setError(null);

      try {
        const response = await fetch(props.patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bank_gl_account_id: formData.bankAccountId || null,
            date: formData.date,
            memo: formData.memo || null,
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const message =
            (payload && typeof payload.error === 'string' && payload.error) ||
            'Failed to update deposit';
          throw new Error(message);
        }

        router.replace(props.returnHref);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update deposit');
      } finally {
        setIsSaving(false);
      }
    },
    [
      formData.bankAccountId,
      formData.date,
      formData.memo,
      props.patchUrl,
      props.returnHref,
      router,
    ],
  );

  const handleDelete = useCallback(async () => {
    if (!confirm('Are you sure you want to delete this deposit?')) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(props.deleteUrl, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          (payload && typeof payload.error === 'string' && payload.error) ||
          'Failed to delete deposit';
        throw new Error(message);
      }
      router.replace(props.returnHref);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete deposit');
    } finally {
      setIsSaving(false);
    }
  }, [props.deleteUrl, props.returnHref, router]);

  const paymentRows = useMemo(
    () => props.deposit.payment_transactions ?? [],
    [props.deposit.payment_transactions],
  );

  return (
    <div className="w-full space-y-8 pb-10">
      {error && (
        <div className="border-destructive/20 bg-destructive/10 rounded-md border p-4">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label
              htmlFor="edit-deposit-bank-account"
              className="text-xs font-semibold tracking-wide"
            >
              BANK ACCOUNT <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.bankAccountId}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, bankAccountId: value }))}
            >
              <SelectTrigger id="edit-deposit-bank-account">
                <SelectValue placeholder="Select bank account" />
              </SelectTrigger>
              <SelectContent>
                {props.bankAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                    {account.account_number ? ` - ${account.account_number}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="edit-deposit-date" className="text-xs font-semibold tracking-wide">
              DATE <span className="text-destructive">*</span>
            </Label>
            <Input
              id="edit-deposit-date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="edit-deposit-memo" className="text-xs font-semibold tracking-wide">
              MEMO
            </Label>
            <Textarea
              id="edit-deposit-memo"
              value={formData.memo}
              onChange={(e) => setFormData((prev) => ({ ...prev, memo: e.target.value }))}
              placeholder="Enter memo"
              className="min-h-20"
              maxLength={245}
            />
            <div className="text-muted-foreground mt-1 text-right text-xs">
              {formData.memo.length}/245
            </div>
          </div>
        </div>

        <Card>
          <CardContent className="py-6">
            <div className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
              Total deposit amount
            </div>
            <div className="text-foreground mt-2 text-2xl font-semibold">{fmtUsd(totalAmount)}</div>
            <div className="text-muted-foreground mt-1 text-sm">
              {paymentCount} deposited payment{paymentCount !== 1 ? 's' : ''}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Other deposit items</div>
          <Button type="button" variant="ghost" size="sm" disabled>
            + Add another
          </Button>
        </div>

        <div className="space-y-3">
          <div className="text-sm font-semibold">Payments</div>
          {paymentRows.length > 0 ? (
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                      Date
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                      Property - Unit
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                      Memo
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                      Check No.
                    </TableHead>
                    <TableHead className="text-muted-foreground text-right text-xs font-semibold tracking-widest uppercase">
                      Amount
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentRows.map((payment) => (
                    <TableRow key={payment.id} className="border-b last:border-0">
                      <TableCell className="text-sm">
                        {payment.date ? fmtDate.format(new Date(payment.date)) : '—'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {payment.unit_name
                          ? payment.unit_name
                          : payment.property_name
                            ? `${payment.property_name}${payment.unit_number ? ` - ${payment.unit_number}` : ''}`
                            : '—'}
                      </TableCell>
                      <TableCell className="text-sm">{payment.memo || '—'}</TableCell>
                      <TableCell className="text-sm">{payment.check_number || '—'}</TableCell>
                      <TableCell className="text-right text-sm">
                        {fmtUsd(Number(payment.amount || 0))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-muted-foreground rounded-md border p-4 text-center text-sm">
              No payments found
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">Attachment</div>
          <div className="text-muted-foreground text-xs">1 file up to 1000kb</div>
          <div className="text-muted-foreground rounded-md border border-dashed p-8 text-center text-sm">
            Drag &amp; drop file here or <span className="text-primary underline">browse</span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="submit" disabled={isSaving}>
              Save
            </Button>
            <Button type="button" variant="outline" onClick={handlePrint} disabled={isSaving}>
              Print
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleDelete}
            disabled={isSaving}
            className="text-destructive"
          >
            Delete
          </Button>
        </div>
      </form>
    </div>
  );
}
