'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
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
// import { Textarea } from '@/components/ui/textarea'
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
import { MoreHorizontal, Mail, Trash2, Download, Eye } from 'lucide-react';
import ActionButton from '@/components/ui/ActionButton';
import { CheckCircle2 } from 'lucide-react';

interface TenantFileRow {
  id: string;
  title: string;
  category: string;
  description: string | null;
  uploadedAt: Date;
  uploadedBy: string;
}

interface TenantFilesPanelProps {
  tenantId?: string | null;
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
  tenantId: _tenantId,
  uploaderName = 'Team member',
  initialFiles = [],
}: TenantFilesPanelProps) {
  const [files, setFiles] = useState<TenantFileRow[]>(initialFiles);
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'select' | 'details'>('select');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [description, setDescription] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const matchesLabel = useMemo(() => {
    const count = files.length;
    return `${count} match${count === 1 ? '' : 'es'}`;
  }, [files.length]);

  const resetState = useCallback(() => {
    setStep('select');
    setSelectedFile(null);
    setTitle('');
    setCategory(DEFAULT_CATEGORY);
    setDescription('');
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    resetState();
  }, [resetState]);

  const openModal = () => {
    setIsOpen(true);
    resetState();
  };

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

  const saveFile = () => {
    if (!selectedFile) return;
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`;
    const newRow: TenantFileRow = {
      id,
      title: title.trim() || selectedFile.name,
      category: category.trim() || DEFAULT_CATEGORY,
      description: description.trim() || null,
      uploadedAt: new Date(),
      uploadedBy: uploaderName || 'Team member',
    };
    setFiles((prev) => [newRow, ...prev]);
    closeModal();
  };

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
            <Button type="button" onClick={openModal}>
              Upload file
            </Button>
            <Button variant="outline" type="button">
              Manage categories
            </Button>
          </div>
        </div>
        <div className="text-muted-foreground px-4 py-3 text-xs">{matchesLabel}</div>

        {files.length === 0 ? (
          <div className="border-border text-muted-foreground border-t px-4 py-6 text-sm">
            You don't have any files for this tenant right now.{' '}
            <button
              type="button"
              onClick={openModal}
              className="text-primary align-baseline text-sm font-normal hover:underline"
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
                          PDF
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
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => console.log('Delete file', file.id)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => console.log('Email file', file.id)}>
                            <Mail className="mr-2 h-4 w-4" /> Email
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => console.log('Download file', file.id)}>
                            <Download className="mr-2 h-4 w-4" /> Download
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => console.log('View file', file.id)}>
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
      </div>

      <Dialog open={isOpen} onOpenChange={(value) => (value ? setIsOpen(true) : closeModal())}>
        <DialogContent className="top-[35%] max-w-3xl translate-y-[-35%] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Upload File</DialogTitle>
            <DialogDescription>
              {step === 'select'
                ? 'Choose a file to upload to this tenant record.'
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
                  Drag &amp; drop files here or{' '}
                  <span className="text-primary underline">Browse</span>
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
                      id="tenant-file-title"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                    />
                  </div>
                  <div className="col-span-3">
                    <select
                      id="tenant-file-category"
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      className="border-input bg-background focus-visible:ring-primary w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
                      aria-label="Select file category"
                    >
                      <option value="Uncategorized">Uncategorized</option>
                      <option value="Lease">Lease</option>
                      <option value="Statement">Statement</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="col-span-5">
                    <Input
                      id="tenant-file-description"
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
                <Button type="button" onClick={saveFile}>
                  Save
                </Button>
                <Button type="button" variant="secondary" onClick={saveFile}>
                  Save and share
                </Button>
                <Button type="button" variant="ghost" onClick={closeModal}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" onClick={closeModal}>
                Cancel
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
