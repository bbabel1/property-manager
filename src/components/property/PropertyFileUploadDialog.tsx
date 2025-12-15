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

export type PropertyFileRow = {
  id: string;
  title: string;
  category: string;
  description: string | null;
  uploadedAt: Date;
  uploadedBy: string;
};

export default function PropertyFileUploadDialog({
  open,
  onOpenChange,
  uploaderName = 'Team member',
  onSaved,
  propertyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploaderName?: string | null;
  onSaved?: (row: PropertyFileRow) => void;
  propertyId: string;
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

  const save = async () => {
    if (!selectedFile) return;
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
      formData.append('entityType', 'property');
      formData.append('entityId', propertyId);
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

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload?.error) {
        throw new Error(payload?.error || 'Failed to upload file');
      }

      onSaved?.({
        id:
          payload?.data?.id ||
          (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}`),
        title: trimmedTitle,
        category: category.trim() || 'Uncategorized',
        description: description.trim() || null,
        uploadedAt: new Date(),
        uploadedBy: uploaderName || 'Team member',
      });
      close();
    } catch (err: any) {
      setError(err?.message || 'Failed to upload file');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className="top-[35%] w-[680px] max-w-[680px] translate-y-[-35%]">
        <DialogHeader>
          <DialogTitle>Upload property file</DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Choose a file to upload to this property record.'
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
                    id="property-file-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="col-span-3">
                  <select
                    id="property-file-category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
                  >
                    <option value="Uncategorized">Uncategorized</option>
                    <option value="Lease">Lease</option>
                    <option value="Statement">Statement</option>
                    <option value="Maintenance">Maintenance</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="col-span-5">
                  <Input
                    id="property-file-description"
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
