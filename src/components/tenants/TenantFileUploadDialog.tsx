'use client';

import { useCallback, useRef, useState } from 'react';
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
import { CheckCircle2 } from 'lucide-react';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';

export type TenantFileRow = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  uploadedAt: Date;
  uploadedBy: string;
  href?: string | null;
};

export default function TenantFileUploadDialog({
  open,
  onOpenChange,
  tenantId,
  uploaderName = 'Team member',
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string | null;
  uploaderName?: string | null;
  onSaved?: (row: TenantFileRow) => void;
}) {
  const [step, setStep] = useState<'select' | 'details'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Uncategorized');
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setStep('select');
    setSelectedFile(null);
    setTitle('');
    setCategory('Uncategorized');
    setDescription('');
    setSaving(false);
    setError(null);
  }, []);

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
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
  };

  const onDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  };

  const resolveHref = (file: Record<string, unknown> | null | undefined): string | null => {
    if (!file) return null;
    const buildiumHref =
      typeof file?.['buildium_href'] === 'string' ? (file['buildium_href'] as string) : null;
    if (buildiumHref && buildiumHref.trim()) return buildiumHref.trim();

    const externalUrl =
      typeof file?.['external_url'] === 'string' ? (file['external_url'] as string) : null;
    if (externalUrl && externalUrl.trim()) return externalUrl.trim();

    const bucket =
      typeof file?.['bucket'] === 'string' && file['bucket'] ? (file['bucket'] as string) : null;
    const storageKey =
      typeof file?.['storage_key'] === 'string' && file['storage_key']
        ? (file['storage_key'] as string)
        : null;
    if (bucket && storageKey && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
      return `${base}/storage/v1/object/${bucket}/${storageKey}`;
    }

    return null;
  };

  const save = async () => {
    if (!selectedFile) return;
    if (!tenantId) {
      setError('Tenant id is required to upload a file.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const trimmedTitle = title.trim() || selectedFile.name;
      let fileName = trimmedTitle;
      if (!fileName.includes('.') && selectedFile.name.includes('.')) {
        const ext = selectedFile.name.split('.').pop();
        if (ext) fileName = `${fileName}.${ext}`;
      }

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('entityType', 'tenant');
      formData.append('entityId', tenantId);
      formData.append('fileName', fileName);
      if (selectedFile.type) formData.append('mimeType', selectedFile.type);
      formData.append('isPrivate', 'true');
      if (description.trim()) formData.append('description', description.trim());
      if (category.trim()) formData.append('category', category.trim());

      let response: Response;
      try {
        response = await fetchWithSupabaseAuth('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
      } catch {
        response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
      }

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok || (payload && typeof payload?.['error'] === 'string')) {
        throw new Error(
          (payload?.['error'] as string | undefined) || 'Failed to upload tenant file',
        );
      }

      const fileRecord =
        (payload?.['file'] as Record<string, unknown> | undefined) ??
        (payload?.['data'] as Record<string, unknown> | undefined) ??
        null;

      const row: TenantFileRow = {
        id:
          (fileRecord?.['id'] as string | undefined) ||
          (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}`),
        title:
          (fileRecord?.['title'] as string | undefined) ||
          (fileRecord?.['file_name'] as string | undefined) ||
          trimmedTitle,
        category:
          (fileRecord?.['category_name'] as string | undefined) || category.trim() || 'Uncategorized',
        description:
          (fileRecord?.['description'] as string | null | undefined) ??
          (description.trim() || null),
        uploadedAt: new Date(
          (fileRecord?.['created_at'] as string | undefined) || new Date().toISOString(),
        ),
        uploadedBy:
          (fileRecord?.['created_by'] as string | undefined) || uploaderName || 'Team member',
        href: resolveHref(fileRecord),
      };

      onSaved?.(row);
      close();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to upload tenant file';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className="top-[35%] w-[680px] max-w-[680px] translate-y-[-35%]">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Choose a file to upload to this tenant record.'
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
                  <CheckCircle2 className="h-5 w-5 text-[var(--color-action-600)]" />
                  <Input
                    id="tenant-file-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="col-span-3">
                  <select
                    id="tenant-file-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="border-input bg-background focus-visible:ring-primary w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <option value="Uncategorized">Uncategorized</option>
                    <option value="Lease">Lease</option>
                    <option value="Statement">Statement</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="col-span-5">
                  <Input
                    id="tenant-file-description"
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
              <Button type="button" onClick={save} disabled={saving}>
                Save
              </Button>
              <Button type="button" variant="secondary" onClick={save} disabled={saving}>
                Save and share
              </Button>
              <Button type="button" variant="cancel" onClick={close} disabled={saving}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" variant="cancel" onClick={close}>
              Cancel
            </Button>
          )}
        </DialogFooter>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
