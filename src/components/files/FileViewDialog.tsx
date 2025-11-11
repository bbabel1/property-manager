'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ExternalLink, RotateCcw, Edit3, Share2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

interface FileViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string | null;
  fileName?: string;
  file?:
    | {
        id: string;
        file_name: string;
        title?: string | null;
        description?: string | null;
        category_name?: string | null;
        size_bytes?: number | null;
        mime_type?: string | null;
        updated_at?: string;
        created_at?: string;
        location?: string;
        is_shared?: boolean;
        shareWithTenants?: boolean | null;
        shareWithRentalOwners?: boolean | null;
        buildium_file_id?: number | null;
        entity_type?: string | null;
      }
    | null;
  onEdit?: () => void;
  onShare?: () => void;
  onShareStatusChange?: (status: {
    shareWithTenants: boolean;
    shareWithRentalOwners: boolean;
  }) => void;
}

export default function FileViewDialog({
  open,
  onOpenChange,
  fileId,
  fileName,
  file,
  onEdit,
  onShare,
  onShareStatusChange,
}: FileViewDialogProps) {
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareState, setShareState] = useState<{ tenants: boolean; owners: boolean }>({
    tenants: false,
    owners: false,
  });
  const [shareError, setShareError] = useState<string | null>(null);
  const [activeShareToggle, setActiveShareToggle] = useState<'tenants' | 'owners' | null>(null);

  const fetchPresignedUrl = useCallback(async () => {
    if (!fileId) return;
    setStatus('loading');
    setErrorMessage(null);
    setPresignedUrl(null);
    try {
      const res = await fetch(`/api/files/${fileId}/presign`, {
        method: 'GET',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.getUrl) {
        throw new Error(json?.error || 'Unable to load file');
      }
      setPresignedUrl(json.getUrl as string);
      setStatus('success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to load file';
      setErrorMessage(message);
      setStatus('error');
    }
  }, [fileId]);

  useEffect(() => {
    if (!open) {
      setPresignedUrl(null);
      setStatus('idle');
      setErrorMessage(null);
      return;
    }
    if (fileId) {
      fetchPresignedUrl();
    }
  }, [open, fileId, fetchPresignedUrl]);

  useEffect(() => {
    if (!open) {
      setShareState({ tenants: false, owners: false });
      setShareError(null);
      setActiveShareToggle(null);
      return;
    }

    const tenants = Boolean(file?.shareWithTenants);
    const owners = Boolean(file?.shareWithRentalOwners);
    setShareState({ tenants, owners });
    setShareError(null);
  }, [open, file?.shareWithTenants, file?.shareWithRentalOwners]);

  const deriveShareFlags = useCallback((data: any) => {
    const scope = data ?? {};
    const tenants = Boolean(
      scope?.Lease?.Tenants ??
        scope?.Rental?.Tenants ??
        scope?.Tenant?.Tenants ??
        scope?.RentalUnit?.Tenants ??
        scope?.Account?.AllResidents,
    );
    const owners = Boolean(
      scope?.Lease?.RentalOwners ??
        scope?.Rental?.RentalOwners ??
        scope?.Tenant?.RentalOwners ??
        scope?.RentalOwner?.RentalOwner ??
        scope?.RentalUnit?.RentalOwners ??
        scope?.Account?.AllRentalOwners,
    );
    return { tenants, owners };
  }, []);

  const title = fileName || 'File';
  const summaryItems = useMemo(() => {
    if (!file) return [];

    const formatSize = (bytes?: number | null): string | null => {
      if (bytes === null || bytes === undefined) return null;
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const formatDate = (value?: string) => {
      if (!value) return null;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return null;
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
    };

    const extension =
      typeof file.file_name === 'string' && file.file_name.includes('.')
        ? file.file_name.split('.').pop()?.toUpperCase() ?? null
        : null;

    return [
      { label: 'Title', value: file.title || file.file_name || null },
      { label: 'Description', value: file.description || '--' },
      { label: 'Category', value: file.category_name || 'Uncategorized' },
      { label: 'Size', value: formatSize(file.size_bytes) || '--' },
      { label: 'Type', value: extension || file.mime_type || '--' },
      { label: 'Updated', value: formatDate(file.updated_at) || '--' },
      { label: 'File name', value: file.file_name || '--' },
      { label: 'Location', value: file.location || '--' },
    ];
  }, [file]);

  const shareSummary = useMemo(() => {
    if (!file?.buildium_file_id) {
      return 'This file has not been synced to Buildium yet, so it cannot be shared in portals.';
    }
    if (shareState.owners && shareState.tenants) {
      return 'Shared with rental owners and tenants via their portals.';
    }
    if (shareState.owners) {
      return 'Shared with rental owners via their portal.';
    }
    if (shareState.tenants) {
      return 'Shared with tenants via the Resident Center.';
    }
    return 'This file is not shared with rental owners or tenants.';
  }, [shareState.owners, shareState.tenants, file?.buildium_file_id]);

  const handleShareToggle = useCallback(
    async (audience: 'tenants' | 'owners', value: boolean) => {
      if (!file?.id || !file.buildium_file_id) {
        setShareError('Sharing is available after this file is synced to Buildium.');
        return;
      }
      setShareError(null);
      const previousState = { ...shareState };
      const optimisticState = {
        tenants: audience === 'tenants' ? value : shareState.tenants,
        owners: audience === 'owners' ? value : shareState.owners,
      };
      setShareState(optimisticState);
      setActiveShareToggle(audience);
      try {
        const response = await fetch(`/api/files/${file.id}/sharing`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            audience === 'tenants'
              ? {
                  shareWithTenants: optimisticState.tenants,
                  shareWithRentalOwners: optimisticState.owners,
                }
              : {
                  shareWithTenants: optimisticState.tenants,
                  shareWithRentalOwners: optimisticState.owners,
                },
          ),
        });
        const raw = await response.text();
        let payload: any = {};
        if (raw) {
          try {
            payload = JSON.parse(raw);
          } catch {
            payload = { error: raw };
          }
        }
        if (!response.ok) {
          throw new Error(
            (payload?.error as string | undefined) || 'Failed to update sharing settings',
          );
        }
        const data = payload?.data ?? payload ?? {};
        const nextState = {
          tenants:
            typeof data?.shareWithTenants === 'boolean'
              ? Boolean(data.shareWithTenants)
              : deriveShareFlags(data).tenants,
          owners:
            typeof data?.shareWithRentalOwners === 'boolean'
              ? Boolean(data.shareWithRentalOwners)
              : deriveShareFlags(data).owners,
        };
        setShareState(nextState);
        setShareError(null);
        onShareStatusChange?.({
          shareWithTenants: nextState.tenants,
          shareWithRentalOwners: nextState.owners,
        });
      } catch (error) {
        setShareState(previousState);
        setShareError(error instanceof Error ? error.message : 'Failed to update sharing settings');
      } finally {
        setActiveShareToggle(null);
      }
    },
    [file?.id, file?.buildium_file_id, shareState, deriveShareFlags, onShareStatusChange],
  );

  const canShare = Boolean(file?.buildium_file_id);
  const shareBusy = activeShareToggle !== null;
  const shareStatusMessage = !canShare
    ? 'Sync this file to Buildium to manage portal sharing.'
    : activeShareToggle !== null
      ? 'Updating sharing settings…'
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[96vh] w-[min(calc(100vw-3rem),1200px)] max-w-none overflow-hidden p-0 sm:max-w-none">
        <div className="flex h-full flex-col md:flex-row">
          <div className="flex-1 overflow-hidden">
            <DialogHeader className="px-6 pt-6">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>View file contents</DialogDescription>
            </DialogHeader>

            <div className="px-6 pb-6">
              {status === 'loading' ? (
                <div className="text-muted-foreground flex flex-col items-center gap-3 py-12 text-sm">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Loading file…
                </div>
              ) : null}

              {status === 'error' ? (
                <div className="text-center text-sm">
                  <div className="text-destructive mb-3">
                    {errorMessage || 'We could not load this file.'}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchPresignedUrl}
                    className="inline-flex items-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Try again
                  </Button>
                </div>
              ) : null}

              {status === 'success' && presignedUrl ? (
                <div className="flex h-full flex-col gap-4">
                  <div className="flex-1 overflow-hidden rounded-md border shadow-sm">
                    <iframe
                      key={presignedUrl}
                      src={presignedUrl}
                      title={title}
                      className="h-full min-h-[70vh] w-full rounded-md"
                      loading="lazy"
                      allowFullScreen
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" asChild>
                      <a href={presignedUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open in new tab
                      </a>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <aside className="border-t px-6 py-6 md:w-[320px] md:border-l md:border-t-0">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Summary</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={onEdit}
                disabled={!onEdit}
              >
                <Edit3 className="h-4 w-4" />
                Edit
              </Button>
            </div>

            {summaryItems.length > 0 ? (
              <dl className="mt-4 space-y-3 text-sm">
                {summaryItems.map(({ label, value }) => (
                  <div key={label} className="border-b pb-3 last:border-b-0 last:pb-0">
                    <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm leading-relaxed">
                      {label === 'Category' ? (
                        <Badge variant="secondary">{value || 'Uncategorized'}</Badge>
                      ) : (
                        value || '--'
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-muted-foreground mt-4 text-sm">
                File details will appear here once loaded.
              </p>
            )}

            <div className="mt-8 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase text-muted-foreground">Sharing</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  onClick={onShare}
                  disabled={!onShare || !canShare}
                >
                  <Share2 className="h-4 w-4" />
                  Manage
                </Button>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                {shareSummary}
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="pr-3">
                    <div className="font-medium text-foreground">Rental owners</div>
                    <div className="text-muted-foreground text-xs">
                      Share with rental owners {file?.location ? `of ${file.location}` : ''} via the
                      portal.
                    </div>
                  </div>
                  <Switch
                    checked={shareState.owners}
                    disabled={!canShare || shareBusy}
                    onCheckedChange={(checked) => handleShareToggle('owners', Boolean(checked))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="pr-3">
                    <div className="font-medium text-foreground">Tenants</div>
                    <div className="text-muted-foreground text-xs">
                      Share with tenants {file?.location ? `of ${file.location}` : ''} via the
                      Resident Center.
                    </div>
                  </div>
                  <Switch
                    checked={shareState.tenants}
                    disabled={!canShare || shareBusy}
                    onCheckedChange={(checked) => handleShareToggle('tenants', Boolean(checked))}
                  />
                </div>
                {shareStatusMessage ? (
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    {shareBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    <span>{shareStatusMessage}</span>
                  </div>
                ) : null}
                {shareError ? (
                  <p className="text-destructive text-xs">{shareError}</p>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
