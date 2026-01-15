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
import { Select } from '@/ui/select';
import { CheckCircle2 } from 'lucide-react';
import { InteractiveSurface } from '@/ui/interactive-surface';

export type TransactionAttachmentDraft = {
  file: File;
  title: string;
  category: string;
  description: string;
};

type TransactionFileUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (draft: TransactionAttachmentDraft) => void;
  maxBytes?: number;
};

const DEFAULT_MAX_BYTES = 25 * 1024 * 1024;

const CATEGORY_OPTIONS = ['Uncategorized', 'Lease', 'Statement', 'Maintenance', 'Other'];

export default function TransactionFileUploadDialog({
  open,
  onOpenChange,
  onSaved,
  maxBytes = DEFAULT_MAX_BYTES,
}: TransactionFileUploadDialogProps) {
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const close = useCallback(() => {
    onOpenChange(false);
    resetState();
  }, [onOpenChange, resetState]);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || !fileList.length) return;
    const file = fileList[0];

    if (file.size > maxBytes) {
      setError(`File size exceeds ${(maxBytes / (1024 * 1024)).toFixed(0)} MB limit`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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

  const save = async () => {
    if (!selectedFile || saving) return;
    if (selectedFile.size > maxBytes) {
      setError(`File size exceeds ${(maxBytes / (1024 * 1024)).toFixed(0)} MB limit`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const trimmedTitle = title.trim() || selectedFile.name;
      onSaved?.({
        file: selectedFile,
        title: trimmedTitle,
        category: category.trim() || 'Uncategorized',
        description: description.trim(),
      });
      close();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stage file';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Upload file</DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Choose a file to attach to this transaction.'
              : 'Review file details before saving.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'select' ? (
          <div className="space-y-4">
            <InteractiveSurface
              asChild
              tabIndex={0}
              role="button"
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="border-muted-foreground/40 bg-muted/40 text-muted-foreground hover:border-primary hover:text-primary flex h-40 cursor-pointer items-center justify-center rounded-md border-2 border-dashed text-sm transition"
            >
              <label
                onDrop={onDrop}
                onDragOver={(event) => event.preventDefault()}
              >
                <div className="text-center">
                  Drag &amp; drop files here or{" "}
                  <span className="text-primary underline">Browse</span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={onFileInputChange}
                  accept="application/pdf,image/*"
                />
              </label>
            </InteractiveSurface>
            <div className="text-muted-foreground text-xs">
              Supported formats include PDF and common image types. Maximum size {(maxBytes / (1024 * 1024)).toFixed(0)} MB.
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
                  <CheckCircle2 className="h-5 w-5 text-primary-600" />
                  <Input
                    id="transaction-file-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="col-span-3">
                  <Select
                    id="transaction-file-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-5">
                  <Input
                    id="transaction-file-description"
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
