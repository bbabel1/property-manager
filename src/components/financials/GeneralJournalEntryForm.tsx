'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/components/ui/utils';
import {
  ChevronsUpDown,
  Paperclip,
  Plus,
  UploadCloud,
  Trash2,
  X,
} from 'lucide-react';
import {
  buildJournalEntrySchema,
  journalEntrySchemaBase,
  parseCurrencyInput,
  sanitizeCurrencyInput,
} from '@/lib/journal-entries';

const MAX_ATTACHMENT_BYTES = 1000 * 1024;

export type PropertyOption = { id: string; label: string };
export type UnitOption = { id: string; label: string };
export type AccountOption = {
  value: string;
  label: string;
  group?: string | null;
  groupLabel?: string | null;
};

export type JournalEntryFormValues = z.infer<typeof journalEntrySchemaBase>;

const RequiredMark = () => <span className="text-destructive ml-0.5">*</span>;

export const createEmptyLine = (): JournalEntryFormValues['lines'][number] => ({
  accountId: '',
  description: '',
  debit: '',
  credit: '',
});

type LineFieldErrors = Partial<
  Record<keyof JournalEntryFormValues['lines'][number], { message?: string }>
>;

type SubmissionMode = 'create' | 'edit';
type LayoutVariant = 'modal' | 'page';

type GeneralJournalEntryFormProps = {
  mode: SubmissionMode;
  layout: LayoutVariant;
  propertyOptions: PropertyOption[];
  unitOptions: UnitOption[];
  accountOptions: AccountOption[];
  defaultPropertyId?: string;
  defaultUnitId?: string;
  initialValues?: JournalEntryFormValues;
  transactionId?: string;
  buildiumLocked?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
  submitButtonLabel?: string;
  cancelButtonLabel?: string;
  additionalActions?: ReactNode;
  onClose?: () => void;
};

type AccountPickerProps = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  options: AccountOption[];
  placeholder?: string;
  disabled?: boolean;
};

function AccountPicker({
  id,
  value,
  onChange,
  options,
  placeholder = 'Type or select an account',
  disabled,
}: AccountPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  const groupedOptions = useMemo(() => {
    const groups = new Map<string, { label: string; items: AccountOption[] }>();
    options.forEach((option) => {
      const key = option.group || 'other';
      const label = option.groupLabel || option.group || 'Other accounts';
      if (!groups.has(key)) {
        groups.set(key, { label, items: [] });
      }
      groups.get(key)!.items.push(option);
    });
    return Array.from(groups.values());
  }, [options]);

  return (
    <Popover open={open} onOpenChange={(next) => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Select account"
          disabled={disabled}
          className={cn(
            'w-full min-w-[16rem] max-w-[20rem] justify-between truncate',
            !selected && 'text-muted-foreground',
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        className="overflow-visible border-none bg-transparent p-0 pt-3 shadow-none"
      >
        <Command className="h-full w-[min(20rem,80vw)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl">
          <CommandInput
            placeholder="Search accounts…"
            className="border-b border-border px-3 py-2 text-sm focus-visible:border-ring focus-visible:ring-0"
          />
          <CommandList
            onWheel={(event) => event.stopPropagation()}
            className="max-h-[220px] overflow-y-auto py-1"
          >
            <CommandEmpty>No accounts match your search.</CommandEmpty>
            {groupedOptions.map((group) => (
              <CommandGroup
                key={group.label}
                heading={group.label}
                className="px-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5"
              >
                {group.items.map((item) => (
                  <CommandItem
                    key={item.value}
                    value={`${item.label} ${item.value}`}
                    className="px-3 py-2 text-sm"
                    onSelect={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                  >
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function GeneralJournalEntryForm({
  mode,
  layout,
  propertyOptions,
  unitOptions,
  accountOptions,
  defaultPropertyId,
  defaultUnitId,
  initialValues,
  transactionId,
  buildiumLocked = false,
  onSuccess,
  onCancel,
  submitButtonLabel,
  cancelButtonLabel,
  additionalActions,
  onClose,
}: GeneralJournalEntryFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formLevelError, setFormLevelError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const buildDefaultValues = useCallback((): JournalEntryFormValues => {
    if (initialValues) {
      return initialValues;
    }
    return {
      date: new Date().toISOString().slice(0, 10),
      propertyId: defaultPropertyId || (propertyOptions[0]?.id ?? ''),
      unitId: defaultUnitId || '',
      memo: '',
      lines: [createEmptyLine(), createEmptyLine()],
    };
  }, [defaultPropertyId, defaultUnitId, propertyOptions, initialValues]);

  const requiresUnitSelection = unitOptions.length > 0;
  const resolver = useMemo(
    () => zodResolver(buildJournalEntrySchema(requiresUnitSelection)),
    [requiresUnitSelection],
  );

  const form = useForm<JournalEntryFormValues>({
    resolver,
    mode: 'onChange',
    defaultValues: buildDefaultValues(),
  });

  const { control, formState, handleSubmit, reset, setValue, getValues } = form;
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  useEffect(() => {
    reset(buildDefaultValues());
    setAttachment(null);
    setAttachmentError(null);
    setFormLevelError(null);
  }, [buildDefaultValues, reset]);

  useEffect(() => {
    if (requiresUnitSelection) return;
    if (getValues('unitId')) {
      setValue('unitId', '', { shouldDirty: true, shouldValidate: true });
    }
  }, [requiresUnitSelection, getValues, setValue]);

  const lines = useWatch({ control, name: 'lines' }) ?? [];
  const totals = useMemo(
    () =>
      lines.reduce(
        (running, line) => {
          running.debit += parseCurrencyInput(line.debit);
          running.credit += parseCurrencyInput(line.credit);
          return running;
        },
        { debit: 0, credit: 0 },
      ),
    [lines],
  );

  const linesHaveAmounts = lines.every(
    (line) => parseCurrencyInput(line.debit) > 0 || parseCurrencyInput(line.credit) > 0,
  );
  const totalsMatch = totals.debit > 0 && Math.abs(totals.debit - totals.credit) < 0.005;
  const helperMessage =
    !linesHaveAmounts || !totalsMatch
      ? !linesHaveAmounts
        ? 'Make sure every line includes a debit or credit amount.'
        : 'Debits must equal credits before you can save.'
      : '';

  const canSubmit = !buildiumLocked && formState.isValid && linesHaveAmounts && totalsMatch && !isSaving;

  const handleAttachmentSelection = (incoming: FileList | null) => {
    const file = incoming?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachment(null);
      setAttachmentError('Attachments must be 1,000 kb or smaller.');
      return;
    }
    setAttachment(file);
    setAttachmentError(null);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (buildiumLocked) return;
    handleAttachmentSelection(event.dataTransfer?.files ?? null);
  };

  const handleDropZoneKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    if (buildiumLocked) return;
    attachmentInputRef.current?.click();
  };

  const handleDropZoneClick = (event: MouseEvent<HTMLDivElement>) => {
    if (buildiumLocked) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) {
      return;
    }
    attachmentInputRef.current?.click();
  };

  const updateAmountField = (
    index: number,
    field: 'debit' | 'credit',
    rawValue: string,
    onChange: (value: string) => void,
  ) => {
    const cleaned = sanitizeCurrencyInput(rawValue);
    onChange(cleaned);
    if (!cleaned) {
      return;
    }
    const opposingField = field === 'debit' ? 'credit' : 'debit';
    setValue(`lines.${index}.${opposingField}`, '', { shouldDirty: true, shouldValidate: true });
  };

  const submitForm = async (values: JournalEntryFormValues) => {
    if (!linesHaveAmounts) {
      setFormLevelError('Make sure every line has a debit or credit amount.');
      return;
    }
    if (!totalsMatch) {
      setFormLevelError('Debits have to match credits before saving.');
      return;
    }

    setFormLevelError(null);
    setIsSaving(true);

    const payload = {
      date: values.date,
      propertyId: values.propertyId,
      unitId: values.unitId?.trim() ? values.unitId : null,
      memo: values.memo?.trim() ? values.memo.trim() : null,
      lines: lines.map((line) => {
        const description = line.description?.trim() || null;
        const debitAmount = Math.max(0, parseCurrencyInput(line.debit));
        const creditAmount = Math.max(0, parseCurrencyInput(line.credit));
        return {
          accountId: line.accountId,
          description: description ? description.slice(0, 255) : null,
          debit: Number(debitAmount.toFixed(2)),
          credit: Number(creditAmount.toFixed(2)),
        };
      }),
    };

    const endpoint =
      mode === 'edit' && transactionId
        ? `/api/journal-entries/${transactionId}`
        : '/api/journal-entries';
    const method = mode === 'edit' ? 'PUT' : 'POST';

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const message =
          typeof errorPayload?.error === 'string'
            ? errorPayload.error
            : mode === 'edit'
              ? 'Unable to update journal entry.'
              : 'Unable to save journal entry.';
        setFormLevelError(message);
        toast.error(message);
        return;
      }

      toast.success(mode === 'edit' ? 'Journal entry updated.' : 'Journal entry saved.');
      onSuccess?.();
    } catch (error) {
      console.error(error);
      const message =
        mode === 'edit'
          ? 'Something went wrong while updating. Please try again.'
          : 'Something went wrong while saving. Please try again.';
      setFormLevelError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmit = handleSubmit(submitForm);
  const formErrors = formState.errors;
  const showTotals = lines.length > 0;

  const formContent = (
    <div className="flex-1 space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
        <FormField
          control={control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Date
                <RequiredMark />
              </FormLabel>
              <FormControl>
                <DateInput value={field.value} onChange={field.onChange} disabled={buildiumLocked} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={control}
          name="propertyId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Property or company
                <RequiredMark />
              </FormLabel>
              <FormControl>
                <Select
                  value={field.value || ''}
                  onValueChange={field.onChange}
                  disabled={buildiumLocked || propertyOptions.length === 0}
                >
                  <SelectTrigger aria-label="Select property or company">
                    <SelectValue placeholder="Select a property or company" />
                  </SelectTrigger>
                  <SelectContent>
                    {propertyOptions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No properties available</p>
                    ) : (
                      propertyOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="unitId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Unit
                {requiresUnitSelection ? (
                  <RequiredMark />
                ) : (
                  <span className="text-muted-foreground ml-2 text-xs font-normal">(optional)</span>
                )}
              </FormLabel>
              <FormControl>
                <Select
                  value={field.value || ''}
                  onValueChange={field.onChange}
                  disabled={buildiumLocked || !requiresUnitSelection}
                >
                  <SelectTrigger aria-label="Select unit">
                    <SelectValue
                      placeholder={
                        requiresUnitSelection ? 'Select a unit' : 'No units available for this property'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {unitOptions.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-muted-foreground">No units available</p>
                    ) : (
                      unitOptions.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </FormControl>
              {!requiresUnitSelection ? (
                <p className="text-muted-foreground text-xs">
                  This property does not have units, so this field can be left blank.
                </p>
              ) : null}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={control}
        name="memo"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Memo</FormLabel>
            <FormControl>
              <Input
                placeholder="Add a memo for this entry"
                {...field}
                disabled={buildiumLocked}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <section aria-labelledby="journal-grid-title" className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 id="journal-grid-title" className="text-sm font-semibold text-foreground">
            Debits and credits
          </h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => append(createEmptyLine())}
            disabled={buildiumLocked}
          >
            <Plus className="size-4" />
            Add lines
          </Button>
        </div>
        <div className="rounded-lg border border-border">
          <div className="overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <TableHead className="w-[18rem] min-w-[16rem]">Account</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-32 text-right">Debit</TableHead>
                  <TableHead className="w-32 text-right">Credit</TableHead>
                  <TableHead className="w-16 text-right" aria-label="Actions" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((fieldItem, index) => {
                  const line = lines[index] ?? createEmptyLine();
                  const lineErrors = (formErrors.lines?.[index] || {}) as LineFieldErrors;
                  return (
                    <TableRow key={fieldItem.id} className="align-top">
                      <TableCell className="space-y-1 py-3">
                        <Controller
                          control={control}
                          name={`lines.${index}.accountId`}
                          render={({ field: controllerField }) => (
                            <AccountPicker
                              id={`lines-${index}-account`}
                              value={controllerField.value}
                              onChange={(next) => controllerField.onChange(next)}
                              options={accountOptions}
                              disabled={buildiumLocked}
                            />
                          )}
                        />
                        {lineErrors?.accountId ? (
                          <p className="text-destructive text-xs">{lineErrors.accountId.message}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="space-y-1 py-3">
                        <Input
                          aria-label="Line description"
                          placeholder="Description"
                          value={line.description || ''}
                          onChange={(event) =>
                            setValue(`lines.${index}.description`, event.target.value, {
                              shouldDirty: true,
                              shouldValidate: true,
                            })
                          }
                          disabled={buildiumLocked}
                        />
                        {lineErrors?.description ? (
                          <p className="text-destructive text-xs">{lineErrors.description.message}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="space-y-1 py-3">
                        <Input
                          inputMode="decimal"
                          aria-label="Debit amount"
                          placeholder="$0.00"
                          value={line.debit || ''}
                          className="text-right"
                          onChange={(event) =>
                            updateAmountField(index, 'debit', event.target.value, (value) =>
                              setValue(`lines.${index}.debit`, value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              }),
                            )
                          }
                          disabled={buildiumLocked}
                        />
                        {lineErrors?.debit ? (
                          <p className="text-destructive text-xs">{lineErrors.debit.message}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="space-y-1 py-3">
                        <Input
                          inputMode="decimal"
                          aria-label="Credit amount"
                          placeholder="$0.00"
                          value={line.credit || ''}
                          className="text-right"
                          onChange={(event) =>
                            updateAmountField(index, 'credit', event.target.value, (value) =>
                              setValue(`lines.${index}.credit`, value, {
                                shouldDirty: true,
                                shouldValidate: true,
                              }),
                            )
                          }
                          disabled={buildiumLocked}
                        />
                        {lineErrors?.credit ? (
                          <p className="text-destructive text-xs">{lineErrors.credit.message}</p>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove line"
                          className="text-destructive"
                          onClick={() => remove(index)}
                          disabled={buildiumLocked || fields.length <= 2}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {showTotals ? (
                  <TableRow className="bg-muted/30 font-semibold text-sm">
                    <TableCell colSpan={3} className="text-right uppercase tracking-wide text-muted-foreground">
                      Total
                    </TableCell>
                    <TableCell className="text-right">
                      {totals.debit.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {totals.credit.toLocaleString('en-US', {
                        style: 'currency',
                        currency: 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      <section aria-labelledby="attachment-title" className="space-y-3">
        <div>
          <h3 id="attachment-title" className="text-sm font-semibold text-foreground">
            Attachment <span className="text-muted-foreground text-xs font-normal">(1 file up to 1000 kb)</span>
          </h3>
        </div>
        <div
          role="button"
          tabIndex={buildiumLocked ? -1 : 0}
          onClick={handleDropZoneClick}
          onKeyDown={handleDropZoneKeyDown}
          onDrop={handleDrop}
          onDragOver={(event) => {
            if (buildiumLocked) return;
            event.preventDefault();
          }}
          className={cn(
            'rounded-lg border-2 border-dashed border-border/70 px-4 py-6 text-center transition',
            buildiumLocked
              ? 'pointer-events-none bg-muted/40 opacity-80'
              : 'bg-muted/20 hover:border-primary/60 hover:bg-muted/30',
          )}
        >
          <UploadCloud className="mx-auto mb-3 size-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            Drag & drop a supporting document, or{' '}
            <span className="text-primary underline">browse your computer</span>
          </p>
          <p className="text-muted-foreground text-xs">PDF or image formats work best.</p>
          <input
            ref={attachmentInputRef}
            type="file"
            className="hidden"
            onChange={(event) => handleAttachmentSelection(event.target.files)}
            disabled={buildiumLocked}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <Paperclip className="size-4" />
            <div>
              <p className="font-medium text-foreground">
                {attachment ? attachment.name : 'No attachment added'}
              </p>
              <p className="text-xs">
                {attachment
                  ? `${(attachment.size / 1024).toFixed(1)} kb`
                  : 'Attachments will appear here after upload.'}
              </p>
              {attachmentError ? (
                <p className="text-destructive text-xs">{attachmentError}</p>
              ) : null}
            </div>
          </div>
          {attachment ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAttachment(null)}
              disabled={buildiumLocked}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );

  const footer = (
    <div className="border-border flex flex-col gap-3 border-t px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="text-sm text-muted-foreground">
        {buildiumLocked
          ? 'This entry has already been synced to Buildium and cannot be edited.'
          : helperMessage}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {cancelButtonLabel || 'Cancel'}
          </Button>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <Button type="submit" disabled={!canSubmit} className="sm:min-w-[140px]">
            {submitButtonLabel || (mode === 'edit' ? 'Save changes' : 'Save')}
          </Button>
          {additionalActions}
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (layout === 'modal' && containerRef.current) {
      containerRef.current.focus();
    }
  }, [layout]);

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        className={cn(
          'flex max-h-screen flex-col',
          layout === 'modal' ? 'sm:max-h-[95vh]' : 'max-h-[calc(100vh-4rem)]',
        )}
      >
        {layout === 'modal' ? null : (
          <div className="border-border flex items-center justify-between border-b px-4 py-4 sm:px-6">
            <h1 className="text-2xl font-semibold text-foreground">General Journal Entry</h1>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => onClose?.()}
            >
              <X className="size-5" />
            </Button>
          </div>
        )}
        <div
          ref={containerRef}
          tabIndex={layout === 'modal' ? -1 : undefined}
          className="flex-1 overflow-hidden"
        >
          {formContent}
        </div>
        {formLevelError ? (
          <div className="border-destructive bg-destructive/5 text-destructive mx-4 mb-3 rounded-md border px-4 py-3 text-sm sm:mx-6">
            {formLevelError}
          </div>
        ) : null}
        {footer}
      </form>
    </Form>
  );
}

export default GeneralJournalEntryForm;

