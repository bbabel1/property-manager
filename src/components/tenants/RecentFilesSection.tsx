"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import TenantFileUploadDialog, { TenantFileRow } from '@/components/tenants/TenantFileUploadDialog';
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

  const emptyCopy = useMemo(() => {
    if (!orgId) return 'Files require an organization context.';
    if (!buildiumTenantId) return 'Files require a Buildium tenant id.';
    return "You don't have any files for this tenant right now.";
  }, [buildiumTenantId, orgId]);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-foreground">Recent files</h2>
          <Button
            variant="link"
            className="h-auto px-2 py-0"
            onClick={() => setIsOpen(true)}
            disabled={!tenantId}
          >
            Add
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-background shadow-sm">
          {loading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Loading files…
            </div>
          ) : files.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">
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
                </div>
              ))}
            </div>
          )}
          {error ? <div className="text-destructive px-4 py-2 text-sm">{error}</div> : null}
        </div>
      </div>

      <TenantFileUploadDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        tenantId={tenantId}
        uploaderName={uploaderName || undefined}
        onSaved={loadFiles}
      />
    </>
  );
}
