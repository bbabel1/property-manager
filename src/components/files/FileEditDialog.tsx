'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Save } from 'lucide-react';

const UNCATEGORIZED_OPTION_VALUE = '__uncategorized__';

interface FileEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    id: string;
    file_name: string;
    title?: string;
    description?: string | null;
    category_name?: string;
    buildium_category_id?: number | null;
  } | null;
  categoryOptions: { id: string; name: string; buildiumCategoryId?: number | null }[];
  onSaved?: () => void;
}

export default function FileEditDialog({
  open,
  onOpenChange,
  file,
  categoryOptions,
  onSaved,
}: FileEditDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when file changes
  useEffect(() => {
    if (file) {
      setTitle(file.title || file.file_name);
      setDescription(file.description || '');

      // Find matching category by buildium_category_id or name
      if (file.buildium_category_id) {
        const matchingCategory = categoryOptions.find(
          (cat) => cat.buildiumCategoryId === file.buildium_category_id,
        );
        if (matchingCategory) {
          setCategoryId(matchingCategory.id);
        } else {
          setCategoryId('');
        }
      } else {
        setCategoryId('');
      }
      setError(null);
    }
  }, [file, categoryOptions]);

  const handleSave = async () => {
    if (!file) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || file.file_name,
          description: description.trim() || null,
          buildiumCategoryId: categoryId
            ? (categoryOptions.find((c) => c.id === categoryId)?.buildiumCategoryId ?? null)
            : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update file');
      }

      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update file');
    } finally {
      setIsSaving(false);
    }
  };

  if (!file) return null;

  const selectedCategoryValue = categoryId || UNCATEGORIZED_OPTION_VALUE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[680px] max-w-[680px]">
        <DialogHeader>
          <DialogTitle>Edit File</DialogTitle>
          <DialogDescription>Update file metadata and information</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Name (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="file-name">File Name</Label>
            <Input id="file-name" value={file.file_name} disabled className="bg-muted" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="file-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="file-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="File title"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="file-category">Category</Label>
            <Select
              value={selectedCategoryValue}
              onValueChange={(value) =>
                setCategoryId(value === UNCATEGORIZED_OPTION_VALUE ? '' : value)
              }
            >
              <SelectTrigger id="file-category">
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
            <Label htmlFor="file-description">Description</Label>
            <Textarea
              id="file-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={4}
            />
          </div>

          {error && <div className="text-destructive text-sm">{error}</div>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving || !title.trim()}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
