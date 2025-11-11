import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';
import { toast } from 'sonner';
import { cn } from '@/components/ui/utils';

export interface BulkActionsBarProps {
  selectedFiles: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  onRefresh?: () => void | Promise<void>;
  variant?: 'floating' | 'inline';
  className?: string;
}

export function BulkActionsBar({
  selectedFiles,
  onSelectionChange,
  onRefresh,
  variant = 'floating',
  className,
}: BulkActionsBarProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleBulkDelete = async () => {
    if (selectedFiles.size === 0 || isDeleting) return;
    const confirmed = window.confirm(`Delete ${selectedFiles.size} selected file(s)?`);
    if (!confirmed) return;

    setIsDeleting(true);
    const fileIds = Array.from(selectedFiles);
    const failed: string[] = [];
    const succeeded: string[] = [];

    for (const fileId of fileIds) {
      try {
        const response = await fetchWithSupabaseAuth(`/api/files/${fileId}`, { method: 'DELETE' });
        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(typeof details?.error === 'string' ? details.error : 'Failed to delete file');
        }
        succeeded.push(fileId);
      } catch (error) {
        failed.push(fileId);
        console.error('Failed to delete file', { fileId, error });
      }
    }

    if (succeeded.length > 0) {
      if (typeof onRefresh === 'function') {
        try {
          await onRefresh();
        } catch (refreshError) {
          console.error('Failed to refresh files after delete', refreshError);
        }
      }
      const message =
        succeeded.length === 1
          ? 'Deleted 1 file.'
          : `Deleted ${succeeded.length} files.`;
      toast.success(message);
    }

    if (failed.length > 0) {
      const message =
        failed.length === 1
          ? '1 file could not be deleted. Please retry.'
          : `${failed.length} files could not be deleted. Please retry.`;
      toast.error(message);
      onSelectionChange(new Set(failed));
    } else {
      onSelectionChange(new Set());
    }

    setIsDeleting(false);
  };

  if (selectedFiles.size === 0) {
    return null;
  }

  const containerClass =
    variant === 'inline'
      ? 'bg-primary/[0.08] border-primary/15 flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6'
      : 'bg-primary/5 border-primary/20 flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between';

  return (
    <div
      className={cn(containerClass, className)}
      role="region"
      aria-label="Bulk actions"
    >
      <div className="text-primary text-sm font-medium">
        {selectedFiles.size} {selectedFiles.size === 1 ? 'file' : 'files'} selected
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleBulkDelete} disabled={isDeleting}>
          <Trash2 className="mr-2 h-4 w-4" />
          {isDeleting ? 'Deleting…' : 'Delete Selected'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onSelectionChange(new Set())}
          disabled={isDeleting}
        >
          Clear Selection
        </Button>
      </div>
    </div>
  );
}

export default BulkActionsBar;
