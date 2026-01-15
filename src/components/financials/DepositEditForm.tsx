'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Textarea } from '@/components/ui/textarea';
import { Label as FormLabel } from '@/components/ui/label';
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
import { Loader2, Save, Printer, X, Trash2 } from 'lucide-react';
import DestructiveActionModal from '@/components/common/DestructiveActionModal';
import { Body, Heading, Label } from '@/ui/typography';

type BankAccount = {
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
  bank_account_name?: string | null;
  payment_transactions: PaymentTransaction[];
};

interface DepositEditFormProps {
  deposit: DepositData | null;
  bankAccounts: BankAccount[];
  propertyId: string;
  propertyPublicId: string;
  onClose: () => void;
  onSaved?: () => void;
  patchUrl?: string;
  deleteUrl?: string;
}

export default function DepositEditForm({
  deposit,
  bankAccounts,
  propertyId: _propertyId,
  propertyPublicId,
  onClose,
  onSaved,
  patchUrl,
  deleteUrl,
}: DepositEditFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [formData, setFormData] = useState({
    bankAccountId: deposit?.bank_gl_account_id || '',
    date: deposit?.date ? deposit.date.slice(0, 10) : '',
    memo: deposit?.memo || '',
  });

  useEffect(() => {
    if (deposit) {
      setFormData({
        bankAccountId: deposit.bank_gl_account_id || '',
        date: deposit.date ? deposit.date.slice(0, 10) : '',
        memo: deposit.memo || '',
      });
    }
  }, [deposit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deposit) return;

    setIsSaving(true);
    setError(null);

    try {
      const url =
        typeof patchUrl === 'string' && patchUrl.length > 0
          ? patchUrl
          : `/api/properties/${propertyPublicId}/deposits/${deposit.id}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_gl_account_id: formData.bankAccountId || null,
          date: formData.date,
          memo: formData.memo || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Failed to update deposit' }));
        throw new Error(errorData.error || 'Failed to update deposit');
      }

      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update deposit');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deposit) return;

    setIsSaving(true);
    setError(null);

    try {
      const url =
        typeof deleteUrl === 'string' && deleteUrl.length > 0
          ? deleteUrl
          : `/api/properties/${propertyPublicId}/deposits/${deposit.id}`;
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete deposit');
      }

      onSaved?.();
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete deposit');
    } finally {
      setIsSaving(false);
      setConfirmDeleteOpen(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const paymentCount = deposit?.payment_transactions?.length || 0;
  const paymentTotal =
    deposit?.payment_transactions?.reduce((sum, p) => sum + Number(p.amount || 0), 0) || 0;
  const totalAmount =
    paymentTotal > 0
      ? paymentTotal
      : Number.isFinite(Number(deposit?.total_amount))
        ? Number(deposit?.total_amount)
        : 0;
  const paymentDateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        timeZone: 'UTC', // Keep date-only fields stable regardless of viewer timezone
      }),
    [],
  );

  if (!deposit) return null;

  return (
    <div className="bg-card flex max-h-screen w-full flex-col overflow-hidden rounded-none border-none shadow-2xl sm:max-h-[95vh] sm:w-[min(900px,95vw)] sm:rounded-2xl sm:border">
      <div className="border-b p-6">
        <div className="flex items-center justify-between">
          <Heading as="h1" size="h4">
            Edit deposit
          </Heading>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="border-destructive/20 bg-destructive/10 mx-6 mt-4 rounded-md border p-4">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      <form id="deposit-edit-form" onSubmit={handleSubmit} className="space-y-6 p-6">
        {/* Deposit Details Section */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FormLabel htmlFor="bankAccount" className="text-sm font-[var(--font-weight-medium)]">
                BANK ACCOUNT <span className="text-destructive">*</span>
              </FormLabel>
              <Select
                value={formData.bankAccountId}
                onValueChange={(value) => setFormData({ ...formData, bankAccountId: value })}
                required
              >
                <SelectTrigger id="bankAccount">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                      {account.account_number ? ` - ${account.account_number}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <FormLabel htmlFor="date" className="text-sm font-[var(--font-weight-medium)]">
                DATE <span className="text-destructive">*</span>
              </FormLabel>
              <DatePicker
                id="date"
                value={formData.date}
                onChange={(value) => setFormData({ ...formData, date: value ?? '' })}
                required
              />
            </div>
          </div>

          <div>
            <FormLabel htmlFor="memo" className="text-sm font-[var(--font-weight-medium)]">
              MEMO
            </FormLabel>
            <Textarea
              id="memo"
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              placeholder="Enter memo"
              className="min-h-[100px] resize-none"
              maxLength={245}
            />
            <div className="text-muted-foreground mt-1 text-right text-xs">
              {formData.memo.length}/245
            </div>
          </div>
        </div>

        {/* Total Deposit Amount Section */}
        <div className="bg-muted rounded-md p-4">
          <Label as="div" size="sm" tone="muted">
            TOTAL DEPOSIT AMOUNT
          </Label>
          <Heading as="p" size="h3" className="mt-2">
            $
            {totalAmount.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </Heading>
          <div className="text-muted-foreground mt-1 text-sm">
            {paymentCount} deposited payment{paymentCount !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Other Deposit Items Section */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <Label as="h3" size="sm">
              Other deposit items
            </Label>
            <Button type="button" variant="ghost" size="sm" className="text-sm">
              + Add another
            </Button>
          </div>
        </div>

        {/* Payments Section */}
        <div>
          <Label as="h3" size="sm" className="mb-3">
            Payments
          </Label>
          {deposit?.payment_transactions && deposit.payment_transactions.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>DATE</TableHead>
                    <TableHead>PROPERTY - UNIT</TableHead>
                    <TableHead>MEMO</TableHead>
                    <TableHead>CHECK NO.</TableHead>
                    <TableHead className="text-right">AMOUNT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deposit.payment_transactions.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {payment.date ? paymentDateFmt.format(new Date(payment.date)) : '—'}
                      </TableCell>
                      <TableCell>
                        {payment.unit_name
                          ? payment.unit_name
                          : payment.property_name
                            ? `${payment.property_name}${payment.unit_number ? ` - ${payment.unit_number}` : ''}`
                            : '—'}
                      </TableCell>
                      <TableCell>{payment.memo || '—'}</TableCell>
                      <TableCell>{payment.check_number || '—'}</TableCell>
                      <TableCell className="text-right">
                        $
                        {payment.amount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
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

        {/* Attachment Section */}
        <div>
          <Label as="div" size="sm">
            Attachment (1 file up to 1000kb)
          </Label>
          <div className="border-muted-foreground/25 mt-2 rounded-md border-2 border-dashed p-8 text-center">
            <p className="text-muted-foreground text-sm">
              Drag & drop file here or{' '}
              <button type="button" className="text-primary underline">
                browse
              </button>
            </p>
          </div>
        </div>
      </form>

      {/* Footer */}
      <div className="bg-muted/30 flex items-center justify-between border-t px-6 py-4">
        <div className="flex gap-2">
          <Button
            type="submit"
            form="deposit-edit-form"
            disabled={isSaving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save
              </>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={isSaving}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>
      <DestructiveActionModal
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          if (!isSaving) setConfirmDeleteOpen(open);
        }}
        title="Delete deposit?"
        description="This deposit will be permanently removed."
        confirmLabel={isSaving ? 'Deleting…' : 'Delete'}
        isProcessing={isSaving}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
