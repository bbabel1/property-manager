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
import type { BillFileRecord } from './types';

type BillFileUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billId: string;
  uploaderName?: string | null;
  onSaved?: (row: BillFileRecord) => void;
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

export default function BillFileUploadDialog({
  open,
  onOpenChange,
  billId,
  uploaderName = 'Team member',
  onSaved,
}: BillFileUploadDialogProps) {
  const [step, setStep] = useState<'select' | 'details'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const resetState = useCallback(() => {
    setStep('select');
    setSelectedFile(null);
    setTitle('');
    setError(null);
    setIsSaving(false);
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

  const save = async () => {
    if (!selectedFile || isSaving) return;

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

      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('entityType', 'bill');
      formData.append('entityId', billId);
      formData.append('fileName', fileName);
      if (selectedFile.type) {
        formData.append('mimeType', selectedFile.type);
      }
      formData.append('isPrivate', 'true');

      let response: Response;
      try {
        response = await fetchWithSupabaseAuth('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
      } catch (authError) {
        console.warn('fetchWithSupabaseAuth failed for bill file upload; falling back.', authError);
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
      const file = payload?.file ?? null;
      const link = payload?.link ?? null;
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

      const uploadedAt: string =
        typeof link?.added_at === 'string'
          ? link.added_at
          : typeof file?.created_at === 'string'
            ? file.created_at
            : new Date().toISOString();

      const uploadedBy =
        (typeof link?.added_by === 'string' && link.added_by.length ? link.added_by : null) ??
        uploaderName ??
        'Team member';

      const buildiumSyncError =
        typeof payload?.buildiumSyncError === 'string' && payload.buildiumSyncError.length
          ? payload.buildiumSyncError
          : null;

      const record: BillFileRecord = {
        id:
          (file?.id as string) ||
          (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}`),
        title: file?.file_name || fileName,
        uploadedAt,
        uploadedBy,
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
      <DialogContent className="top-[35%] w-[680px] max-w-[680px] translate-y-[-35%]">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Choose a file to upload to this bill record.'
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
                <div className="col-span-12 px-4 py-2">Title</div>
              </div>
              <div className="bg-background grid grid-cols-12 items-center gap-3 border-t px-3 py-3">
                <div className="col-span-12 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary-600" />
                  <Input
                    id="bill-file-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    autoFocus
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
      </DialogContent>
    </Dialog>
  );
}
