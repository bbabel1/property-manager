'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ActionButton from '@/components/ui/ActionButton';
import TenantFileUploadDialog from '@/components/tenants/TenantFileUploadDialog';
import type { TenantFileRow, TenantFileUploadDialogProps } from './tenant-file-types';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';

type ListedFile = TenantFileRow & { href: string | null };
type FileApiRow = {
  id?: string | number;
  title?: string | null;
  file_name?: string | null;
  category_name?: string | null;
  description?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  buildium_href?: string | null;
  external_url?: string | null;
  bucket?: string | null;
  storage_key?: string | null;
};

export default function RecentFilesSection({
  tenantId,
  buildiumTenantId,
  orgId,
  uploaderName,
}: {
  tenantId: string | null;
  buildiumTenantId: number | null;
  orgId: string | null;
  uploaderName?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [files, setFiles] = useState<ListedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileToDelete, setFileToDelete] = useState<ListedFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const resolveHref = useCallback((file: FileApiRow): string | null => {
    if (typeof file?.buildium_href === 'string' && file.buildium_href.trim()) {
      return file.buildium_href;
    }
    if (typeof file?.external_url === 'string' && file.external_url.trim()) {
      return file.external_url;
    }
    if (file?.bucket && file?.storage_key && process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
      return `${base}/storage/v1/object/${file.bucket}/${file.storage_key}`;
    }
    return null;
  }, []);

  const loadFiles = useCallback(async () => {
    if (!orgId || !buildiumTenantId) {
      setFiles([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const url = `/api/files?entityType=Tenants&entityId=${buildiumTenantId}&orgId=${orgId}`;
      let res: Response;
      try {
        res = await fetchWithSupabaseAuth(url, { cache: 'no-store' });
      } catch {
        res = await fetch(url, { cache: 'no-store', credentials: 'include' });
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error) {
        throw new Error(json?.error || 'Failed to load files');
      }
      const rows: FileApiRow[] = Array.isArray(json?.data) ? json.data : [];
      const mapped: ListedFile[] = rows.slice(0, 5).map((file) => ({
        id: String(file.id),
        title: file.title || file.file_name || 'File',
        category: file.category_name || 'Uncategorized',
        description: file.description || null,
        uploadedAt: new Date(file.created_at || Date.now()),
        uploadedBy: file.created_by || '—',
        href: resolveHref(file),
      }));
      setFiles(mapped);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load files';
      setError(message);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [buildiumTenantId, orgId, resolveHref]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleDelete = useCallback(async () => {
    const file = fileToDelete;
    if (!file) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete file');
      }

      toast.success('File deleted successfully');
      setFileToDelete(null);
      void loadFiles();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete file';
      toast.error(message);
      console.error('Error deleting file:', err);
    } finally {
      setIsDeleting(false);
    }
  }, [fileToDelete, loadFiles]);

  const emptyCopy = useMemo(() => {
    if (!orgId) return 'Files require an organization context.';
    if (!buildiumTenantId) return 'Files require a Buildium tenant id.';
    return "You don't have any files for this tenant right now.";
  }, [buildiumTenantId, orgId]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-foreground text-lg font-semibold">Recent files</h2>
          <Button
            variant="link"
            className="h-auto px-2 py-0"
            onClick={() => setIsOpen(true)}
            disabled={!tenantId}
          >
            Add
          </Button>
        </div>
        <div className="border-border bg-background rounded-lg border shadow-sm">
          {loading ? (
            <div className="text-muted-foreground px-4 py-6 text-center text-sm">
              Loading files…
            </div>
          ) : files.length === 0 ? (
            <div className="text-muted-foreground px-4 py-6 text-sm">
              {emptyCopy}{' '}
              <Button
                variant="link"
                className="h-auto px-1 py-0"
                onClick={() => setIsOpen(true)}
                disabled={!tenantId}
              >
                Upload your first file.
              </Button>
            </div>
          ) : (
            <div className="divide-card divide-y">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1 space-y-1">
                    <div className="text-foreground text-sm font-semibold">{file.title}</div>
                    <div className="text-muted-foreground text-sm">
                      {file.category} · Uploaded {file.uploadedAt.toLocaleDateString()} by{' '}
                      {file.uploadedBy}
                    </div>
                    {file.description ? (
                      <div className="text-muted-foreground text-sm">{file.description}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {file.href ? (
                      <Button asChild variant="outline" className="min-h-[2.75rem] px-4">
                        <a href={file.href} target="_blank" rel="noreferrer">
                          Download
                        </a>
                      </Button>
                    ) : (
                      <Button variant="outline" className="min-h-[2.75rem] px-4" disabled>
                        No download link
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <ActionButton aria-label="File actions" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={(e) => {
                            e.preventDefault();
                            setFileToDelete(file);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
          {error ? <div className="text-destructive px-4 py-2 text-sm">{error}</div> : null}
        </div>
      </div>

      <TenantFileUploadDialog
        {...({
          open: isOpen,
          onOpenChange: setIsOpen,
          tenantId,
          uploaderName: uploaderName || undefined,
          onSaved: loadFiles,
        } satisfies TenantFileUploadDialogProps)}
      />

      <AlertDialog
        open={!!fileToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setFileToDelete(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete the file &quot;{fileToDelete?.title}&quot;. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void handleDelete();
              }}
            >
              {isDeleting ? 'Deleting…' : 'Delete file'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
