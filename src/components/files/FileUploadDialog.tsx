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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CheckCircle2, Upload } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: () => void;
  categoryOptions: { id: string; name: string; buildiumCategoryId?: number | null }[];
}

type EntityType = 'property' | 'unit' | 'lease' | 'tenant' | 'owner' | 'vendor';

const ENTITY_TYPE_OPTIONS: { value: EntityType; label: string }[] = [
  { value: 'property', label: 'Property' },
  { value: 'unit', label: 'Unit' },
  { value: 'lease', label: 'Lease' },
  { value: 'tenant', label: 'Tenant' },
  { value: 'owner', label: 'Owner' },
  { value: 'vendor', label: 'Vendor' },
];

const UNCATEGORIZED_OPTION_VALUE = '__uncategorized__';

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

export default function FileUploadDialog({
  open,
  onOpenChange,
  onUploaded,
  categoryOptions,
}: FileUploadDialogProps) {
  const [step, setStep] = useState<'select' | 'details'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState<EntityType | ''>('');
  const [entityId, setEntityId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [unitPropertyId, setUnitPropertyId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset linked selection when type changes
  useEffect(() => {
    if (!open) {
      return;
    }
    setEntityId('');
    if (entityType !== 'unit') {
      setUnitPropertyId('');
    }
  }, [entityType, open]);

  const resetState = useCallback(() => {
    setStep('select');
    setSelectedFile(null);
    setTitle('');
    setDescription('');
    setEntityType('');
    setEntityId('');
    setCategoryId('');
    setUnitPropertyId('');
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

    // Check file size (25 MB limit)
    if (file.size > 25 * 1024 * 1024) {
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
    setTitle(file.name.replace(/\.[^/.]+$/, '')); // Remove extension for title
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
    if (!selectedFile || isSaving || !entityType || !entityId) return;
    if (entityType === 'unit' && !unitPropertyId) {
      setError('Select a property before choosing a unit.');
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
      formData.append('entityType', entityType);
      formData.append('entityId', entityId);
      formData.append('fileName', fileName);
      if (selectedFile.type) {
        formData.append('mimeType', selectedFile.type);
      }
      formData.append('isPrivate', 'true');
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      if (categoryId) {
        const buildiumCategoryId =
          categoryOptions.find((c) => c.id === categoryId)?.buildiumCategoryId ?? null;
        if (buildiumCategoryId != null) {
          formData.append('buildiumCategoryId', String(buildiumCategoryId));
        }
      }

      let response: Response;
      try {
        response = await fetchWithSupabaseAuth('/api/files/upload', {
          method: 'POST',
          body: formData,
        });
      } catch (authError) {
        console.warn('fetchWithSupabaseAuth failed for file upload, falling back:', authError);
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

      if (payload?.error) {
        throw new Error(payload.error);
      }

      onUploaded?.();
      close();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const unitSelectionValid = entityType !== 'unit' || (unitPropertyId && entityId);
  const canSave = Boolean(
    selectedFile && entityType && entityId && unitSelectionValid && !isSaving,
  );
  const isUnitLink = entityType === 'unit';
  const entityLabel = ENTITY_TYPE_OPTIONS.find((e) => e.value === entityType)?.label || 'Entity';
  

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? onOpenChange(true) : close())}>
      <DialogContent className="max-w-3xl sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Upload File</DialogTitle>
          <DialogDescription>
            {step === 'select'
              ? 'Choose a file to upload. You can link it to a property, unit, lease, tenant, owner, or vendor.'
              : 'Review file details and select where to link this file.'}
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
                <Upload className="mx-auto mb-2 h-8 w-8" />
                <div>
                  Drag &amp; drop files here or{' '}
                  <span className="text-primary underline">Browse</span>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={onFileInputChange}
              />
            </label>
            <div className="text-muted-foreground text-xs">
              Supported formats: PDF, images, documents. Maximum size 25 MB.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-md border">
              <div className="bg-muted/60 text-muted-foreground grid grid-cols-12 text-xs font-semibold tracking-wide uppercase">
                <div className="col-span-12 px-4 py-2">File Information</div>
              </div>
              <div className="bg-background space-y-4 border-t p-4">
                {/* File Preview */}
                <div className="flex items-center gap-3 rounded-md border p-3">
                  <CheckCircle2 className="h-5 w-5 text-[var(--color-action-600)]" />
                  <div className="flex-1">
                    <div className="font-medium">{selectedFile?.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {(selectedFile?.size || 0) / 1024} KB
                    </div>
                  </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label htmlFor="file-title">Title *</Label>
                  <Input
                    id="file-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="File title"
                    autoFocus
                  />
                </div>

                {/* Entity Type */}
                <div className="space-y-2">
                  <Label htmlFor="entity-type">Link to *</Label>
                  <Select value={entityType} onValueChange={(v) => setEntityType(v as EntityType)}>
                    <SelectTrigger id="entity-type">
                      <SelectValue placeholder="Select entity type" />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITY_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Property selector for unit linking */}
                {isUnitLink && (
                  <EntityPicker
                    label="Property *"
                    entityType="property"
                    value={unitPropertyId}
                    onChange={(next) => {
                      setUnitPropertyId(next);
                      setEntityId('');
                    }}
                    disabled={isSaving}
                    placeholder="Search properties..."
                    data-testid="upload-property-picker"
                  />
                )}

                {/* Entity Selection */}
                {entityType && (
                  <EntityPicker
                    label={`${entityLabel} *`}
                    entityType={isUnitLink ? 'unit' : entityType}
                    value={entityId}
                    onChange={setEntityId}
                    disabled={isSaving || (isUnitLink && !unitPropertyId)}
                    parentId={isUnitLink ? unitPropertyId : undefined}
                    placeholder={
                      isUnitLink && !unitPropertyId
                        ? 'Select property first'
                        : `Search ${entityLabel.toLowerCase()}s...`
                    }
                    data-testid="upload-entity-picker"
                  />
                )}

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={categoryId || UNCATEGORIZED_OPTION_VALUE}
                    onValueChange={(value) =>
                      setCategoryId(value === UNCATEGORIZED_OPTION_VALUE ? '' : value)
                    }
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Uncategorized (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNCATEGORIZED_OPTION_VALUE}>Uncategorized</SelectItem>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
        )}

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {step === 'details' ? (
            <>
              <Button type="button" onClick={save} disabled={!canSave}>
                {isSaving ? 'Uploading…' : 'Upload File'}
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
