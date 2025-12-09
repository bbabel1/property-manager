'use client';

import Link from 'next/link';
import { toast } from 'sonner';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Drawer, DrawerContent, DrawerTrigger, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { cn } from '@/components/ui/utils';
import { ChevronDown, ChevronUp, Paperclip, Plus, Trash2, UploadCloud } from 'lucide-react';

export type VendorOption = {
  id: string;
  label: string;
  defaultTermDays?: number | null;
};

export type VendorCategoryOption = {
  id: string;
  name: string;
  buildiumCategoryId?: number | null;
};

export type PropertyOption = { id: string; label: string };
export type UnitOption = { id: string; label: string; property_id: string | null };
export type AccountOption = { id: string; label: string; type?: string | null };

export type RecordBillFormProps = {
  vendors: VendorOption[];
  vendorCategories: VendorCategoryOption[];
  properties: PropertyOption[];
  units: UnitOption[];
  glAccounts: AccountOption[];
  payableAccounts: AccountOption[];
  defaultPropertyId?: string | null;
};

type DraftLineKind = 'expense' | 'markup';

type DraftBillLine = {
  id: string;
  kind: DraftLineKind;
  property_id: string | null;
  unit_id: string | null;
  gl_account_id: string;
  description: string;
  amount: string;
};

type TermsOption = {
  id: 'due_on_receipt' | 'net_15' | 'net_30' | 'net_45' | 'net_60';
  label: string;
  days: number;
};

type NewVendorFormState = {
  name: string;
  categoryId: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  notes: string;
};

const TERMS_OPTIONS: TermsOption[] = [
  { id: 'due_on_receipt', label: 'Due on receipt', days: 0 },
  { id: 'net_15', label: 'Net 15', days: 15 },
  { id: 'net_30', label: 'Net 30', days: 30 },
  { id: 'net_45', label: 'Net 45', days: 45 },
  { id: 'net_60', label: 'Net 60', days: 60 },
];

const makeId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const COMPANY_SENTINEL = '__company__';
const PROPERTY_LEVEL_SENTINEL = '__property_level__';
const ADD_VENDOR_SENTINEL = '__add_vendor__';
const NO_VENDOR_CATEGORY_SENTINEL = '__no_vendor_category__';
const FORM_SECTION_KEY = 'recordBill:entry';
const ATTACHMENTS_SECTION_KEY = 'recordBill:attachments';
const MAX_ATTACHMENT_COUNT = 10;
const MAX_ATTACHMENT_SIZE_MB = 25;
const MAX_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
const ACCEPTED_ATTACHMENT_TYPES = ['application/pdf', 'image/'] as const;
const ACCEPTED_ATTACHMENT_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.heic', '.heif', '.webp'];

type AttachmentPreview = {
  id: string;
  file: File;
};

const DraftLineSchema = z.object({
  id: z.string(),
  property_id: z.string().optional().nullable(),
  unit_id: z.string().optional().nullable(),
  gl_account_id: z.string().min(1, 'Select an account'),
  description: z.string().max(2000).optional().nullable(),
  amount: z.string().transform((value) => value.trim()),
});

const PayloadSchema = z.object({
  bill_date: z.string().min(1, 'Bill date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  vendor_id: z.string().min(1, 'Select a vendor'),
  post_to_account_id: z.string().min(1, 'Select an accounts payable account'),
  property_id: z.string().optional().nullable(),
  unit_id: z.string().optional().nullable(),
  terms: z.enum(['due_on_receipt', 'net_15', 'net_30', 'net_45', 'net_60']),
  reference_number: z.string().max(32).optional().nullable(),
  memo: z.string().max(2000).optional().nullable(),
  apply_markups: z.boolean().optional(),
  lines: z
    .array(
      DraftLineSchema.refine(
        (line) => parseCurrencyInput(line.amount) > 0,
        'Enter a positive amount for each line',
      ),
    )
    .min(1, 'Add at least one line item'),
});

const toIsoDate = (value: string) => value?.slice(0, 10) ?? '';

const computeDueDate = (billDate: string, term: TermsOption): string => {
  const base = new Date(`${billDate}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return billDate;
  const due = new Date(base);
  due.setUTCDate(due.getUTCDate() + term.days);
  return due.toISOString().slice(0, 10);
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number.isFinite(value) ? value : 0,
  );

const parseCurrencyInput = (value: string | null | undefined) => {
  if (typeof value !== 'string') return 0;
  const sanitized = value.replace(/[^\d.-]/g, '');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const ensureNull = (value: string | null | undefined) => {
  if (!value || value === COMPANY_SENTINEL || value === PROPERTY_LEVEL_SENTINEL) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === COMPANY_SENTINEL || trimmed === PROPERTY_LEVEL_SENTINEL) return null;
  return trimmed;
};

const formatFileSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const categorizeGLAccounts = (accounts: AccountOption[]) => {
  const grouped = accounts.reduce<Record<'expense' | 'income', AccountOption[]>>(
    (acc, account) => {
      const type = String(account.type || '').toLowerCase();
      if (type.includes('income') || type.includes('revenue')) {
        acc.income.push(account);
      } else if (type.includes('expense')) {
        acc.expense.push(account);
      }
      return acc;
    },
    { expense: [], income: [] },
  );

  const sections: { label: string; items: { value: string; label: string }[] }[] = [];
  if (grouped.expense.length) {
    sections.push({
      label: 'Expense accounts',
      items: grouped.expense.map((account) => ({ value: account.id, label: account.label })),
    });
  }
  if (grouped.income.length) {
    sections.push({
      label: 'Income accounts',
      items: grouped.income.map((account) => ({ value: account.id, label: account.label })),
    });
  }

  return sections;
};

const isAttachmentTypeAllowed = (file: File) => {
  const type = file.type?.toLowerCase() ?? '';
  if (
    ACCEPTED_ATTACHMENT_TYPES.some((accepted) =>
      accepted.endsWith('/')
        ? type.startsWith(accepted)
        : type === accepted,
    )
  ) {
    return true;
  }
  const filename = file.name?.toLowerCase() ?? '';
  return ACCEPTED_ATTACHMENT_EXTENSIONS.some((extension) => filename.endsWith(extension));
};

function usePersistentBoolean(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === null) return;
      setValue(stored === '1');
    } catch (error) {
      console.warn(`Failed to read persisted state for ${key}`, error);
    }
  }, [key]);

  const update = useCallback(
    (next: boolean | ((previous: boolean) => boolean)) => {
      setValue((previous) => {
        const resolved = typeof next === 'function' ? (next as (prev: boolean) => boolean)(previous) : next;
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, resolved ? '1' : '0');
          } catch (error) {
            console.warn(`Failed to persist state for ${key}`, error);
          }
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, update] as const;
}

type SectionCardProps = {
  storageKey: string;
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
};

function RecordBillSectionCard({
  storageKey,
  title,
  description,
  children,
  defaultOpen = true,
  className,
}: SectionCardProps) {
  const [open, setOpen] = usePersistentBoolean(storageKey, defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={cn('border-border border shadow-sm', className)}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-6 py-4">
          <div>
            <h2 className="text-foreground text-sm font-semibold">{title}</h2>
            {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
          </div>
          <CollapsibleTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {open ? 'Hide' : 'Show'}
              <ChevronDown className={cn('h-4 w-4 transition-transform', open ? 'rotate-180' : 'rotate-0')} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <CardContent className="space-y-6 px-6 py-6">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default function RecordBillForm({
  vendors,
  vendorCategories,
  properties,
  units,
  glAccounts,
  payableAccounts,
  defaultPropertyId = null,
}: RecordBillFormProps) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const defaultTerms = TERMS_OPTIONS[0];

  const realProperties = useMemo(
    () => properties.filter((property) => property.id !== COMPANY_SENTINEL),
    [properties],
  );
  const preferredPropertyId =
    (defaultPropertyId && properties.find((p) => p.id === defaultPropertyId)?.id) || null;
  const resolvedDefaultPropertyId =
    preferredPropertyId ??
    properties.find((property) => property.id === COMPANY_SENTINEL)?.id ??
    realProperties[0]?.id ??
    COMPANY_SENTINEL;

  const [isPending, startTransition] = useTransition();
  const [submitIntent, setSubmitIntent] = useState<'save' | 'save-and-new'>('save');
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({
    property_id: resolvedDefaultPropertyId,
    unit_id: '',
    vendor_id: '',
    bill_date: today,
    due_date: today,
    post_to_account_id: payableAccounts[0]?.id ?? '',
    terms: defaultTerms.id as TermsOption['id'],
    reference_number: '',
    memo: '',
    apply_markups: false,
  }));
  const buildInitialLine = () => ({
    id: makeId(),
    kind: 'expense',
    property_id: ensureNull(resolvedDefaultPropertyId),
    unit_id: null,
    gl_account_id: glAccounts[0]?.id ?? '',
    description: '',
    amount: '',
  });
  const [lines, setLines] = useState<DraftBillLine[]>(() => [buildInitialLine(), buildInitialLine()]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lineErrors, setLineErrors] = useState<Record<string, Partial<Record<keyof DraftBillLine, string>>>>(
    {},
  );
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>(() => vendors);
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const [isSummaryDrawerOpen, setIsSummaryDrawerOpen] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = usePersistentBoolean(ATTACHMENTS_SECTION_KEY, false);

  useEffect(() => {
    setVendorOptions(vendors);
  }, [vendors]);

  const vendorMap = useMemo(() => {
    const entries = vendorOptions.map((vendor) => [vendor.id, vendor] as const);
    return new Map(entries);
  }, [vendorOptions]);
  const formRef = useRef<HTMLFormElement | null>(null);

  const unitsByProperty = useMemo(() => {
    const map = new Map<string | null, UnitOption[]>();
    for (const unit of units) {
      const list = map.get(unit.property_id ?? null) ?? [];
      list.push(unit);
      map.set(unit.property_id ?? null, list);
    }
    return map;
  }, [units]);

  const propertySelectItems = useMemo(
    () =>
      properties.map((property) => ({
        value: property.id,
        label: property.label,
      })),
    [properties],
  );

  const glAccountSections = useMemo(() => categorizeGLAccounts(glAccounts), [glAccounts]);
  const payableAccountItems = useMemo(
    () => payableAccounts.map((account) => ({ value: account.id, label: account.label })),
    [payableAccounts],
  );

  const vendorItems = useMemo(
    () =>
      vendorOptions.map((vendor) => ({
        value: vendor.id,
        label: vendor.label,
      })),
    [vendorOptions],
  );
  const upsertVendorOption = useCallback((option: VendorOption) => {
    setVendorOptions((previous) => {
      const next = previous.some((vendor) => vendor.id === option.id)
        ? previous.map((vendor) => (vendor.id === option.id ? option : vendor))
        : [...previous, option];
      return next.sort((a, b) => a.label.localeCompare(b.label));
    });
  }, []);
  const [isAddVendorOpen, setIsAddVendorOpen] = useState(false);
  const [newVendorForm, setNewVendorForm] = useState<NewVendorFormState>(() => ({
    name: '',
    categoryId: vendorCategories[0]?.id ?? NO_VENDOR_CATEGORY_SENTINEL,
    contactFirstName: '',
    contactLastName: '',
    contactEmail: '',
    contactPhone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'United States',
    notes: '',
  }));
  const [newVendorErrors, setNewVendorErrors] = useState<Record<string, string>>({});
  const [newVendorStatus, setNewVendorStatus] = useState<string | null>(null);
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);

  useEffect(() => {
    setNewVendorForm((previous) => {
      if (
        previous.categoryId !== NO_VENDOR_CATEGORY_SENTINEL ||
        vendorCategories.length === 0
      ) {
        return previous;
      }
      return {
        ...previous,
        categoryId: vendorCategories[0]?.id ?? NO_VENDOR_CATEGORY_SENTINEL,
      };
    });
  }, [vendorCategories]);
  const resetNewVendorForm = useCallback(() => {
    setNewVendorForm({
      name: '',
      categoryId: vendorCategories[0]?.id ?? NO_VENDOR_CATEGORY_SENTINEL,
      contactFirstName: '',
      contactLastName: '',
      contactEmail: '',
      contactPhone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'United States',
      notes: '',
    });
    setNewVendorErrors({});
    setNewVendorStatus(null);
  }, [vendorCategories]);
  const termsDefinition = useCallback(
    (id: TermsOption['id']) => TERMS_OPTIONS.find((term) => term.id === id) ?? defaultTerms,
    [defaultTerms],
  );
  const completeNavigation = useCallback(
    (billId: string, intent: typeof submitIntent) => {
      if (intent === 'save-and-new') {
        setFormError(null);
        setFieldErrors({});
        setLineErrors({});
        const todayIso = new Date().toISOString().slice(0, 10);
        const currentTerms = termsDefinition(form.terms);
        setForm((previous) => ({
          ...previous,
          vendor_id: '',
          reference_number: '',
          memo: '',
          bill_date: todayIso,
          due_date: computeDueDate(todayIso, currentTerms),
        }));
        setLines([buildInitialLine(), buildInitialLine()]);
        setSubmitIntent('save');
        return;
      }
      router.push(`/bills/${billId}`);
      router.refresh();
      setSubmitIntent('save');
    },
    [buildInitialLine, router, termsDefinition, form.terms],
  );

  const retryBuildiumSync = useCallback(
    async (billId: string, intent: typeof submitIntent) => {
      const promise = fetch('/api/buildium/bills/sync/to-buildium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localId: billId }),
      }).then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            (payload && typeof payload.error === 'string' && payload.error) ||
            'Retry failed. Please try again later.';
          throw new Error(message);
        }
        return payload;
      });

      await toast.promise(promise, {
        loading: 'Retrying Buildium sync…',
        success: 'Bill synced to Buildium',
        error: (error) => error.message || 'Retry failed. Please try again later.',
      });

      completeNavigation(billId, intent);
    },
    [completeNavigation],
  );

  const showBuildiumFailureToast = useCallback(
    (billId: string, intent: typeof submitIntent, message?: string) => {
      toast.error('Buildium sync failed', {
        description:
          message ||
          'The bill was saved locally, but Buildium could not be updated. Retry the sync or keep it local.',
        action: {
          label: 'Retry sync',
          onClick: () => retryBuildiumSync(billId, intent),
        },
        cancel: {
          label: 'Proceed without Buildium',
          onClick: () => completeNavigation(billId, intent),
        },
      });
    },
    [completeNavigation, retryBuildiumSync],
  );
  const openAddVendorDialog = useCallback(() => {
    resetNewVendorForm();
    setIsAddVendorOpen(true);
  }, [resetNewVendorForm]);

  const setNewVendorField = useCallback(
    <K extends keyof NewVendorFormState>(key: K, value: NewVendorFormState[K]) => {
      setNewVendorForm((previous) => ({ ...previous, [key]: value }));
      setNewVendorErrors((previous) => {
        if (!previous[key as string]) return previous;
        const next = { ...previous };
        delete next[key as string];
        return next;
      });
    },
    [],
  );

  const setFormValue = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      return next;
    });
    setFieldErrors((previous) => {
      if (!previous[key as string]) return previous;
      const next = { ...previous };
      delete next[key as string];
      return next;
    });
  };

  const buildDraftLine = useCallback(
    (overrides: Partial<DraftBillLine> = {}): DraftBillLine => {
      const { id: _ignored, ...rest } = overrides;
      return {
        id: makeId(),
        kind: rest.kind ?? 'expense',
        property_id: rest.property_id ?? ensureNull(form.property_id),
        unit_id: rest.unit_id ?? ensureNull(form.unit_id),
        gl_account_id: rest.gl_account_id ?? glAccounts[0]?.id ?? '',
        description:
          typeof rest.description === 'string' && rest.description.length > 0
            ? rest.description
            : form.memo || '',
        amount: rest.amount ?? '',
      };
    },
    [glAccounts, form.memo, form.property_id, form.unit_id],
  );

  useEffect(() => {
    if (!lines.length) return;
    const lastLine = lines[lines.length - 1];
    if (parseCurrencyInput(lastLine.amount) <= 0) return;
    setLines((previous) => {
      if (!previous.length) return previous;
      const latestLast = previous[previous.length - 1];
      if (latestLast.id !== lastLine.id) return previous;
      return [...previous, buildDraftLine()];
    });
  }, [lines, buildDraftLine]);

  const removeLine = (id: string) => {
    setLines((previous) => {
      if (previous.length === 1) return previous;
      return previous.filter((line) => line.id !== id);
    });
    setLineErrors((previous) => {
      if (!previous[id]) return previous;
      const next = { ...previous };
      delete next[id];
      return next;
    });
  };

  const setLineValue = (id: string, patch: Partial<DraftBillLine>) => {
    setLines((previous) => previous.map((line) => (line.id === id ? { ...line, ...patch } : line)));
    setLineErrors((previous) => {
      if (!previous[id]) return previous;
      const next = { ...previous };
      next[id] = { ...next[id], ...Object.fromEntries(Object.keys(patch).map((k) => [k, ''])) };
      return next;
    });
  };

  const handleAttachmentSelection = (files: FileList | File[] | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    if (!incoming.length) return;
    setAttachments((previous) => {
      const availableSlots = MAX_ATTACHMENT_COUNT - previous.length;
      if (availableSlots <= 0) {
        setAttachmentError(`You can attach up to ${MAX_ATTACHMENT_COUNT} files.`);
        return previous;
      }
      const accepted: AttachmentPreview[] = [];
      let rejectionMessage: string | null = null;
      for (const file of incoming) {
        if (accepted.length >= availableSlots) break;
        if (!isAttachmentTypeAllowed(file)) {
          rejectionMessage = `${file.name} is not a supported file type.`;
          continue;
        }
        if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
          rejectionMessage = `${file.name} exceeds ${MAX_ATTACHMENT_SIZE_MB}MB.`;
          continue;
        }
        accepted.push({ id: makeId(), file });
      }
      if (rejectionMessage) {
        setAttachmentError(rejectionMessage);
      } else {
        setAttachmentError(null);
      }
      if (!accepted.length) {
        return previous;
      }
      return [...previous, ...accepted];
    });
  };

  const onAttachmentInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleAttachmentSelection(event.target.files);
    event.target.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((previous) => previous.filter((attachment) => attachment.id !== id));
    setAttachmentError(null);
  };

  const openAttachmentPicker = () => {
    attachmentInputRef.current?.click();
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
    handleAttachmentSelection(event.dataTransfer?.files ?? null);
  };

  const submitNewVendor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    if (!newVendorForm.name.trim()) {
      errors.name = 'Vendor name is required';
    }
    if (Object.keys(errors).length) {
      setNewVendorErrors(errors);
      return;
    }
    setIsCreatingVendor(true);
    setNewVendorStatus(null);
    try {
      const payload = {
        name: newVendorForm.name.trim(),
        categoryId:
          newVendorForm.categoryId && newVendorForm.categoryId !== NO_VENDOR_CATEGORY_SENTINEL
            ? newVendorForm.categoryId
            : null,
        contactFirstName: newVendorForm.contactFirstName,
        contactLastName: newVendorForm.contactLastName,
        contactEmail: newVendorForm.contactEmail,
        contactPhone: newVendorForm.contactPhone,
        addressLine1: newVendorForm.addressLine1,
        addressLine2: newVendorForm.addressLine2,
        city: newVendorForm.city,
        state: newVendorForm.state,
        postalCode: newVendorForm.postalCode,
        country: newVendorForm.country,
        notes: newVendorForm.notes,
      };

      const response = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = (await response.json().catch(() => ({}))) as {
        data?: { id?: string | number | null; label?: string | null; defaultTermDays?: number | null };
        error?: string;
      };

      if (!response.ok) {
        const message =
          typeof json?.error === 'string'
            ? json.error
            : 'Unable to create vendor. Please try again.';
        setNewVendorStatus(message);
        return;
      }

      const createdId = json?.data?.id ? String(json.data.id) : null;
      if (!createdId) {
        setNewVendorStatus('Vendor was created but no identifier was returned.');
        return;
      }

      const label =
        json?.data?.label && typeof json.data.label === 'string'
          ? json.data.label
          : newVendorForm.name.trim();

      upsertVendorOption({
        id: createdId,
        label,
        defaultTermDays:
          typeof json?.data?.defaultTermDays === 'number' ? json.data.defaultTermDays : null,
      });
      setFormValue('vendor_id', createdId);
      resetNewVendorForm();
      setIsAddVendorOpen(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to create vendor.';
      setNewVendorStatus(message);
    } finally {
      setIsCreatingVendor(false);
    }
  };

  const markupsAvailable = Boolean(ensureNull(form.property_id));

  const { expense: expenseSubtotal, markup: markupSubtotal } = useMemo(
    () =>
      lines.reduce(
        (acc, line) => {
          const parsed = parseCurrencyInput(line.amount);
          const normalized = Math.abs(parsed);
          if (line.kind === 'markup') {
            acc.markup += normalized;
          } else {
            acc.expense += normalized;
          }
          return acc;
        },
        { expense: 0, markup: 0 },
      ),
    [lines],
  );

  const subtotal = Number.isFinite(expenseSubtotal) ? expenseSubtotal : 0;
  const normalizedMarkupSubtotal = Number.isFinite(markupSubtotal) ? markupSubtotal : 0;
  const markupTotal = form.apply_markups ? normalizedMarkupSubtotal : 0;
  const taxTotal = 0;
  const balanceDue = Number.isFinite(subtotal + markupTotal + taxTotal)
    ? subtotal + markupTotal + taxTotal
    : 0;
  const hasValidLineItem = useMemo(
    () =>
      lines.some((line) => {
        const parsed = parseCurrencyInput(line.amount);
        return parsed > 0 && Boolean(line.gl_account_id);
      }),
    [lines],
  );
  const requiredFieldsReady = Boolean(
    form.vendor_id && form.post_to_account_id && form.bill_date && form.due_date,
  );
  const isSubmitDisabled = isPending || !requiredFieldsReady || !hasValidLineItem;
  useEffect(() => {
    if (!markupsAvailable && form.apply_markups) {
      setForm((previous) => ({ ...previous, apply_markups: false }));
    }
  }, [form.apply_markups, markupsAvailable]);

  const syncDueDate = (nextTerms: TermsOption['id'], baseDate = form.bill_date) => {
    const def = termsDefinition(nextTerms);
    const computed = computeDueDate(baseDate, def);
    setFormValue('due_date', computed);
  };

  const onBillDateChange = (value: string) => {
    const sanitized = toIsoDate(value);
    setFormValue('bill_date', sanitized);
    syncDueDate(form.terms, sanitized);
  };

  const onTermsChange = (value: TermsOption['id']) => {
    setFormValue('terms', value);
    syncDueDate(value);
  };

  const onVendorChange = (value: string) => {
    if (value === ADD_VENDOR_SENTINEL) {
      openAddVendorDialog();
      return;
    }
    setFormValue('vendor_id', value);
    const vendor = vendorMap.get(value);
    if (vendor?.defaultTermDays != null) {
      const match = TERMS_OPTIONS.find((term) => term.days === vendor.defaultTermDays);
      if (match) {
        setFormValue('terms', match.id);
        syncDueDate(match.id);
      }
    }
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setLineErrors({});

    const rawLines = lines.map((line) => {
      const { kind: _kind, ...rest } = line;
      return {
        ...rest,
        property_id: ensureNull(line.property_id),
        unit_id: ensureNull(line.unit_id),
        description: line.description ?? '',
      };
    });

    const filteredLines = rawLines.filter((line) => parseCurrencyInput(line.amount) > 0);

    const payloadCandidate = {
        bill_date: toIsoDate(form.bill_date),
        due_date: toIsoDate(form.due_date),
        vendor_id: form.vendor_id,
        post_to_account_id: form.post_to_account_id,
        property_id: ensureNull(form.property_id),
        unit_id: ensureNull(form.unit_id),
        terms: form.terms,
      reference_number: form.reference_number?.trim() || '',
      memo: form.memo?.trim() || '',
      apply_markups: Boolean(form.apply_markups),
      lines: filteredLines,
    };

    const parseResult = PayloadSchema.safeParse(payloadCandidate);
    if (!parseResult.success) {
      const issues = parseResult.error.issues;
      const nextFieldErrors: Record<string, string> = {};
      const nextLineErrors: Record<
        string,
        Partial<Record<keyof DraftBillLine, string>>
      > = {};
      for (const issue of issues) {
        const [pathRoot, maybeIndex, maybeField] = issue.path as Array<string | number>;
        if (pathRoot === 'lines' && typeof maybeIndex === 'number') {
          const target = lines[Number(maybeIndex)];
          if (!target) continue;
          const field =
            (typeof maybeField === 'string' ? (maybeField as keyof DraftBillLine) : 'amount') ||
            'amount';
          nextLineErrors[target.id] = {
            ...(nextLineErrors[target.id] || {}),
            [field]: issue.message,
          };
        } else if (typeof pathRoot === 'string') {
          nextFieldErrors[pathRoot] = issue.message;
        } else {
          setFormError(issue.message);
        }
      }
      setFieldErrors(nextFieldErrors);
      setLineErrors(nextLineErrors);
      return;
    }

    const payload = parseResult.data;
    startTransition(async () => {
      try {
        const response = await fetch('/api/bills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...payload,
            lines: payload.lines.map((line) => ({
              property_id: ensureNull(line.property_id),
              unit_id: ensureNull(line.unit_id),
              gl_account_id: line.gl_account_id,
              description: line.description ?? '',
              amount: parseCurrencyInput(line.amount),
            })),
            reference_number: payload.reference_number || null,
            memo: payload.memo || null,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          const message =
            typeof data?.error === 'string'
              ? data.error
              : data?.error?.message || 'Failed to record bill.';
          setFormError(message);
          setSubmitIntent('save');
          return;
        }

        const json = (await response.json().catch(() => ({}))) as {
          data?: { id?: string | number | null };
          buildium?: { success?: boolean; message?: string | null };
        };
        const billId = json?.data?.id ? String(json.data.id) : null;
        const buildiumResult = json?.buildium;
        const intent = submitIntent;

        if (!billId) {
          setFormError('Bill saved, but we could not determine the record identifier.');
          setSubmitIntent('save');
          return;
        }

        if (buildiumResult?.success === false) {
          showBuildiumFailureToast(billId, intent, buildiumResult.message ?? undefined);
          return;
        }

        completeNavigation(billId, intent);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to save bill right now.';
        setFormError(message);
        setSubmitIntent('save');
      }
    });
  };

  return (
    <>
      <form ref={formRef} className="space-y-6 pb-24" onSubmit={submit} noValidate>

      {formError ? (
        <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-4 py-3 text-sm">
          {formError}
        </div>
      ) : null}


      <RecordBillSectionCard
        storageKey={FORM_SECTION_KEY}
        title="Bill workspace"
        description="Capture who you're paying, allocate costs, and attach supporting docs."
      >
        <div className="space-y-10">
          <section className="space-y-6">
            <div className="flex flex-wrap gap-4">
              <label className="block space-y-1">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Date *
                </span>
                <DateInput value={form.bill_date} onChange={onBillDateChange} className="w-[18rem]" />
                {fieldErrors.bill_date ? (
                  <p className="text-destructive text-xs">{fieldErrors.bill_date}</p>
                ) : null}
              </label>
              <label className="block space-y-1">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Due *
                </span>
                <DateInput
                  value={form.due_date}
                  onChange={(value) => setFormValue('due_date', toIsoDate(value))}
                  className="w-[18rem]"
                />
                {fieldErrors.due_date ? (
                  <p className="text-destructive text-xs">{fieldErrors.due_date}</p>
                ) : null}
              </label>
            </div>

            <div className="space-y-2">
              <label className="block space-y-1">
                <span className="text-muted-foreground block text-xs font-semibold uppercase tracking-wide">
                  Pay to *
                </span>
                <Select value={form.vendor_id} onValueChange={onVendorChange}>
                  <SelectTrigger className="w-full sm:w-[28rem]">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendorItems.map((vendor) => (
                      <SelectItem key={vendor.value} value={vendor.value}>
                        {vendor.label}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value={ADD_VENDOR_SENTINEL} className="text-primary">
                      + Add new vendor
                    </SelectItem>
                  </SelectContent>
                </Select>
                {fieldErrors.vendor_id ? (
                  <p className="text-destructive text-xs">{fieldErrors.vendor_id}</p>
                ) : null}
              </label>
              <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
                <button
                  type="button"
                  onClick={openAddVendorDialog}
                  className="text-primary flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add vendor
                </button>
                <Link href="/maintenance/add-work-order" className="text-primary flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add work order
                </Link>
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Reference number
              </span>
              <Input
                value={form.reference_number}
                onChange={(event) => setFormValue('reference_number', event.target.value)}
                placeholder="Optional"
                className="w-full"
              />
              {fieldErrors.reference_number ? (
                <p className="text-destructive text-xs">{fieldErrors.reference_number}</p>
              ) : null}
            </label>

            <label className="block space-y-1">
              <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Memo
              </span>
              <Textarea
                rows={4}
                value={form.memo}
                onChange={(event) => setFormValue('memo', event.target.value)}
                placeholder="Optional notes for this bill"
              />
            </label>

          </section>

          <section className="space-y-4">
            <div className="relative overflow-hidden rounded-lg border border-border/70">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[18rem]">Property or company</TableHead>
                    <TableHead className="w-[12rem]">Unit</TableHead>
                    <TableHead className="w-[18rem]">Account</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[10rem] text-right">Initial amount</TableHead>
                    <TableHead className="w-[8rem]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => {
                    const unitsForRow = line.property_id
                      ? unitsByProperty.get(line.property_id) ?? []
                      : [];
                    const errorsForRow = lineErrors[line.id] || {};
                    const isMarkupRow = line.kind === 'markup';
                    return (
                      <TableRow
                        key={line.id}
                        className={cn('align-middle', isMarkupRow ? 'bg-primary/5' : undefined)}
                      >
                        <TableCell className="align-middle">
                          <Select
                            value={line.property_id ?? COMPANY_SENTINEL}
                            onValueChange={(value) =>
                              setLineValue(line.id, {
                                property_id: ensureNull(value),
                                unit_id: null,
                              })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Company (no property)" />
                            </SelectTrigger>
                            <SelectContent>
                              {propertySelectItems.map((property) => (
                                <SelectItem key={property.value} value={property.value}>
                                  {property.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errorsForRow.property_id ? (
                            <p className="text-destructive text-xs">{errorsForRow.property_id}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-middle">
                          <Select
                            value={line.unit_id ?? PROPERTY_LEVEL_SENTINEL}
                            onValueChange={(value) =>
                              setLineValue(line.id, { unit_id: ensureNull(value) })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Property level" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={PROPERTY_LEVEL_SENTINEL}>Property level</SelectItem>
                              {unitsForRow.map((unit) => (
                                <SelectItem key={unit.id} value={unit.id}>
                                  {unit.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errorsForRow.unit_id ? (
                            <p className="text-destructive text-xs">{errorsForRow.unit_id}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-middle">
                        <Select
                          value={line.gl_account_id}
                          onValueChange={(value) => setLineValue(line.id, { gl_account_id: value })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {glAccountSections.map((section) => (
                              <div key={section.label}>
                                <div className="text-foreground px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  {section.label}
                                </div>
                                {section.items.map((account) => (
                                  <SelectItem key={account.value} value={account.value}>
                                    {account.label}
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                          {errorsForRow.gl_account_id ? (
                            <p className="text-destructive text-xs">{errorsForRow.gl_account_id}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-middle">
                          <Input
                            value={line.description}
                            onChange={(event) =>
                              setLineValue(line.id, { description: event.target.value })
                            }
                            placeholder="Optional description"
                          />
                          {isMarkupRow ? (
                            <Badge variant="secondary" className="mt-2 text-[0.65rem] uppercase">
                              Markup
                            </Badge>
                          ) : null}
                          {errorsForRow.description ? (
                            <p className="text-destructive text-xs">{errorsForRow.description}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-middle text-right">
                          <Input
                            value={line.amount}
                            onChange={(event) => setLineValue(line.id, { amount: event.target.value })}
                            inputMode="decimal"
                            placeholder="0.00"
                            className="text-right"
                          />
                          {errorsForRow.amount ? (
                            <p className="text-destructive text-xs text-right">{errorsForRow.amount}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="align-middle">
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span>
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    aria-label="Remove line"
                                    onClick={() => removeLine(line.id)}
                                    disabled={lines.length === 1}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {lines.length === 1 ? 'At least one line item is required' : 'Remove line'}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </section>

          <section className="rounded-lg border border-border/70 bg-background px-6 py-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-foreground text-sm font-semibold">Attachments</h2>
                <p className="text-muted-foreground text-xs">
                  Drop invoices, receipts, or supporting docs to keep everything with the bill.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAttachmentsOpen((previous) => !previous)}
              >
                {attachmentsOpen ? 'Hide attachments' : 'Show attachments'}
              </Button>
            </div>
            {attachmentsOpen ? (
              <div className="mt-4 space-y-4">
                <div
                  className={cn(
                    'rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
                    isDragActive ? 'border-primary bg-primary/5' : 'border-border/70',
                  )}
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <UploadCloud className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">
                    Drag &amp; drop vendor files, or{' '}
                    <button type="button" className="text-primary underline" onClick={openAttachmentPicker}>
                      browse your computer
                    </button>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Up to {MAX_ATTACHMENT_COUNT} files, {MAX_ATTACHMENT_SIZE_MB}MB each. PDF or image formats are supported.
                  </p>
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    multiple
                    accept="application/pdf,image/*"
                    onChange={onAttachmentInputChange}
                    className="sr-only"
                  />
                </div>
                {attachmentError ? <p className="text-destructive text-sm">{attachmentError}</p> : null}
                {attachments.length ? (
                  <ul className="space-y-2">
                    {attachments.map((attachment) => (
                      <li
                        key={attachment.id}
                        className="flex items-center justify-between rounded-md border border-border/70 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-foreground font-medium">{attachment.file.name}</p>
                            <p className="text-muted-foreground text-xs">{formatFileSize(attachment.file.size)}</p>
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeAttachment(attachment.id)}>
                          Remove
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </RecordBillSectionCard>

      <div className="border-border bg-muted/10 sticky bottom-0 z-10 hidden md:flex flex-wrap items-center justify-between gap-3 border px-4 py-4">
        <div className="text-sm">
          <span className="text-muted-foreground">Balance due:</span>{' '}
          <span className="font-semibold">{formatCurrency(balanceDue)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="submit"
            variant="default"
            disabled={isSubmitDisabled}
            onClick={() => setSubmitIntent('save')}
          >
            {isPending ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitDisabled}
            onClick={() => {
              setSubmitIntent('save-and-new');
              formRef.current?.requestSubmit();
            }}
          >
            Save &amp; new
          </Button>
          <Button type="button" variant="ghost" disabled={isPending} asChild>
            <Link href="/bills">Cancel</Link>
          </Button>
        </div>
      </div>
      <Drawer open={isSummaryDrawerOpen} onOpenChange={setIsSummaryDrawerOpen}>
        <DrawerTrigger asChild>
          <button
            type="button"
            className="border-border/70 bg-background/95 md:hidden sticky bottom-0 z-20 flex w-full items-center justify-between border-t px-4 py-3 shadow-lg backdrop-blur"
            aria-label="Open bill summary drawer"
          >
            <div className="text-left">
              <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                Balance due
              </p>
              <p className="text-base font-semibold text-foreground">
                {formatCurrency(balanceDue)}
              </p>
            </div>
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          </button>
        </DrawerTrigger>
        <DrawerContent className="md:hidden">
          <DrawerHeader className="pb-2">
            <DrawerTitle>Bill actions</DrawerTitle>
            <p className="text-muted-foreground text-sm">
              Balance due:{' '}
              <span className="font-semibold text-foreground">{formatCurrency(balanceDue)}</span>
            </p>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <div className="flex flex-col gap-2">
              <Button
                type="submit"
                variant="default"
                disabled={isSubmitDisabled}
                onClick={() => setSubmitIntent('save')}
                className="w-full"
              >
                {isPending ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitDisabled}
                className="w-full"
                onClick={() => {
                  setSubmitIntent('save-and-new');
                  formRef.current?.requestSubmit();
                }}
              >
                Save &amp; new
              </Button>
              <Button type="button" variant="ghost" asChild className="w-full" disabled={isPending}>
                <Link href="/bills">Cancel</Link>
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </form>
      <Dialog
        open={isAddVendorOpen}
        onOpenChange={(open) => {
          setIsAddVendorOpen(open);
          if (!open) resetNewVendorForm();
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add vendor</DialogTitle>
            <DialogDescription>
              Create a vendor without leaving this workflow. You can add more details later from the
              vendor profile.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitNewVendor} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Vendor name *
                </span>
                <Input
                  value={newVendorForm.name}
                  onChange={(event) => setNewVendorField('name', event.target.value)}
                  placeholder="Company or contractor name"
                />
                {newVendorErrors.name ? (
                  <p className="text-destructive text-xs">{newVendorErrors.name}</p>
                ) : null}
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Category
                </span>
                <Select
                  value={newVendorForm.categoryId}
                  onValueChange={(value) => setNewVendorField('categoryId', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_VENDOR_CATEGORY_SENTINEL}>Uncategorized</SelectItem>
                    {vendorCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Contact first name
                </span>
                <Input
                  value={newVendorForm.contactFirstName}
                  onChange={(event) => setNewVendorField('contactFirstName', event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Contact last name
                </span>
                <Input
                  value={newVendorForm.contactLastName}
                  onChange={(event) => setNewVendorField('contactLastName', event.target.value)}
                  placeholder="Optional"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Email
                </span>
                <Input
                  type="email"
                  value={newVendorForm.contactEmail}
                  onChange={(event) => setNewVendorField('contactEmail', event.target.value)}
                  placeholder="name@example.com"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Phone
                </span>
                <Input
                  value={newVendorForm.contactPhone}
                  onChange={(event) => setNewVendorField('contactPhone', event.target.value)}
                  placeholder="(555) 123-4567"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Address line 1
                </span>
                <Input
                  value={newVendorForm.addressLine1}
                  onChange={(event) => setNewVendorField('addressLine1', event.target.value)}
                  placeholder="123 Main Street"
                />
              </label>
              <label className="space-y-1 text-sm md:col-span-2">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Address line 2
                </span>
                <Input
                  value={newVendorForm.addressLine2}
                  onChange={(event) => setNewVendorField('addressLine2', event.target.value)}
                  placeholder="Suite or unit (optional)"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  City
                </span>
                <Input
                  value={newVendorForm.city}
                  onChange={(event) => setNewVendorField('city', event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  State / Region
                </span>
                <Input
                  value={newVendorForm.state}
                  onChange={(event) => setNewVendorField('state', event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Postal code
                </span>
                <Input
                  value={newVendorForm.postalCode}
                  onChange={(event) => setNewVendorField('postalCode', event.target.value)}
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                  Country
                </span>
                <Input
                  value={newVendorForm.country}
                  onChange={(event) => setNewVendorField('country', event.target.value)}
                  placeholder="United States"
                />
              </label>
            </div>

            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">
                Notes
              </span>
              <Textarea
                rows={3}
                value={newVendorForm.notes}
                onChange={(event) => setNewVendorField('notes', event.target.value)}
                placeholder="Internal notes (optional)"
              />
            </label>

            {newVendorStatus ? (
              <p className="text-destructive text-sm">{newVendorStatus}</p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  resetNewVendorForm();
                  setIsAddVendorOpen(false);
                }}
                disabled={isCreatingVendor}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isCreatingVendor}>
                {isCreatingVendor ? 'Saving…' : 'Save vendor'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
