'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
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
import TransactionFileUploadDialog, {
  type TransactionAttachmentDraft,
} from '@/components/files/TransactionFileUploadDialog';
import { Paperclip } from 'lucide-react';

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

type EditDepositFormProps = {
  deposit: DepositData;
  bankAccounts: BankAccountOption[];
  patchUrl: string;
  deleteUrl: string;
  returnHref: string;
};

type AttachmentDraft = TransactionAttachmentDraft & { id: string };
type ExistingAttachment = {
  linkId: string;
  fileId: string;
  title: string;
  uploadedAt: string | null;
  uploadedBy: string | null;
  category: string;
  sizeBytes?: number | null;
  buildiumFileId?: number | null;
};

const mapExistingAttachments = (payload: unknown): ExistingAttachment[] => {
  if (!payload || typeof payload !== 'object') return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];
  const result: ExistingAttachment[] = [];
  for (const row of data) {
    if (!row || typeof row !== 'object') continue;
    const entry = row as Record<string, unknown>;
    const fileIdRaw = entry.id ?? entry.fileId ?? entry.linkId;
    if (typeof fileIdRaw !== 'string' && typeof fileIdRaw !== 'number') continue;
    const titleRaw = entry.title ?? entry.fileName;
    result.push({
      linkId: String(entry.linkId ?? entry.id ?? ''),
      fileId: String(fileIdRaw),
      title: typeof titleRaw === 'string' ? titleRaw : 'File',
      uploadedAt: typeof entry.uploadedAt === 'string' ? entry.uploadedAt : null,
      uploadedBy: typeof entry.uploadedBy === 'string' ? entry.uploadedBy : null,
      category: typeof entry.category === 'string' ? entry.category : 'Uncategorized',
      sizeBytes: typeof entry.sizeBytes === 'number' ? entry.sizeBytes : null,
      buildiumFileId: typeof entry.buildiumFileId === 'number' ? entry.buildiumFileId : null,
    });
  }
  return result;
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

const makeId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

export default function EditDepositForm(props: EditDepositFormProps): JSX.Element {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingAttachments, setExistingAttachments] = useState<ExistingAttachment[]>([]);
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const [formData, setFormData] = useState(() => ({
    bankAccountId: props.deposit.bank_gl_account_id || '',
    date: props.deposit.date ? props.deposit.date.slice(0, 10) : '',
    memo: props.deposit.memo || '',
  }));

  const handleAddAttachment = useCallback(
    (draft: TransactionAttachmentDraft) => {
      if (attachments.length >= 5) {
        setAttachmentError('Attachments limited to 5 files for deposits.');
        return;
      }
      setAttachmentError(null);
      setAttachments((prev) => [...prev, { ...draft, id: makeId() }]);
    },
    [attachments.length],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const removeExistingAttachment = useCallback(
    async (fileId: string) => {
      try {
        const res = await fetch(`/api/transactions/${props.deposit.id}/files?fileId=${fileId}`, {
          method: 'DELETE',
        });
        if (!res.ok) return;
        setExistingAttachments((prev) => prev.filter((f) => f.fileId !== fileId));
      } catch {
        // ignore
      }
    },
    [props.deposit.id],
  );

  const loadExistingAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/transactions/${props.deposit.id}/files`, { cache: 'no-store' });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setExistingAttachments(mapExistingAttachments(json));
    } catch {
      // ignore
    }
  }, [props.deposit.id]);

  useEffect(() => {
    void loadExistingAttachments();
  }, [loadExistingAttachments]);

  const uploadAttachments = useCallback(
    async (transactionId: string | null) => {
      if (attachments.length === 0) return true;
      if (!transactionId) {
        setError('Deposit updated but no transaction id returned for attachments.');
        return false;
      }
      try {
        for (const attachment of attachments) {
          const formData = new FormData();
          formData.append('file', attachment.file);
          formData.append('fileName', attachment.file.name);
          formData.append('title', attachment.title);
          formData.append('description', attachment.description);
          formData.append('category', attachment.category);
          formData.append('mimeType', attachment.file.type);
          const res = await fetch(`/api/transactions/${transactionId}/files`, {
            method: 'POST',
            body: formData,
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            const message =
              (json && typeof json.error === 'string' && json.error) ||
              'Failed to upload attachment';
            throw new Error(message);
          }
        }
        setAttachments([]);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to upload attachment';
        setError(`Deposit updated but attachments failed: ${message}`);
        return false;
      }
    },
    [attachments],
  );

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
    async (e: FormEvent<HTMLFormElement>) => {
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

        const uploaded = await uploadAttachments(props.deposit.id);
        if (!uploaded) {
          setIsSaving(false);
          return;
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
      props.deposit.id,
      props.returnHref,
      router,
      uploadAttachments,
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

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Attachments</div>
              <div className="text-xs text-muted-foreground">Add supporting files for this deposit.</div>
              {attachmentError ? <p className="text-xs text-destructive">{attachmentError}</p> : null}
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
              Add files
            </Button>
          </div>
          {existingAttachments.length === 0 && attachments.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-sm">
              No attachments yet. Use “Add files” to upload.
            </div>
          ) : (
            <div className="space-y-2">
              {existingAttachments.map((a) => (
                <div
                  key={a.fileId}
                  className="flex items-center justify-between gap-3 rounded-md border bg-muted/10 px-3 py-2"
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden />
                      <div className="truncate text-sm font-medium">{a.title}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.category || 'Uncategorized'}
                      {a.sizeBytes ? ` · ${Math.round(a.sizeBytes / 1024)} KB` : ''}
                      {a.uploadedAt ? ` · Uploaded ${new Date(a.uploadedAt).toLocaleDateString()}` : ''}
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeExistingAttachment(a.fileId)}>
                    Remove
                  </Button>
                </div>
              ))}
              {attachments.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <div className="truncate text-sm">{a.title || a.file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.category || 'Uncategorized'} · {Math.round(a.file.size / 1024)} KB
                    </div>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment(a.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <TransactionFileUploadDialog
          open={isUploadDialogOpen}
          onOpenChange={setIsUploadDialogOpen}
          onSaved={handleAddAttachment}
          maxBytes={1000 * 1024}
        />

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
