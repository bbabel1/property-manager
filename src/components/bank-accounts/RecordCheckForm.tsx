'use client';

import Link from 'next/link';
import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { z } from 'zod';
import { UploadCloud, Paperclip, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/ui/utils';

export type BankAccountOption = {
  id: string;
  label: string;
  buildiumBankAccountId: number | null;
  balance?: number | null;
};

export type BuildiumPayeeOption = {
  id: string;
  label: string;
  buildiumId: number | null;
};

export type PropertyOption = {
  id: string;
  label: string;
  buildiumPropertyId: number | null;
};

export type UnitOption = {
  id: string;
  label: string;
  propertyId: string | null;
  buildiumUnitId: number | null;
};

export type BuildiumAccountOption = {
  id: string;
  label: string;
  buildiumGlAccountId: number | null;
};

type AttachmentPreview = {
  id: string;
  file: File;
};

type DraftAllocationLine = {
  id: string;
  propertyId: string;
  unitId: string;
  glAccountId: string;
  description: string;
  referenceNumber: string;
  amount: string;
};

const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_SIZE_MB = 20;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;

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

const AllocationLineSchema = z.object({
  id: z.string(),
  propertyId: z.string().min(1, 'Select a property'),
  unitId: z.string().optional(),
  glAccountId: z.string().min(1, 'Select an account'),
  description: z.string().max(2000).optional(),
  referenceNumber: z.string().max(64).optional(),
  amount: z.string(),
});

const FormSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  bankAccountId: z.string().min(1, 'Bank account is required'),
  checkNumber: z.string().max(32).optional(),
  payeeType: z.enum(['Vendor', 'RentalOwner']),
  payeeId: z.string().min(1, 'Payee is required'),
  memo: z.string().max(2000).optional(),
  lines: z
    .array(
      AllocationLineSchema.refine(
        (line) => parseCurrencyInput(line.amount) > 0,
        'Enter a positive amount for each line',
      ),
    )
    .min(1, 'Add at least one allocation'),
});

type FormState = z.infer<typeof FormSchema>;

function buildInitialLine(): DraftAllocationLine {
  return {
    id: makeId(),
    propertyId: '',
    unitId: '',
    glAccountId: '',
    description: '',
    referenceNumber: '',
    amount: '',
  };
}

export default function RecordCheckForm(props: {
  bankAccountId: string;
  bankAccounts: BankAccountOption[];
  vendors: BuildiumPayeeOption[];
  rentalOwners: BuildiumPayeeOption[];
  properties: PropertyOption[];
  units: UnitOption[];
  glAccounts: BuildiumAccountOption[];
  defaultBankAccountId: string;
}) {
  const router = useRouter();
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [isSaving, setIsSaving] = useState(false);
  const [submitIntent, setSubmitIntent] = useState<'save' | 'save-and-new'>('save');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>(() => ({
    date: todayIso,
    bankAccountId: props.defaultBankAccountId,
    checkNumber: '',
    payeeType: 'Vendor',
    payeeId: '',
    memo: '',
    lines: [buildInitialLine()],
  }));

  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedBankAccount = useMemo(
    () => props.bankAccounts.find((a) => a.id === form.bankAccountId) ?? null,
    [props.bankAccounts, form.bankAccountId],
  );
  const selectedPayee = useMemo(() => {
    const list = form.payeeType === 'Vendor' ? props.vendors : props.rentalOwners;
    return list.find((p) => p.id === form.payeeId) ?? null;
  }, [form.payeeId, form.payeeType, props.rentalOwners, props.vendors]);

  const unitsByProperty = useMemo(() => {
    const map = new Map<string | null, UnitOption[]>();
    for (const unit of props.units) {
      const list = map.get(unit.propertyId ?? null) ?? [];
      list.push(unit);
      map.set(unit.propertyId ?? null, list);
    }
    return map;
  }, [props.units]);

  const totalAmount = useMemo(() => {
    return form.lines.reduce((sum, line) => sum + parseCurrencyInput(line.amount), 0);
  }, [form.lines]);

  const setFormValue = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((previous) => ({ ...previous, [key]: value }));
      setFieldErrors((previous) => {
        if (!previous[key as string]) return previous;
        const next = { ...previous };
        delete next[key as string];
        return next;
      });
      setFormError(null);
    },
    [],
  );

  const setLineValue = useCallback(
    <K extends keyof DraftAllocationLine>(lineId: string, key: K, value: DraftAllocationLine[K]) => {
      setForm((previous) => ({
        ...previous,
        lines: previous.lines.map((line) => (line.id === lineId ? { ...line, [key]: value } : line)),
      }));
      setFormError(null);
    },
    [],
  );

  const addLine = useCallback(() => {
    setForm((previous) => ({ ...previous, lines: [...previous.lines, buildInitialLine()] }));
  }, []);

  const removeLine = useCallback((lineId: string) => {
    setForm((previous) => {
      const next = previous.lines.filter((line) => line.id !== lineId);
      return { ...previous, lines: next.length ? next : [buildInitialLine()] };
    });
  }, []);

  const resetFormForNew = useCallback(() => {
    setFieldErrors({});
    setFormError(null);
    setForm((previous) => ({
      ...previous,
      date: todayIso,
      checkNumber: '',
      payeeType: 'Vendor',
      payeeId: '',
      memo: '',
      lines: [buildInitialLine()],
    }));
    setAttachments([]);
    setAttachmentError(null);
    setSubmitIntent('save');
  }, [todayIso]);

  const validateAttachments = useCallback(
    (files: File[]) => {
      if (!files.length) return { ok: true as const, files: [] as File[] };
      const nextCount = attachments.length + files.length;
      if (nextCount > MAX_ATTACHMENT_COUNT) {
        return {
          ok: false as const,
          error: `Attachments limited to ${MAX_ATTACHMENT_COUNT} files.`,
        };
      }
      const tooLarge = files.find((f) => f.size > MAX_ATTACHMENT_SIZE_BYTES);
      if (tooLarge) {
        return {
          ok: false as const,
          error: `${tooLarge.name} exceeds ${MAX_ATTACHMENT_SIZE_MB}MB.`,
        };
      }
      return { ok: true as const, files };
    },
    [attachments.length],
  );

  const appendAttachments = useCallback(
    (files: File[]) => {
      const result = validateAttachments(files);
      if (!result.ok) {
        setAttachmentError(result.error);
        return;
      }
      setAttachmentError(null);
      setAttachments((previous) => [
        ...previous,
        ...result.files.map((file) => ({ id: makeId(), file })),
      ]);
    },
    [validateAttachments],
  );

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragActive(false);
      const files = Array.from(event.dataTransfer.files ?? []).filter(Boolean);
      appendAttachments(files);
    },
    [appendAttachments],
  );

  const onBrowseFiles = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((previous) => previous.filter((a) => a.id !== id));
  }, []);

  const buildBuildiumPayload = useCallback(() => {
    const bankAccount = selectedBankAccount;
    const payee = selectedPayee;
    if (!bankAccount || !Number.isFinite(Number(bankAccount.buildiumBankAccountId))) {
      throw new Error('Selected bank account is missing a Buildium bank account ID.');
    }
    if (!payee || !Number.isFinite(Number(payee.buildiumId))) {
      throw new Error('Selected payee is missing a Buildium ID.');
    }

    const lines = form.lines.map((line) => {
      const property = props.properties.find((p) => p.id === line.propertyId) ?? null;
      const unit = props.units.find((u) => u.id === line.unitId) ?? null;
      const gl = props.glAccounts.find((a) => a.id === line.glAccountId) ?? null;

      const buildiumPropertyId = property?.buildiumPropertyId;
      const buildiumUnitId = unit?.buildiumUnitId ?? null;
      const buildiumGlAccountId = gl?.buildiumGlAccountId;

      if (!Number.isFinite(Number(buildiumPropertyId))) {
        throw new Error('Selected property is missing a Buildium property ID.');
      }
      if (!Number.isFinite(Number(buildiumGlAccountId))) {
        throw new Error('Selected account is missing a Buildium GL account ID.');
      }

      return {
        GLAccountId: Number(buildiumGlAccountId),
        AccountingEntity: {
          Id: Number(buildiumPropertyId),
          AccountingEntityType: 'Rental' as const,
          UnitId: Number.isFinite(Number(buildiumUnitId)) ? Number(buildiumUnitId) : undefined,
        },
        Amount: parseCurrencyInput(line.amount),
        Memo: line.description ? line.description : null,
        ReferenceNumber: line.referenceNumber ? line.referenceNumber : null,
      };
    });

    return {
      bankAccountId: Number(bankAccount.buildiumBankAccountId),
      Payee: {
        Id: Number(payee.buildiumId),
        Type: form.payeeType as 'Vendor' | 'RentalOwner',
      },
      EntryDate: form.date,
      CheckNumber: form.checkNumber ? form.checkNumber : null,
      Memo: form.memo ? form.memo : null,
      Lines: lines,
    };
  }, [
    form.checkNumber,
    form.date,
    form.lines,
    form.memo,
    form.payeeType,
    props.glAccounts,
    props.properties,
    props.units,
    selectedBankAccount,
    selectedPayee,
  ]);

  const submit = useCallback(
    async (intent: 'save' | 'save-and-new') => {
      setSubmitIntent(intent);
      setIsSaving(true);
      setFormError(null);
      setFieldErrors({});

      try {
        const parsed = FormSchema.safeParse(form);
        if (!parsed.success) {
          const nextErrors: Record<string, string> = {};
          const first = parsed.error.issues?.[0];
          parsed.error.issues.forEach((issue) => {
            const key = issue.path?.[0] ? String(issue.path[0]) : 'form';
            if (!nextErrors[key]) nextErrors[key] = issue.message;
          });
          setFieldErrors(nextErrors);
          setFormError(first?.message ?? 'Fix the highlighted fields and try again.');
          return;
        }

        const payload = buildBuildiumPayload();
        const res = await fetch('/api/buildium/bank-accounts/checks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          const message =
            (body && typeof body.error === 'string' && body.error) ||
            (body?.error?.message as string | undefined) ||
            (body?.details as string | undefined) ||
            'Failed to record check.';
          throw new Error(message);
        }

        toast.success('Check recorded');

        if (intent === 'save-and-new') {
          resetFormForNew();
          return;
        }

        router.push(`/bank-accounts/${props.bankAccountId}`);
        router.refresh();
      } catch (error) {
        setFormError(error instanceof Error ? error.message : 'Failed to record check.');
      } finally {
        setIsSaving(false);
      }
    },
    [buildBuildiumPayload, form, props.bankAccountId, resetFormForNew, router],
  );

  const payeeOptions = form.payeeType === 'Vendor' ? props.vendors : props.rentalOwners;

  return (
    <div className="w-full space-y-6 pb-10">
      {formError && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">{formError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="record-check-date" className="text-xs font-semibold tracking-wide">
            DATE <span className="text-destructive">*</span>
          </Label>
          <Input
            id="record-check-date"
            type="date"
            value={form.date}
            onChange={(e) => setFormValue('date', e.target.value)}
            aria-invalid={Boolean(fieldErrors.date)}
          />
          {fieldErrors.date && <p className="mt-1 text-xs text-destructive">{fieldErrors.date}</p>}
        </div>

        <div className="space-y-1">
          <div className="flex items-end justify-between gap-3">
            <Label htmlFor="record-check-bank-account" className="text-xs font-semibold tracking-wide">
              BANK ACCOUNT <span className="text-destructive">*</span>
            </Label>
            <span className="text-xs text-muted-foreground">
              Balance:{' '}
              <span className="text-foreground">
                {formatCurrency(Number(selectedBankAccount?.balance ?? 0))}
              </span>
            </span>
          </div>
          <Select value={form.bankAccountId} onValueChange={(value) => setFormValue('bankAccountId', value)}>
            <SelectTrigger id="record-check-bank-account" aria-invalid={Boolean(fieldErrors.bankAccountId)}>
              <SelectValue placeholder="Select bank account" />
            </SelectTrigger>
            <SelectContent>
              {props.bankAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.bankAccountId && (
            <p className="mt-1 text-xs text-destructive">{fieldErrors.bankAccountId}</p>
          )}
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="record-check-number" className="text-xs font-semibold tracking-wide">
            CHECK NUMBER
          </Label>
          <Input
            id="record-check-number"
            value={form.checkNumber ?? ''}
            onChange={(e) => setFormValue('checkNumber', e.target.value)}
          />
        </div>

        <div className="sm:col-span-2 space-y-2">
          <Label className="text-xs font-semibold tracking-wide">
            PAY TO <span className="text-destructive">*</span>
          </Label>
          <RadioGroup
            value={form.payeeType}
            onValueChange={(value) => {
              const next = value === 'RentalOwner' ? 'RentalOwner' : 'Vendor';
              setForm((previous) => ({ ...previous, payeeType: next, payeeId: '' }));
              setFieldErrors((previous) => {
                const nextErrors = { ...previous };
                delete nextErrors.payeeId;
                return nextErrors;
              });
            }}
            className="grid gap-3"
          >
            <div className="flex items-center gap-3">
              <RadioGroupItem value="Vendor" id="record-check-payee-vendor" />
              <Label htmlFor="record-check-payee-vendor" className="font-normal">
                Vendor
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <RadioGroupItem value="RentalOwner" id="record-check-payee-owner" />
              <Label htmlFor="record-check-payee-owner" className="font-normal">
                Rental owner
              </Label>
            </div>
          </RadioGroup>

          <div className="space-y-1">
            <Select value={form.payeeId} onValueChange={(value) => setFormValue('payeeId', value)}>
              <SelectTrigger aria-invalid={Boolean(fieldErrors.payeeId)}>
                <SelectValue
                  placeholder={
                    form.payeeType === 'Vendor'
                      ? 'Type or select a vendor...'
                      : 'Type or select a rental owner...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {payeeOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.payeeType === 'Vendor' && (
              <div className="text-xs">
                <Link className="text-primary underline" href="/vendors" target="_blank">
                  [Add Vendor]
                </Link>
              </div>
            )}
            {fieldErrors.payeeId && <p className="mt-1 text-xs text-destructive">{fieldErrors.payeeId}</p>}
          </div>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="record-check-memo" className="text-xs font-semibold tracking-wide">
            MEMO
          </Label>
          <Textarea
            id="record-check-memo"
            value={form.memo ?? ''}
            onChange={(e) => setFormValue('memo', e.target.value)}
            className="min-h-20"
            maxLength={2000}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-semibold">Allocations</div>
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
                  Description
                </TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Ref No.
                </TableHead>
                <TableHead className="text-right text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Amount
                </TableHead>
                <TableHead className="w-[3rem]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {form.lines.map((line) => {
                const unitOptions = unitsByProperty.get(line.propertyId || null) ?? [];
                return (
                  <TableRow key={line.id} className="border-b last:border-0">
                    <TableCell className="align-top">
                      <Select
                        value={line.propertyId}
                        onValueChange={(value) => {
                          setLineValue(line.id, 'propertyId', value);
                          setLineValue(line.id, 'unitId', '');
                        }}
                      >
                        <SelectTrigger className="min-w-[16rem]">
                          <SelectValue placeholder="Select a property..." />
                        </SelectTrigger>
                        <SelectContent>
                          {props.properties.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="align-top">
                      <Select value={line.unitId} onValueChange={(value) => setLineValue(line.id, 'unitId', value)}>
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
                        value={line.glAccountId}
                        onValueChange={(value) => setLineValue(line.id, 'glAccountId', value)}
                      >
                        <SelectTrigger className="min-w-[18rem]">
                          <SelectValue placeholder="Type or select an account..." />
                        </SelectTrigger>
                        <SelectContent>
                          {props.glAccounts.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell className="align-top">
                      <Input
                        value={line.description}
                        onChange={(e) => setLineValue(line.id, 'description', e.target.value)}
                        className="min-w-[16rem]"
                      />
                    </TableCell>

                    <TableCell className="align-top">
                      <Input
                        value={line.referenceNumber}
                        onChange={(e) => setLineValue(line.id, 'referenceNumber', e.target.value)}
                        className="min-w-[10rem]"
                      />
                    </TableCell>

                    <TableCell className="align-top text-right">
                      <Input
                        value={line.amount}
                        onChange={(e) => setLineValue(line.id, 'amount', e.target.value)}
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
                        onClick={() => removeLine(line.id)}
                        className="h-9 w-9"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell colSpan={5} className="text-sm font-medium">
                  Total
                </TableCell>
                <TableCell className="text-right text-sm font-semibold">{formatCurrency(totalAmount)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>

        <Button type="button" variant="ghost" className="w-fit px-2" onClick={addLine}>
          <Plus className="mr-2 h-4 w-4" aria-hidden />
          Add row
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <div className="text-sm font-semibold">Attachments</div>
          <div className="text-xs text-muted-foreground">
            Limited to {MAX_ATTACHMENT_COUNT} files. Max file size is {MAX_ATTACHMENT_SIZE_MB}MB.
          </div>
        </div>

        {attachmentError && <p className="text-xs text-destructive">{attachmentError}</p>}

        <label
          htmlFor="record-check-attachments"
          className={cn(
            'border-muted-foreground/30 rounded-md border border-dashed p-6 transition-colors',
            isDragActive && 'border-primary/60 bg-primary/5',
          )}
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragActive(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragActive(false);
          }}
          onDrop={onDrop}
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <UploadCloud className="h-5 w-5 text-muted-foreground" aria-hidden />
            <div className="text-sm text-muted-foreground">
              Drag &amp; drop files here or{' '}
              <span className="text-primary underline">browse</span>
            </div>
          </div>

          <input
            id="record-check-attachments"
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            aria-label="Upload attachments"
            title="Upload attachments"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).filter(Boolean);
              appendAttachments(files);
              e.target.value = '';
            }}
          />
        </label>

        {attachments.length > 0 && (
          <div className="space-y-2">
            {attachments.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Paperclip className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <div className="truncate text-sm">{a.file.name}</div>
                  <div className="text-xs text-muted-foreground">{Math.round(a.file.size / 1024)} KB</div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment(a.id)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Total: <span className="font-semibold text-foreground">{formatCurrency(totalAmount)}</span>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              router.push(`/bank-accounts/${props.bankAccountId}`);
            }}
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


