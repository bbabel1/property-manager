'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { Paperclip, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import GlAccountSelectItems from '@/components/gl-accounts/GlAccountSelectItems';
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
import type {
  BankAccountOption,
  GlAccountOption,
  PropertyOption,
  UndepositedPaymentRow,
  UnitOption,
} from '@/types/record-deposit';

type OtherDepositItem = {
  id: string;
  propertyId: string;
  unitId: string;
  glAccountId: string;
  description: string;
  amount: string;
};

type AttachmentDraft = TransactionAttachmentDraft & { id: string };

const makeId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const parseCurrencyInput = (value: string | null | undefined) => {
  if (typeof value !== 'string') return 0;
  const sanitized = value.replace(/[^\d.-]/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(value) ? value : 0,
  );

const AttachmentLimitBytes = 1000 * 1024; // 1000kb

const OtherItemSchema = z.object({
  id: z.string(),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  glAccountId: z.string().min(1, 'Select an account'),
  description: z.string().max(2000).optional(),
  amount: z.string(),
});

const PayloadSchema = z.object({
  bankAccountId: z.string().min(1, 'Bank account is required'),
  date: z.string().min(1, 'Date is required'),
  memo: z.string().max(2000).optional(),
  printDepositSlips: z.boolean().optional(),
  paymentTransactionIds: z.array(z.string()).optional(),
  otherItems: z
    .array(
      OtherItemSchema.refine(
        (item) => parseCurrencyInput(item.amount) >= 0,
        'Enter a valid amount for each other item',
      ),
    )
    .optional(),
});

function createEmptyOtherItem(): OtherDepositItem {
  return { id: makeId(), propertyId: '', unitId: '', glAccountId: '', description: '', amount: '' };
}

export default function RecordDepositForm(props: {
  bankAccountId: string;
  bankAccounts: BankAccountOption[];
  defaultBankAccountId: string;
  undepositedPaymentsTitle: string;
  undepositedPayments: UndepositedPaymentRow[];
  properties: PropertyOption[];
  units: UnitOption[];
  glAccounts: GlAccountOption[];
  afterSaveHref?: string;
  onSaved?: (result: { intent: 'save' | 'save-and-new'; transactionId: string | null }) => void;
  onCancel?: () => void;
}) {
  const {
    bankAccountId: initialBankAccountId,
    bankAccounts,
    defaultBankAccountId,
    undepositedPaymentsTitle,
    undepositedPayments,
    properties,
    units,
    glAccounts,
    afterSaveHref,
    onSaved,
    onCancel,
  } = props;
  const router = useRouter();
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [bankAccountId, setBankAccountId] = useState<string>(defaultBankAccountId);
  const [date, setDate] = useState<string>(todayIso);
  const [memo, setMemo] = useState<string>('');
  const [printDepositSlips, setPrintDepositSlips] = useState<boolean>(false);

  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(() => new Set());
  const [otherItems, setOtherItems] = useState<OtherDepositItem[]>([]);

  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [submitIntent, setSubmitIntent] = useState<'save' | 'save-and-new'>('save');
  const [formError, setFormError] = useState<string | null>(null);

  const selectedBank = useMemo(
    () => bankAccounts.find((a) => a.id === bankAccountId) ?? null,
    [bankAccountId, bankAccounts],
  );

  const unitsByProperty = useMemo(() => {
    const map = new Map<string | null, UnitOption[]>();
    for (const unit of units) {
      const list = map.get(unit.propertyId ?? null) ?? [];
      list.push(unit);
      map.set(unit.propertyId ?? null, list);
    }
    return map;
  }, [units]);

  const selectedPaymentsTotal = useMemo(() => {
    const selected = selectedPaymentIds;
    return undepositedPayments.reduce((sum, row) => sum + (selected.has(row.id) ? row.amount : 0), 0);
  }, [undepositedPayments, selectedPaymentIds]);

  const otherItemsTotal = useMemo(() => {
    return otherItems.reduce((sum, item) => sum + parseCurrencyInput(item.amount), 0);
  }, [otherItems]);

  const totalDepositAmount = selectedPaymentsTotal + otherItemsTotal;

  const allSelectableIds = useMemo(() => undepositedPayments.map((p) => p.id), [undepositedPayments]);

  const allSelected = allSelectableIds.length > 0 && selectedPaymentIds.size === allSelectableIds.length;
  const someSelected = selectedPaymentIds.size > 0 && !allSelected;

  const toggleSelectAll = useCallback(() => {
    setSelectedPaymentIds((previous) => {
      if (allSelectableIds.length === 0) return previous;
      if (previous.size === allSelectableIds.length) return new Set();
      return new Set(allSelectableIds);
    });
  }, [allSelectableIds]);

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedPaymentIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addOtherItem = useCallback(() => {
    setOtherItems((prev) => [...prev, createEmptyOtherItem()]);
  }, []);

  const removeOtherItem = useCallback((id: string) => {
    setOtherItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const setOtherItemValue = useCallback(
    <K extends keyof OtherDepositItem>(id: string, key: K, value: OtherDepositItem[K]) => {
      setOtherItems((prev) => prev.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
    },
    [],
  );

  const handleAddAttachment = useCallback(
    (draft: TransactionAttachmentDraft) => {
      if (attachments.length >= 1) {
        setAttachmentError('Only one attachment allowed.');
        return;
      }
      if (draft.file.size > AttachmentLimitBytes) {
        setAttachmentError('Attachment must be 1000kb or smaller.');
        return;
      }
      setAttachmentError(null);
      setAttachments([{ ...draft, id: makeId() }]);
    },
    [attachments.length],
  );

  const uploadAttachments = useCallback(
    async (transactionId: string | null) => {
      if (attachments.length === 0) return true;
      if (!transactionId) {
        const message = 'Deposit saved but no transaction id was returned to attach the file.';
        setFormError(message);
        toast.error(message);
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
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to upload attachment';
        setFormError(`Deposit saved but attachment failed: ${message}`);
        toast.error(`Attachment failed: ${message}`);
        return false;
      }
    },
    [attachments],
  );

  const resetForNew = useCallback(() => {
    setDate(todayIso);
    setMemo('');
    setPrintDepositSlips(false);
    setSelectedPaymentIds(new Set());
    setOtherItems([]);
    setAttachments([]);
    setAttachmentError(null);
    setFormError(null);
    setSubmitIntent('save');
  }, [todayIso]);

  const submit = useCallback(
    async (intent: 'save' | 'save-and-new') => {
      setSubmitIntent(intent);
      setIsSaving(true);
      setFormError(null);

      try {
        const payload = {
          bankAccountId,
          date,
          memo: memo ? memo : undefined,
          printDepositSlips: printDepositSlips ? true : undefined,
          paymentTransactionIds: Array.from(selectedPaymentIds),
          otherItems: otherItems.length ? otherItems : undefined,
        };
        const parsed = PayloadSchema.safeParse(payload);
        if (!parsed.success) {
          const first = parsed.error.issues?.[0];
          setFormError(first?.message ?? 'Fix the highlighted fields and try again.');
          return;
        }
        if (totalDepositAmount <= 0) {
          setFormError('Select at least one payment or add an other deposit item.');
          return;
        }

        const res = await fetch(`/api/bank-accounts/${bankAccountId}/record-deposit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message =
            (body && typeof body.error === 'string' && body.error) ||
            (body?.error?.message as string | undefined) ||
            (body?.details as string | undefined) ||
            'Failed to record deposit.';
          throw new Error(message);
        }

        const transactionId =
          (body?.data && typeof body.data.transactionId === 'string' && body.data.transactionId) ||
          null;

        const uploaded = await uploadAttachments(transactionId);
        if (!uploaded) {
          setIsSaving(false);
          return;
        }

        toast.success('Deposit recorded');

        const meta = { intent, transactionId };
        onSaved?.(meta);

        if (intent === 'save-and-new') {
          resetForNew();
          return;
        }

        if (onSaved) {
          return;
        }

        const destination = afterSaveHref || `/bank-accounts/${initialBankAccountId}`;
        router.push(destination);
        router.refresh();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Failed to record deposit.');
      } finally {
        setIsSaving(false);
      }
    },
    [
      bankAccountId,
      date,
      memo,
      otherItems,
      printDepositSlips,
      initialBankAccountId,
      afterSaveHref,
      onSaved,
      resetForNew,
      router,
      selectedPaymentIds,
      totalDepositAmount,
      uploadAttachments,
    ],
  );

  const handleCancel = useCallback(() => {
    if (onCancel) {
      onCancel();
      return;
    }
    router.push(`/bank-accounts/${initialBankAccountId}`);
  }, [initialBankAccountId, onCancel, router]);

  return (
    <div className="w-full space-y-8 pb-10">
      {formError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{formError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <div className="flex items-end justify-between gap-3">
            <Label htmlFor="record-deposit-bank-account" className="text-xs font-semibold tracking-wide">
              BANK ACCOUNT <span className="text-destructive">*</span>
            </Label>
            <span className="text-xs text-muted-foreground">
              Balance:{' '}
              <span className="text-foreground">{formatCurrency(Number(selectedBank?.balance ?? 0))}</span>
            </span>
          </div>
          <Select value={bankAccountId} onValueChange={(value) => setBankAccountId(value)}>
            <SelectTrigger id="record-deposit-bank-account">
              <SelectValue placeholder="Select bank account" />
            </SelectTrigger>
            <SelectContent>
              {bankAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="record-deposit-date" className="text-xs font-semibold tracking-wide">
            DATE <span className="text-destructive">*</span>
          </Label>
          <DatePicker id="record-deposit-date" value={date} onChange={(value) => setDate(value ?? '')} />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="record-deposit-memo" className="text-xs font-semibold tracking-wide">
            MEMO
          </Label>
          <Textarea
            id="record-deposit-memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="min-h-20"
            maxLength={2000}
          />
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Total deposit amount
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {formatCurrency(totalDepositAmount)}
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm">
            <Checkbox
              checked={printDepositSlips}
              onCheckedChange={(checked) => setPrintDepositSlips(Boolean(checked))}
            />
            Print deposit slips
          </label>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div className="text-sm font-semibold">Other deposit items</div>
        <Button type="button" variant="ghost" className="w-fit px-2" onClick={addOtherItem}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add another
        </Button>

        {otherItems.length > 0 && (
          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Property
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Unit
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Account
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Memo
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Amount
                  </TableHead>
                  <TableHead className="w-[3rem]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {otherItems.map((item) => {
                  const unitOptions = unitsByProperty.get(item.propertyId || null) ?? [];
                  return (
                    <TableRow key={item.id} className="border-b last:border-0">
                      <TableCell className="align-top">
                        <Select
                          value={item.propertyId}
                          onValueChange={(value) => {
                            setOtherItemValue(item.id, 'propertyId', value);
                            setOtherItemValue(item.id, 'unitId', '');
                          }}
                        >
                          <SelectTrigger className="min-w-[16rem]">
                            <SelectValue placeholder="Select a property..." />
                          </SelectTrigger>
                          <SelectContent>
                            {properties.map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top">
                        <Select
                          value={item.unitId}
                          onValueChange={(value) => setOtherItemValue(item.id, 'unitId', value)}
                        >
                          <SelectTrigger className="min-w-[12rem]">
                            <SelectValue placeholder="Select a unit" />
                          </SelectTrigger>
                          <SelectContent>
                            {unitOptions.map((u) => (
                              <SelectItem key={u.id} value={u.id}>
                                {u.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top">
                        <Select
                          value={item.glAccountId}
                          onValueChange={(value) => setOtherItemValue(item.id, 'glAccountId', value)}
                        >
                          <SelectTrigger className="min-w-[18rem]">
                            <SelectValue placeholder="Type or select an account..." />
                          </SelectTrigger>
                          <SelectContent>
                            <GlAccountSelectItems accounts={glAccounts} />
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          value={item.description}
                          onChange={(e) => setOtherItemValue(item.id, 'description', e.target.value)}
                          placeholder="Memo"
                          aria-label="Other item memo"
                          className="min-w-[16rem]"
                        />
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <Input
                          value={item.amount}
                          onChange={(e) => setOtherItemValue(item.id, 'amount', e.target.value)}
                          inputMode="decimal"
                          placeholder="$0.00"
                          className="min-w-[9rem] text-right"
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOtherItem(item.id)}
                          className="h-9 w-9"
                          aria-label="Remove row"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="text-sm font-semibold">{undepositedPaymentsTitle}</div>
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[2.5rem]">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={() => toggleSelectAll()}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Date
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Property · Unit
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Memo
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Check No.
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Amount
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {undepositedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    There are no undeposited payments for this bank account.
                    <div className="mt-2 text-xs text-muted-foreground">
                      If you are trying to deposit a payment from a resident or owner, make sure to first
                      receive the payment on the appropriate ledger.
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                undepositedPayments.map((row) => (
                  <TableRow key={row.id} className="border-b last:border-0">
                    <TableCell>
                      <Checkbox
                        checked={selectedPaymentIds.has(row.id)}
                        onCheckedChange={() => toggleSelectOne(row.id)}
                        aria-label={`Select ${row.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{row.date}</TableCell>
                    <TableCell className="text-sm">
                      {row.propertyLabel} · {row.unitLabel}
                    </TableCell>
                    <TableCell className="text-sm">{row.nameLabel}</TableCell>
                    <TableCell className="text-sm">{row.memoLabel}</TableCell>
                    <TableCell className="text-sm">{row.checkNumberLabel}</TableCell>
                    <TableCell className="text-right text-sm">{formatCurrency(row.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Attachments</div>
            <div className="text-xs text-muted-foreground">1 file up to 1000kb</div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setIsUploadDialogOpen(true)}>
            Add files
          </Button>
        </div>
        {attachmentError && <p className="text-xs text-destructive">{attachmentError}</p>}
        {attachments.length === 0 ? (
          <div className="text-muted-foreground rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-sm">
            No attachments yet. Use “Add files” to upload.
          </div>
        ) : (
          <div className="space-y-2">
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
                <Button type="button" variant="ghost" size="sm" onClick={() => setAttachments([])}>
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
        maxBytes={AttachmentLimitBytes}
      />

      <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{formatCurrency(totalDepositAmount)}</span>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={() => submit('save-and-new')} disabled={isSaving}>
            Save &amp; add another
          </Button>
          <Button type="button" onClick={() => submit('save')} disabled={isSaving}>
            {isSaving && submitIntent === 'save' ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
