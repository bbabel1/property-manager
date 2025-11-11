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
import { Eye, Trash2 } from 'lucide-react';
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

  return (
    <>
      <div className="border-border overflow-hidden rounded-lg border shadow-sm">
        <div className="border-border bg-muted/40 flex items-center justify-between border-b px-4 py-4">
          <h2 className="text-foreground text-base font-semibold">File attachments</h2>
          <Button
            type="button"
            variant="link"
            size="sm"
            className="!h-auto !min-h-0 px-0 !py-0 text-sm font-medium"
            onClick={() => setDialogOpen(true)}
          >
            Add files
          </Button>
        </div>

        {files.length === 0 ? (
          <div className="text-foreground flex flex-col items-center justify-center gap-3 px-6 py-12 text-center text-sm">
            <div className="text-foreground text-base font-medium">No files yet</div>
            <p className="max-w-sm">Upload and view your attachments here.</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
              Upload your first file
            </Button>
          </div>
        ) : (
          <div className="border-border border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-[56px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow
                    key={file.id}
                    className="group hover:bg-muted/40 cursor-pointer align-middle transition-colors"
                    onClick={() => openViewer(file)}
                  >
                    <TableCell className="text-foreground group-hover:text-primary font-medium">
                      {file.title}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{formatDateTime(file.uploadedAt)}</div>
                      <div className="text-muted-foreground text-xs">
                        by {file.uploadedBy || uploaderName || 'Team member'}
                      </div>
                      {file.buildiumSyncError ? (
                        <div className="text-destructive text-xs">
                          Buildium sync failed: {file.buildiumSyncError}
                        </div>
                      ) : file.buildiumFileId ? (
                        <div className="text-muted-foreground text-xs">
                          Buildium #{file.buildiumFileId}
                        </div>
                      ) : (
                        <div className="text-xs text-amber-600">Buildium sync pending</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
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
        )}
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
