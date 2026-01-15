'use client';

import { useState } from 'react';
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
import ActionButton from '@/components/ui/ActionButton';
import { ChevronDown, Eye, Trash2 } from 'lucide-react';
import { Body, Heading, Label } from '@/ui/typography';
import BillFileUploadDialog from './BillFileUploadDialog';
import BillFileViewDialog from './BillFileViewDialog';
import type { BillFileRecord } from './types';

type BillFileAttachmentsCardProps = {
  billId: string;
  uploaderName?: string | null;
  initialFiles?: BillFileRecord[];
};

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export default function BillFileAttachmentsCard({
  billId,
  uploaderName,
  initialFiles = [],
}: BillFileAttachmentsCardProps) {
  const [files, setFiles] = useState<BillFileRecord[]>(initialFiles);
  const [collapsed, setCollapsed] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerFile, setViewerFile] = useState<BillFileRecord | null>(null);

  const onSaved = (row: BillFileRecord) => {
    setFiles((prev) => [row, ...prev]);
  };

  const openViewer = (file: BillFileRecord) => {
    setViewerFile(file);
    setViewerOpen(true);
  };

  const fileCount = files.length;

  return (
    <>
      <div className="border-border/70 overflow-hidden rounded-lg border shadow-sm">
        <div className="border-border/60 bg-muted/30 flex flex-wrap items-start justify-between gap-3 border-b px-6 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Heading as="h2" size="h6" className="text-foreground">
                File attachments
              </Heading>
              <span className="status-pill border-border/60 text-muted-foreground px-2 py-0.5">
                {fileCount} file{fileCount === 1 ? '' : 's'}
              </span>
            </div>
            <Label as="p" size="xs" tone="muted">
              Keep invoices, receipts, and photos together. Add or drop files to attach.
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-expanded={!collapsed}
              aria-controls="bill-files-panel"
            >
              <ChevronDown
                className={`mr-2 h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`}
                aria-hidden
              />
              {collapsed ? 'Show' : 'Hide'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              Add files
            </Button>
          </div>
        </div>

        {!collapsed ? (
          files.length === 0 ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setDialogOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDialogOpen(true);
                }
              }}
              className="border-border/60 bg-muted/10 hover:bg-muted/20 focus-visible:ring-primary/40 flex w-full flex-col items-center justify-center gap-3 px-6 py-14 text-center outline-none transition-colors focus-visible:ring-2"
            >
              <Heading as="div" size="h6" className="text-foreground">
                Drop files or click to upload
              </Heading>
              <Body tone="muted" size="sm" className="max-w-sm">
                Upload invoices, receipts, and supporting documents. You can also use the Add files button
                to launch the uploader.
              </Body>
              <Button type="button" variant="secondary" size="sm">
                Upload your first file
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto" id="bill-files-panel">
              <div className="text-muted-foreground flex items-center justify-between gap-3 px-6 py-3 text-xs">
                <Label as="span" size="xs" tone="muted">
                  All files
                </Label>
                <Label as="span" size="xs" tone="muted">
                  Newest first
                </Label>
              </div>
              <Table className="min-w-[560px]">
                <TableHeader>
                  <TableRow className="border-border/60 bg-muted/30 border-b hover:bg-transparent">
                    <TableHead className="text-foreground px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                      Title
                    </TableHead>
                    <TableHead className="text-foreground px-4 py-3 text-xs font-semibold tracking-wide uppercase">
                      Uploaded
                    </TableHead>
                    <TableHead className="w-[56px] px-4 py-3"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-border/60 divide-y">
                  {files.map((file) => (
                    <TableRow
                      key={file.id}
                      className="group hover:bg-muted/20 cursor-pointer align-middle transition-colors"
                      onClick={() => openViewer(file)}
                    >
                      <TableCell className="text-foreground border-border/60 group-hover:text-primary px-4 py-3 font-medium">
                        {file.title}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Body as="div" size="sm">
                          {formatDateTime(file.uploadedAt)}
                        </Body>
                        <Label as="div" size="xs" tone="muted">
                          by {file.uploadedBy || uploaderName || 'Team member'}
                        </Label>
                        {file.buildiumSyncError ? (
                          <Label as="div" size="xs" className="text-destructive">
                            Buildium sync failed: {file.buildiumSyncError}
                          </Label>
                        ) : file.buildiumFileId ? (
                          <Label as="div" size="xs" tone="muted">
                            Buildium #{file.buildiumFileId}
                          </Label>
                        ) : (
                          <Label as="div" size="xs" className="text-amber-600">
                            Buildium sync pending
                          </Label>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <ActionButton
                              aria-label="File actions"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuItem onSelect={() => openViewer(file)}>
                              <Eye className="mr-2 h-4 w-4" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={async () => {
                                try {
                                  const res = await fetch(`/api/files/${file.id}/link`, {
                                    method: 'DELETE',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ entityType: 'bill', entityId: billId }),
                                  });
                                  if (!res.ok) return;
                                  setFiles((prev) => prev.filter((f) => f.id !== file.id));
                                  setViewerFile((prev) => {
                                    if (prev?.id === file.id) {
                                      setViewerOpen(false);
                                      return null;
                                    }
                                    return prev;
                                  });
                                } catch {}
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )
        ) : null}
      </div>

      <BillFileUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        billId={billId}
        uploaderName={uploaderName}
        onSaved={onSaved}
      />
      <BillFileViewDialog
        open={viewerOpen}
        onOpenChange={(open) => {
          setViewerOpen(open);
          if (!open) {
            setViewerFile(null);
          }
        }}
        file={viewerFile}
        billId={billId}
      />
    </>
  );
}
