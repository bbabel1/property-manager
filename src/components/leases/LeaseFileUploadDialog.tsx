'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/ui/select';
import { CheckCircle2 } from 'lucide-react';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';

export type LeaseFileRow = {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  uploadedAt: Date;
  uploadedBy: string;
  buildiumFileId?: number | null;
  buildiumHref?: string | null;
  buildiumSyncError?: string | null;
};

type FileCategoryOption = {
  id: string;
  name: string;
  buildiumCategoryId: number | null;
};

type LeaseFileUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaseId: number | null;
  buildiumLeaseId: number | null;
  orgId: string | null;
  onSaved?: (file: LeaseFileRow) => void;
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
  'application/octet-stream',
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

const UNCATEGORIZED_OPTION: FileCategoryOption = {
  id: 'uncategorized',
  name: 'Uncategorized',
  buildiumCategoryId: null,
};

export default function LeaseFileUploadDialog({
  open,
  onOpenChange,
  leaseId,
  buildiumLeaseId: _buildiumLeaseId,
  orgId,
  onSaved,
}: LeaseFileUploadDialogProps) {
  const [step, setStep] = useState<'select' | 'details'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<FileCategoryOption[]>([UNCATEGORIZED_OPTION]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(UNCATEGORIZED_OPTION.id);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetState = useCallback(() => {
    setStep('select');
    setSelectedFile(null);
    setTitle('');
    setDescription('');
    setSelectedCategoryId(UNCATEGORIZED_OPTION.id);
    setIsSaving(false);
    setError(null);
    setCategoriesError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const close = useCallback(() => {
    onOpenChange(false);
    resetState();
  }, [onOpenChange, resetState]);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];

    if (file.size > MAX_UPLOAD_BYTES) {
      setError('File size exceeds 25 MB limit');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!isAllowedMimeType(file.type)) {
      setError(UNSUPPORTED_FILE_MESSAGE);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    setTitle(file.name);
    setStep('details');
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  const onDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  };

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true);
    setCategoriesError(null);
    try {
      const headers: HeadersInit = {};
      if (orgId) headers['x-org-id'] = orgId;

      let response: Response;
      try {
        response = await fetchWithSupabaseAuth('/api/files/categories', { headers });
      } catch (authError) {
        console.warn('fetchWithSupabaseAuth failed for lease categories; falling back.', authError);
        response = await fetch('/api/files/categories', {
          headers,
          credentials: 'include',
        });
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || 'Failed to load file categories');
      }

      const rawCategories: Array<Record<string, unknown>> = Array.isArray(payload?.data)
        ? (payload.data as Array<Record<string, unknown>>)
        : [];
      const normalized = rawCategories
        .map<FileCategoryOption>((cat) => ({
          id: String(cat.id ?? cat.name ?? ''),
          name: typeof cat.name === 'string' && cat.name.trim() ? cat.name.trim() : 'Uncategorized',
          buildiumCategoryId:
            typeof cat.buildiumCategoryId === 'number' && Number.isFinite(cat.buildiumCategoryId)
              ? cat.buildiumCategoryId
              : null,
        }))
        .filter((cat) => cat.id.trim().length > 0);

      const uniqueById = new Map<string, FileCategoryOption>();
      uniqueById.set(UNCATEGORIZED_OPTION.id, UNCATEGORIZED_OPTION);
      for (const cat of normalized) {
        if (!uniqueById.has(cat.id)) uniqueById.set(cat.id, cat);
      }
      setCategories(Array.from(uniqueById.values()));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load file categories';
      setCategoriesError(message);
      setCategories([UNCATEGORIZED_OPTION]);
      setSelectedCategoryId(UNCATEGORIZED_OPTION.id);
    } finally {
      setCategoriesLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    if (!open) return;
    void loadCategories();
  }, [open, loadCategories]);

  const save = async () => {
    if (!selectedFile || isSaving) return;
    if (leaseId == null) {
      setError('Create the lease before uploading files.');
      return;
    }

    if (selectedFile.size > MAX_UPLOAD_BYTES) {
      setError('File size exceeds 25 MB limit');
      return;
    }

    if (!isAllowedMimeType(selectedFile.type)) {
      setError(UNSUPPORTED_FILE_MESSAGE);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const trimmedTitle = title.trim() || selectedFile.name;
      let fileName = trimmedTitle;
      if (!fileName.includes('.') && selectedFile.name.includes('.')) {
        const ext = selectedFile.name.split('.').pop();
        if (ext) fileName = `${fileName}.${ext}`;
      }

      const selectedCategory =
        categories.find((cat) => cat.id === selectedCategoryId) ?? UNCATEGORIZED_OPTION;
      const categoryName = selectedCategory.name.trim();
      const buildiumCategoryId =
        typeof selectedCategory.buildiumCategoryId === 'number' &&
        Number.isFinite(selectedCategory.buildiumCategoryId)
          ? selectedCategory.buildiumCategoryId
          : null;

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('entityType', 'lease');
      formData.append('entityId', String(leaseId));
      formData.append('fileName', fileName);
      if (selectedFile.type) {
        formData.append('mimeType', selectedFile.type);
      }
      formData.append('isPrivate', 'true');
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      if (categoryName) {
        formData.append('category', categoryName);
      }
      if (buildiumCategoryId != null) {
        formData.append('buildiumCategoryId', String(buildiumCategoryId));
      }

      const headers: HeadersInit = {};
      if (orgId) headers['x-org-id'] = orgId;

      let response: Response;
      try {
        response = await fetchWithSupabaseAuth('/api/files/upload', {
          method: 'POST',
          body: formData,
          headers,
        });
      } catch (authError) {
        console.warn('fetchWithSupabaseAuth failed for lease file upload; falling back.', authError);
        response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
          headers,
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
      const file = payload?.file ?? null;
      const buildiumFileId =
        typeof payload?.buildiumFileId === 'number'
          ? payload.buildiumFileId
          : typeof file?.buildium_file_id === 'number'
            ? file.buildium_file_id
            : null;
      const buildiumHref =
        typeof payload?.buildiumFile?.Href === 'string'
          ? payload.buildiumFile.Href
          : typeof file?.buildium_href === 'string'
            ? file.buildium_href
            : null;
      const buildiumSyncError =
        typeof payload?.buildiumSyncError === 'string' && payload.buildiumSyncError.length
          ? payload.buildiumSyncError
          : null;

      const uploadedAtRaw =
        (typeof file?.created_at === 'string' && file.created_at) ||
        (typeof payload?.entityCreatedAt === 'string' && payload.entityCreatedAt) ||
        null;

      const record: LeaseFileRow = {
        id:
          (file?.id as string) ||
          (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}`),
        title: file?.file_name || trimmedTitle,
        category: categoryName || null,
        description: description.trim() || null,
        uploadedAt: uploadedAtRaw ? new Date(uploadedAtRaw) : new Date(),
        uploadedBy: 'Team member',
        buildiumFileId,
        buildiumHref,
        buildiumSyncError,
      };

      onSaved?.(record);

      if (buildiumSyncError) {
        setError(`Saved locally. Buildium sync failed: ${buildiumSyncError}`);
        return;
      }

      close();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className="top-[35%] w-[720px] max-w-[720px] translate-y-[-35%]">
        <DialogHeader>
          <DialogTitle>Upload lease file</DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Choose a file to upload to this lease.'
              : 'Review file details before saving.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="space-y-4">
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
                onChange={onFileInputChange}
                accept="application/pdf,image/*"
              />
            </label>
            <div className="text-muted-foreground text-xs">
              Supported formats include PDF and common image types. Maximum size 25 MB.
            </div>
            {categoriesError ? (
              <p className="text-destructive text-sm">Category load failed: {categoriesError}</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-md border">
              <div className="bg-muted/60 text-muted-foreground grid grid-cols-12 text-xs font-semibold tracking-wide uppercase">
                <div className="col-span-4 px-4 py-2">Title</div>
                <div className="col-span-3 px-4 py-2">Category</div>
                <div className="col-span-5 px-4 py-2">Description</div>
              </div>
              <div className="bg-background grid grid-cols-12 items-center gap-3 border-t px-3 py-3">
                <div className="col-span-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary-600" />
                  <Input
                    id="lease-file-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    autoFocus
                  />
                </div>
                <div className="col-span-3">
                  <Select
                    id="lease-file-category"
                    value={selectedCategoryId}
                    onChange={(event) => setSelectedCategoryId(event.target.value)}
                    disabled={categoriesLoading}
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </Select>
                  {categoriesLoading ? (
                    <p className="text-muted-foreground mt-1 text-xs">Loading categories…</p>
                  ) : null}
                  {categoriesError ? (
                    <p className="text-destructive mt-1 text-xs">
                      Using default category. {categoriesError}
                    </p>
                  ) : null}
                </div>
                <div className="col-span-5">
                  <Input
                    id="lease-file-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Add an optional description"
                  />
                </div>
              </div>
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {step === 'details' ? (
            <>
              <Button type="button" onClick={save} disabled={isSaving}>
                {isSaving ? 'Saving…' : 'Save'}
              </Button>
              <Button type="button" variant="ghost" onClick={close} disabled={isSaving}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" onClick={close}>
              Cancel
            </Button>
          )}
        </DialogFooter>
        {step === 'select' && error ? <p className="text-destructive text-sm">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
