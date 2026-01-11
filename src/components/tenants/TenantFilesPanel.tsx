'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Mail, Trash2, Download, Eye } from 'lucide-react';
import ActionButton from '@/components/ui/ActionButton';
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

interface TenantFilesPanelProps {
  tenantId?: string | null;
  buildiumTenantId?: number | null;
  orgId?: string | null;
  uploaderName?: string | null;
  initialFiles?: TenantFileRow[];
}

const DEFAULT_CATEGORY = 'Uncategorized';

const formatDateTime = (date: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);

export default function TenantFilesPanel({
  tenantId: tenantIdProp,
  buildiumTenantId = null,
  orgId = null,
  uploaderName = 'Team member',
  initialFiles = [],
}: TenantFilesPanelProps) {
  const tenantId = tenantIdProp ?? null;
  const [files, setFiles] = useState<ListedFile[]>(
    (initialFiles ?? []).map((file) => ({
      ...file,
      uploadedAt: file.uploadedAt instanceof Date ? file.uploadedAt : new Date(file.uploadedAt),
      href: file.href ?? null,
    })),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchesLabel = useMemo(() => {
    const count = files.length;
    return `${count} match${count === 1 ? '' : 'es'}`;
  }, [files.length]);

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
      const mapped: ListedFile[] = rows.map((file) => ({
        id: String(file.id),
        title: file.title || file.file_name || 'File',
        category: file.category_name || DEFAULT_CATEGORY,
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

  const handleSaved = useCallback(() => {
    void loadFiles();
  }, [loadFiles]);

  const handleDownload = (file: ListedFile) => {
    if (!file.href) return;
    window.open(file.href, '_blank', 'noopener,noreferrer');
  };

  const emptyCopy = useMemo(() => {
    if (!orgId) return 'Files require an organization context.';
    if (!buildiumTenantId) return 'Files require a Buildium tenant id.';
    return "You don't have any files for this tenant right now.";
  }, [buildiumTenantId, orgId]);

  return (
    <div className="space-y-4">
      <div className="border-border bg-background rounded-lg border shadow-sm">
        <div className="border-border flex flex-col gap-4 border-b px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
            <select
              className="border-input bg-background focus-visible:ring-primary h-9 rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Filter by category"
            >
              <option>All categories</option>
            </select>
            <button type="button" className="text-primary hover:underline">
              Add filter option
            </button>
          </div>
          <div className="flex items-center gap-3">
            <Button type="button" onClick={() => setIsOpen(true)} disabled={!tenantId}>
              Upload file
            </Button>
            <Button variant="outline" type="button">
              Manage categories
            </Button>
          </div>
        </div>
        <div className="text-muted-foreground px-4 py-3 text-xs">{matchesLabel}</div>

        {loading ? (
          <div className="border-border text-muted-foreground border-t px-4 py-6 text-center text-sm">
            Loading files…
          </div>
        ) : files.length === 0 ? (
          <div className="border-border text-muted-foreground border-t px-4 py-6 text-sm">
            {emptyCopy}{' '}
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="text-primary align-baseline text-sm font-normal hover:underline"
              disabled={!tenantId}
            >
              Upload your first file.
            </button>
          </div>
        ) : (
          <div className="border-border border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Sharing</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <input type="checkbox" aria-label="Select file" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="border-muted-foreground/40 bg-muted/40 text-muted-foreground flex h-10 w-10 items-center justify-center rounded-md border border-dashed text-xs font-semibold">
                          {file.title?.split('.').pop() || 'FILE'}
                        </div>
                        <div className="space-y-1">
                          <div className="text-foreground font-medium">{file.title}</div>
                          {file.description ? (
                            <div className="text-muted-foreground text-xs">{file.description}</div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">Private</TableCell>
                    <TableCell className="text-sm">{file.category || DEFAULT_CATEGORY}</TableCell>
                    <TableCell className="space-y-1 text-sm">
                      <div>{formatDateTime(file.uploadedAt)}</div>
                      <div className="text-muted-foreground text-xs">by {file.uploadedBy}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <ActionButton aria-label="Actions" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" /> Email
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!file.href}
                            onSelect={(event) => {
                              event.preventDefault();
                              handleDownload(file);
                            }}
                          >
                            <Download className="mr-2 h-4 w-4" /> Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!file.href}
                            onSelect={(event) => {
                              event.preventDefault();
                              handleDownload(file);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" /> View
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {error ? <div className="text-destructive px-4 py-2 text-sm">{error}</div> : null}
      </div>

      <TenantFileUploadDialog
        open={isOpen}
        onOpenChange={setIsOpen}
        tenantId={tenantId}
        uploaderName={uploaderName || undefined}
        onSaved={handleSaved}
      />
    </div>
  );
}
