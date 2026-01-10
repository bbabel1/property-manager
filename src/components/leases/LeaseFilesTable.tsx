'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ActionButton from '@/components/ui/ActionButton';
import { CheckCircle2, Download, Eye, Loader2, Mail, RefreshCcw, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { FileRow } from '@/lib/files';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';

type LeaseFileCategory = {
  id: string;
  category_name: string;
  buildium_category_id: number | null;
  description?: string | null;
  is_active?: boolean | null;
};

type LeaseFileCategoryOption = {
  name: string;
  buildiumCategoryId: number | null;
};

interface LeaseFileRecord {
  id: string;
  title: string;
  uploadedAt: string;
  uploadedBy: string | null;
  buildiumFileId: number | null;
  buildiumHref: string | null;
  category: string | null;
  description: string | null;
  isPrivate: boolean;
  shareWithTenants?: boolean | null;
  shareWithRentalOwners?: boolean | null;
}

interface LeaseFilesTableProps {
  leaseId: number;
  isBuildiumLinked: boolean;
  initialFiles: {
    files: FileRow[];
    links: Array<{
      id: string;
      file_id: string;
      entity_type: string;
      entity_id: number;
      added_at: string;
      added_by: string | null;
      category: string | null;
    }>;
  };
  categories?: LeaseFileCategory[];
}

interface UploadPayload {
  file: File;
  title: string;
  categoryName: string;
  buildiumCategoryId: number | null;
  description: string;
}

type UpdateFilePayload = {
  title?: string;
  description?: string | null;
  categoryId?: number | null;
  shareWithTenants?: boolean;
  shareWithRentalOwners?: boolean;
};

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf'];
const ALLOWED_MIME_TYPES = new Set<string>([
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.template',
  'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  'text/plain',
]);
const UNSUPPORTED_FILE_MESSAGE =
  'Unsupported file type. Allowed formats: PDF, images, and Office documents.';

const isAllowedMimeType = (mimeType: string | undefined | null) => {
  if (!mimeType) return true;
  for (const prefix of ALLOWED_MIME_PREFIXES) {
    if (mimeType.startsWith(prefix)) return true;
  }
  if (ALLOWED_MIME_TYPES.has(mimeType)) return true;
  if (mimeType.startsWith('application/vnd.openxmlformats-officedocument')) return true;
  return false;
};

type UploadStatus = 'idle' | 'uploading' | 'error';

function formatDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function mapInitialFiles(
  payload: LeaseFilesTableProps['initialFiles'] | undefined,
  categoryLookup?: Map<number, string>,
): LeaseFileRecord[] {
  if (!payload) return [];
  const files = Array.isArray(payload.files) ? payload.files : [];
  const links = Array.isArray(payload.links) ? payload.links : [];
  const filesById = new Map(files.map((file) => [file.id, file]));

  // Map files directly (links are now just for compatibility with existing component structure)
  // In the new schema, files contain entity_type/entity_id directly
  return links
    .map((link) => {
      const file = filesById.get(link.file_id);
      if (!file) return null;
      return {
        id: file.id,
        title: file.title || file.file_name || 'Document',
        uploadedAt: link.added_at || file.created_at,
        uploadedBy: normalizeUploader(link.added_by || file.created_by),
        buildiumFileId: file.buildium_file_id ?? null,
        buildiumHref: file.buildium_href ?? null,
        category:
          link.category ||
          (typeof file.buildium_category_id === 'number'
            ? (categoryLookup?.get(file.buildium_category_id) ?? null)
            : null),
        description: file.description || null,
        isPrivate: file.is_private,
      } satisfies LeaseFileRecord;
    })
    .filter(Boolean) as LeaseFileRecord[];
}

function sortRecords(records: LeaseFileRecord[]): LeaseFileRecord[] {
  return [...records].sort((a, b) => {
    const aTime = new Date(a.uploadedAt || '').getTime();
    const bTime = new Date(b.uploadedAt || '').getTime();
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return bTime - aTime;
  });
}

function ensureFileName(title: string, file: File) {
  const trimmed = title.trim();
  if (!trimmed) return file.name;
  if (trimmed.includes('.')) return trimmed;
  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  return ext ? `${trimmed}.${ext}` : trimmed;
}

interface LeaseFileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isBuildiumLinked: boolean;
  onSubmit: (payload: UploadPayload) => Promise<void>;
  isSaving: boolean;
  error?: string | null;
  categoryOptions: LeaseFileCategoryOption[];
}

function LeaseFileUploadDialog({
  open,
  onOpenChange,
  isBuildiumLinked,
  onSubmit,
  isSaving,
  error: externalError,
  categoryOptions,
}: LeaseFileUploadDialogProps) {
  const normalizedCategoryOptions = useMemo<LeaseFileCategoryOption[]>(() => {
    const unique = new Map<string, LeaseFileCategoryOption>();
    for (const rawOption of categoryOptions ?? []) {
      if (!rawOption) continue;
      const name = typeof rawOption.name === 'string' ? rawOption.name.trim() : '';
      if (!name) continue;
      if (!unique.has(name)) {
        const buildiumCategoryId =
          typeof rawOption.buildiumCategoryId === 'number' &&
          Number.isFinite(rawOption.buildiumCategoryId)
            ? rawOption.buildiumCategoryId
            : null;
        unique.set(name, { name, buildiumCategoryId });
      }
    }
    if (unique.size === 0) {
      return [{ name: 'Lease', buildiumCategoryId: null }];
    }
    return Array.from(unique.values());
  }, [categoryOptions]);

  const defaultCategoryName = normalizedCategoryOptions[0]?.name ?? 'Lease';

  const [step, setStep] = useState<'select' | 'details'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [categoryName, setCategoryName] = useState(defaultCategoryName);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCategoryName(defaultCategoryName);
  }, [defaultCategoryName]);

  const resetState = useCallback(() => {
    setStep('select');
    setSelectedFile(null);
    setTitle('');
    setCategoryName(defaultCategoryName);
    setDescription('');
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [defaultCategoryName]);

  const close = useCallback(() => {
    onOpenChange(false);
    resetState();
  }, [onOpenChange, resetState]);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];
    setSelectedFile(file);
    setTitle(file.name);
    setStep('details');
    setError(null);
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  const onDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    try {
      setError(null);
      const selectedOption =
        normalizedCategoryOptions.find((option) => option.name === categoryName) ??
        normalizedCategoryOptions[0];
      const selectedName = selectedOption?.name ?? defaultCategoryName;
      const selectedCategoryId =
        typeof selectedOption?.buildiumCategoryId === 'number'
          ? selectedOption.buildiumCategoryId
          : null;
      await onSubmit({
        file: selectedFile,
        title,
        categoryName: selectedName,
        buildiumCategoryId: selectedCategoryId,
        description,
      });
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className="top-[35%] w-[680px] max-w-[680px] translate-y-[-35%]">
        <DialogHeader>
          <DialogTitle>Upload lease file</DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Choose a file to upload and attach to this lease.'
              : 'Review file details before saving.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="space-y-4">
            {!isBuildiumLinked ? (
              <div className="rounded-md border border-dashed border-amber-500/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-700">
                This lease is not linked to Buildium. Files will be stored locally until the lease
                is linked.
              </div>
            ) : null}
            <label
              onDrop={onDrop}
              onDragOver={(event) => event.preventDefault()}
              className="border-muted-foreground/40 bg-muted/40 text-muted-foreground hover:border-primary hover:text-primary flex h-40 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-sm transition"
            >
              <div className="text-center">
                Drag &amp; drop files here or <span className="text-primary underline">Browse</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="application/pdf,image/*"
                onChange={onFileInputChange}
              />
            </label>
            <div className="text-muted-foreground text-xs">
              Supported formats include PDF and common image types. Maximum size 25 MB.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {error ? (
              <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                {error}
              </div>
            ) : externalError ? (
              <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
                {externalError}
              </div>
            ) : null}
            <div className="overflow-hidden rounded-md border">
              <div className="bg-muted/60 text-muted-foreground grid grid-cols-12 text-xs font-semibold tracking-wide uppercase">
                <div className="col-span-4 px-4 py-2">Title</div>
                <div className="col-span-3 px-4 py-2">Category</div>
                <div className="col-span-5 px-4 py-2">Description</div>
              </div>
              <div className="bg-background grid grid-cols-12 items-center gap-3 border-t px-3 py-3">
                <div className="col-span-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-[var(--color-action-600)]" />
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} />
                </div>
                <div className="col-span-3">
                  <select
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    className="border-input bg-background focus-visible:ring-primary w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                    aria-label="File category"
                  >
                    {normalizedCategoryOptions.map((option) => (
                      <option key={option.name} value={option.name}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-5">
                  <Input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Add an optional description"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {step === 'details' ? (
            <>
              <Button type="button" onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
                  </>
                ) : (
                  'Save'
                )}
              </Button>
              <Button type="button" variant="cancel" onClick={close} disabled={isSaving}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" variant="cancel" onClick={close} disabled={isSaving}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function LeaseFilesTable({
  leaseId,
  isBuildiumLinked,
  initialFiles,
  categories = [],
}: LeaseFilesTableProps) {
  const categoryLookup = useMemo(() => {
    const map = new Map<number, string>();
    for (const category of categories ?? []) {
      if (
        category &&
        typeof category.buildium_category_id === 'number' &&
        typeof category.category_name === 'string'
      ) {
        const trimmed = category.category_name.trim();
        if (trimmed) {
          map.set(category.buildium_category_id, trimmed);
        }
      }
    }
    return map;
  }, [categories]);

  const categoryOptionRecords = useMemo<LeaseFileCategoryOption[]>(() => {
    const unique = new Map<string, LeaseFileCategoryOption>();
    for (const category of categories ?? []) {
      if (!category) continue;
      const name = typeof category.category_name === 'string' ? category.category_name.trim() : '';
      if (!name) continue;
      if (!unique.has(name)) {
        const buildiumCategoryId =
          typeof category.buildium_category_id === 'number' &&
          Number.isFinite(category.buildium_category_id)
            ? category.buildium_category_id
            : null;
        unique.set(name, { name, buildiumCategoryId });
      }
    }
    if (unique.size === 0) {
      return [{ name: 'Lease', buildiumCategoryId: null }];
    }
    return Array.from(unique.values());
  }, [categories]);

  const defaultCategory = categoryOptionRecords[0]?.name ?? 'Lease';

  const initialRecords = useMemo(
    () => sortRecords(mapInitialFiles(initialFiles, categoryLookup)),
    [initialFiles, categoryLookup],
  );

  const [files, setFiles] = useState<LeaseFileRecord[]>(initialRecords);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [fileBeingEdited, setFileBeingEdited] = useState<LeaseFileRecord | null>(null);
  const [syncingFileId, setSyncingFileId] = useState<string | null>(null);

  useEffect(() => {
    setFiles(initialRecords);
  }, [initialRecords]);

  const matchesLabel = useMemo(() => {
    const count = files.length;
    return `${count} document${count === 1 ? '' : 's'}`;
  }, [files.length]);

  const uploadFile = useCallback(
    async ({ file, title, categoryName, buildiumCategoryId, description }: UploadPayload) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        const message = 'Files must be 25 MB or smaller.';
        setError(message);
        throw new Error(message);
      }
      if (!isAllowedMimeType(file.type)) {
        setError(UNSUPPORTED_FILE_MESSAGE);
        throw new Error(UNSUPPORTED_FILE_MESSAGE);
      }
      setStatus('uploading');
      setError(null);
      try {
        const fileName = ensureFileName(title, file);
        const normalizedCategoryName =
          typeof categoryName === 'string' && categoryName.trim().length > 0
            ? categoryName.trim()
            : defaultCategory;
        const trimmedDescription = description.trim();
        const formData = new FormData();
        formData.append('file', file);
        formData.append('entityType', 'lease');
        formData.append('entityId', String(leaseId));
        formData.append('fileName', fileName);
        if (file.type) {
          formData.append('mimeType', file.type);
        }
        formData.append('isPrivate', 'true');
        if (normalizedCategoryName) {
          formData.append('category', normalizedCategoryName);
        }
        if (typeof buildiumCategoryId === 'number' && Number.isFinite(buildiumCategoryId)) {
          formData.append('buildiumCategoryId', String(buildiumCategoryId));
        }
        if (trimmedDescription) {
          formData.append('description', trimmedDescription);
        }

        let response: Response;
        try {
          response = await fetchWithSupabaseAuth('/api/files/upload', {
            method: 'POST',
            body: formData,
          });
        } catch (authError) {
          console.warn(
            'fetchWithSupabaseAuth failed for lease file upload; falling back.',
            authError,
          );
          response = await fetch('/api/files/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include',
          });
        }
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          const message =
            typeof details?.error === 'string' ? details.error : 'Failed to upload file';
          throw new Error(message);
        }

        const payload = await response.json().catch(() => ({}));
        const fileRow = payload?.file ?? null;
        const syncError =
          typeof payload?.buildiumSyncError === 'string' ? payload.buildiumSyncError : null;

        const record: LeaseFileRecord = {
          id: fileRow?.id || crypto.randomUUID(),
          title: fileRow?.title || fileRow?.file_name || fileName,
          uploadedAt: fileRow?.created_at || new Date().toISOString(),
          uploadedBy: normalizeUploader(fileRow?.created_by),
          buildiumFileId:
            typeof payload?.buildiumFileId === 'number'
              ? payload.buildiumFileId
              : typeof fileRow?.buildium_file_id === 'number'
                ? fileRow.buildium_file_id
                : null,
          buildiumHref:
            typeof payload?.buildiumFile?.Href === 'string'
              ? payload.buildiumFile.Href
              : typeof fileRow?.buildium_href === 'string'
                ? fileRow.buildium_href
                : null,
          category: normalizedCategoryName,
          description:
            typeof fileRow?.description === 'string'
              ? fileRow.description
              : trimmedDescription || null,
          isPrivate: Boolean(fileRow?.is_private ?? true),
        };

        setFiles((prev) => {
          const next = [record, ...prev.filter((existing) => existing.id !== record.id)];
          return sortRecords(next);
        });
        if (syncError) {
          setStatus('error');
          setError(`Saved locally. Buildium sync failed: ${syncError}`);
          throw new Error(`Saved locally. Buildium sync failed: ${syncError}`);
        }
        setStatus('idle');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to upload file';
        setStatus('error');
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [leaseId, defaultCategory],
  );

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== id));
  };

  const resyncFile = useCallback(
    async (file: LeaseFileRecord) => {
      if (!file?.id) return;
      if (!isBuildiumLinked) {
        setError('This lease is not linked to Buildium yet.');
        return;
      }
      setSyncingFileId(file.id);
      setError(null);
      try {
        const response = await fetchWithSupabaseAuth(
          `/api/leases/${leaseId}/documents/${file.id}/sync`,
          {
            method: 'POST',
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          const message =
            typeof payload?.error === 'string' ? payload.error : 'Failed to sync file to Buildium';
          throw new Error(message);
        }
        if (payload?.skipped) {
          const reason =
            typeof payload.reason === 'string'
              ? payload.reason
              : 'Lease is not linked to Buildium yet.';
          setError(reason);
          return;
        }
        const fileRow = payload?.file ?? null;
        const buildiumFileId =
          typeof payload?.buildiumFileId === 'number'
            ? payload.buildiumFileId
            : typeof fileRow?.buildium_file_id === 'number'
              ? fileRow.buildium_file_id
              : null;
        const buildiumHref =
          typeof payload?.buildiumFile?.Href === 'string'
            ? payload.buildiumFile.Href
            : typeof fileRow?.buildium_href === 'string'
              ? fileRow.buildium_href
              : file.buildiumHref;

        setFiles((prev) =>
          prev.map((record) =>
            record.id === file.id
              ? {
                  ...record,
                  buildiumFileId,
                  buildiumHref,
                  uploadedBy: normalizeUploader(fileRow?.created_by) ?? record.uploadedBy,
                  uploadedAt: fileRow?.created_at || record.uploadedAt,
                }
              : record,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to sync file to Buildium';
        setError(message);
      } finally {
        setSyncingFileId(null);
      }
    },
    [isBuildiumLinked, leaseId],
  );

  return (
    <div className="space-y-4">
      <div className="border-border bg-background rounded-lg border shadow-sm">
        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-foreground text-sm font-semibold">Files</h2>
            <p className="text-muted-foreground text-xs">
              Upload lease documents to keep records in sync with Buildium.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={() => {
                setError(null);
                setDialogOpen(true);
              }}
              disabled={status === 'uploading'}
            >
              {status === 'uploading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…
                </>
              ) : (
                'Add file'
              )}
            </Button>
          </div>
        </div>
        <div className="border-border text-muted-foreground border-t px-4 py-2 text-xs">
          {matchesLabel}
        </div>
        {error ? (
          <div className="border-border bg-destructive/10 text-destructive border-t px-4 py-2 text-xs">
            {error}
          </div>
        ) : null}
        {files.length === 0 ? (
          <div className="text-muted-foreground px-4 py-6 text-sm">
            No documents yet. Upload your first file.
          </div>
        ) : (
          <div className="border-border border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="space-y-1">
                      <div className="text-foreground font-medium">{file.title}</div>
                      {file.description ? (
                        <div className="text-muted-foreground text-xs">{file.description}</div>
                      ) : null}
                      {file.buildiumFileId ? (
                        <div className="text-muted-foreground text-xs">
                          Buildium ID: {file.buildiumFileId}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {file.isPrivate ? 'Private' : 'Shared'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {file.category || defaultCategory}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <div>{formatDateTime(file.uploadedAt)}</div>
                      {file.uploadedBy ? <div className="text-xs">by {file.uploadedBy}</div> : null}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <ActionButton aria-label="File actions" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => {
                              setFileBeingEdited(file);
                              setEditDialogOpen(true);
                            }}
                          >
                            Edit details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="mr-2 h-4 w-4" /> Download
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" /> Email
                          </DropdownMenuItem>
                          {isBuildiumLinked ? (
                            <DropdownMenuItem
                              onClick={() => resyncFile(file)}
                              disabled={status === 'uploading' || syncingFileId === file.id}
                            >
                              {syncingFileId === file.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCcw className="mr-2 h-4 w-4" />
                              )}
                              Resync to Buildium
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleRemove(file.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <LeaseFileUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isBuildiumLinked={isBuildiumLinked}
        onSubmit={uploadFile}
        isSaving={status === 'uploading'}
        error={error && status === 'error' ? error : null}
        categoryOptions={categoryOptionRecords}
      />
      <LeaseFileEditDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setFileBeingEdited(null);
          }
          setEditDialogOpen(open);
        }}
        file={fileBeingEdited}
        categoryOptions={categoryOptionRecords}
        onFileUpdated={(updated) => {
          setFiles((prev) =>
            sortRecords(
              prev.map((record) => (record.id === updated.id ? { ...record, ...updated } : record)),
            ),
          );
        }}
      />
    </div>
  );
}
function normalizeUploader(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'team member') return null;
  return trimmed;
}

interface LeaseFileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: LeaseFileRecord | null;
  categoryOptions: LeaseFileCategoryOption[];
  onFileUpdated: (file: LeaseFileRecord) => void;
}

function LeaseFileEditDialog({
  open,
  onOpenChange,
  file,
  categoryOptions,
  onFileUpdated,
}: LeaseFileEditDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryName, setCategoryName] = useState<string>('');
  const [shareWithTenants, setShareWithTenants] = useState<boolean>(false);
  const [shareWithRentalOwners, setShareWithRentalOwners] = useState<boolean>(false);
  const [initialShareWithTenants, setInitialShareWithTenants] = useState<boolean | null>(null);
  const [initialShareWithRentalOwners, setInitialShareWithRentalOwners] = useState<boolean | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);

  const buildiumFileId = file?.buildiumFileId ?? null;
  const hasBuildiumFile = typeof buildiumFileId === 'number' && buildiumFileId > 0;

  useEffect(() => {
    if (open && file) {
      setTitle(file.title);
      setDescription(file.description ?? '');
      setCategoryName(file.category ?? categoryOptions[0]?.name ?? 'Lease');
      setShareWithTenants(Boolean(file.shareWithTenants));
      setShareWithRentalOwners(Boolean(file.shareWithRentalOwners));
      setInitialShareWithTenants(file.shareWithTenants ?? null);
      setInitialShareWithRentalOwners(file.shareWithRentalOwners ?? null);
      setError(null);
      setShareError(null);
    }
  }, [open, file, categoryOptions]);

  useEffect(() => {
    if (!open || !hasBuildiumFile || !buildiumFileId) return;
    let cancelled = false;
    setShareLoading(true);
    fetch(`/api/buildium/files/${buildiumFileId}/sharesettings`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch sharing settings');
        }
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const data = payload?.data ?? payload ?? {};
        const leaseSettings = data?.Lease ?? {};
        const tenants = Boolean(
          leaseSettings.Tenants ?? data?.Tenant?.Tenants ?? data?.Rental?.Tenants,
        );
        const owners = Boolean(
          leaseSettings.RentalOwners ??
            data?.Rental?.RentalOwners ??
            data?.Tenant?.RentalOwners ??
            data?.RentalOwner?.RentalOwner,
        );
        setShareWithTenants(tenants);
        setShareWithRentalOwners(owners);
        setInitialShareWithTenants(tenants);
        setInitialShareWithRentalOwners(owners);
      })
      .catch((err) => {
        if (cancelled) return;
        setShareError(err instanceof Error ? err.message : 'Failed to load sharing settings');
      })
      .finally(() => {
        if (!cancelled) setShareLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, buildiumFileId, hasBuildiumFile]);

  const resetAndClose = () => {
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!file) return;
    try {
      setLoading(true);
      setError(null);
      const selectedCategory = categoryOptions.find((option) => option.name === categoryName);
      const payload: UpdateFilePayload = {};
      if (title.trim() && title.trim() !== file.title) payload.title = title.trim();
      const trimmedDescription = description.trim();
      if ((file.description ?? '') !== trimmedDescription) {
        payload.description = trimmedDescription ? trimmedDescription : null;
      }
      if (selectedCategory?.buildiumCategoryId !== undefined) {
        const prevCategoryId = file.category
          ? (categoryOptions.find((option) => option.name === file.category)?.buildiumCategoryId ??
            null)
          : null;
        if (selectedCategory.buildiumCategoryId !== prevCategoryId) {
          payload.categoryId = selectedCategory.buildiumCategoryId;
        }
      }
      if (hasBuildiumFile && initialShareWithTenants !== null) {
        if (shareWithTenants !== initialShareWithTenants) {
          payload.shareWithTenants = shareWithTenants;
        }
      }
      if (hasBuildiumFile && initialShareWithRentalOwners !== null) {
        if (shareWithRentalOwners !== initialShareWithRentalOwners) {
          payload.shareWithRentalOwners = shareWithRentalOwners;
        }
      }

      if (Object.keys(payload).length === 0) {
        setLoading(false);
        resetAndClose();
        return;
      }

      const response = await fetch(`/api/files/${file.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const details = await response.json().catch(() => ({}));
        const message =
          typeof details?.error === 'string' ? details.error : 'Failed to update file details';
        throw new Error(message);
      }

      const updatedCategoryName =
        payload.categoryId !== undefined ? (selectedCategory?.name ?? null) : file.category;

      const resolvedShareWithTenants =
        typeof payload.shareWithTenants === 'boolean'
          ? payload.shareWithTenants
          : shareWithTenants;
      const resolvedShareWithRentalOwners =
        typeof payload.shareWithRentalOwners === 'boolean'
          ? payload.shareWithRentalOwners
          : shareWithRentalOwners;

      onFileUpdated({
        ...file,
        title: payload.title ? String(payload.title) : file.title,
        description:
          payload.description !== undefined
            ? ((payload.description as string | null) ?? null)
            : file.description,
        category:
          updatedCategoryName ??
          file.category ??
          (categoryOptions.length ? categoryOptions[0].name : 'Lease'),
        shareWithTenants: resolvedShareWithTenants,
        shareWithRentalOwners: resolvedShareWithRentalOwners,
      });

      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update file details');
    } finally {
      setLoading(false);
    }
  };

  const disableSharingControls = !hasBuildiumFile || shareLoading;

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : resetAndClose())}>
      <DialogContent className="top-[35%] w-[680px] max-w-[680px] translate-y-[-35%]">
        <DialogHeader>
          <DialogTitle>Edit file details</DialogTitle>
          <DialogDescription>
            Update the metadata for this file and manage Buildium sharing preferences.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3 py-2 text-sm">
            {error}
          </div>
        ) : null}
        {shareError ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-100/40 px-3 py-2 text-xs text-amber-700">
            {shareError}
          </div>
        ) : null}
        <div className="space-y-4">
          <div className="grid gap-4">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Title</span>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Description</span>
              <Input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add an optional description"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Category</span>
              <select
                value={categoryName}
                onChange={(event) => setCategoryName(event.target.value)}
                className="border-input bg-background focus-visible:ring-primary w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                {categoryOptions.map((option) => (
                  <option key={option.name} value={option.name}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="rounded-lg border p-4">
            <div className="mb-3">
              <h3 className="text-foreground text-sm font-medium">Buildium sharing</h3>
              <p className="text-muted-foreground text-xs">
                Enable sharing with portals. Requires this file to be synced to Buildium.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-foreground text-sm font-medium">
                    Share with rental owners
                  </div>
                  <div className="text-muted-foreground text-xs">
                    Allow owners to view this file in their Buildium portal.
                  </div>
                </div>
                <Switch
                  disabled={disableSharingControls}
                  checked={shareWithRentalOwners}
                  onCheckedChange={(value) => setShareWithRentalOwners(Boolean(value))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-foreground text-sm font-medium">Share with tenants</div>
                  <div className="text-muted-foreground text-xs">
                    Allow tenants on this lease to view the file in the Resident Center.
                  </div>
                </div>
                <Switch
                  disabled={disableSharingControls}
                  checked={shareWithTenants}
                  onCheckedChange={(value) => setShareWithTenants(Boolean(value))}
                />
              </div>
            </div>
            {!hasBuildiumFile ? (
              <p className="text-muted-foreground mt-3 text-xs">
                Sharing controls are available after this file is synced to Buildium.
              </p>
            ) : null}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="cancel" onClick={resetAndClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
