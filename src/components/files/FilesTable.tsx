'use client';

import { useState } from 'react';
import { toast } from 'sonner';
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
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Eye,
  Edit,
  Trash2,
  Mail,
  FileText,
  Share2,
  RefreshCw,
} from 'lucide-react';
import ActionButton from '@/components/ui/ActionButton';
import Link from 'next/link';
import FileThumbnail from '@/components/files/FileThumbnail';
import { cn } from '@/components/ui/utils';
import DestructiveActionModal from '@/components/common/DestructiveActionModal';
import { Checkbox } from '@/ui/checkbox';
import { Body, Heading, Label } from '@/ui/typography';

interface FileRow {
  id: string;
  file_name: string;
  title?: string;
  description: string | null;
  category_name: string;
  location: string;
  entity_url?: string;
  is_shared: boolean;
  shareWithTenants?: boolean | null;
  shareWithRentalOwners?: boolean | null;
  buildium_file_id?: number | null;
  entity_type?: string | null;
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
  mime_type: string | null;
}

interface FilesTableProps {
  files?: FileRow[];
  isLoading?: boolean;
  onFileClick?: (file: FileRow) => void;
  onFileView?: (file: FileRow) => void;
  onFileDownload?: (file: FileRow) => void;
  onFileEdit?: (file: FileRow) => void;
  onFileEmail?: (file: FileRow) => void;
  onFileDelete?: (file: FileRow) => void;
  onFileShare?: (file: FileRow) => void;
  onFilesChanged?: () => void;
  selectedFiles?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  variant?: 'card' | 'embedded';
  className?: string;
}

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export default function FilesTable({
  files = [],
  isLoading = false,
  onFileClick,
  onFileView,
  onFileDownload,
  onFileEdit,
  onFileEmail,
  onFileDelete,
  onFileShare,
  onFilesChanged,
  selectedFiles: externalSelectedFiles,
  onSelectionChange,
  variant = 'card',
  className,
}: FilesTableProps) {
  const [internalSelectedFiles, setInternalSelectedFiles] = useState<Set<string>>(new Set());
  const selectedFiles = externalSelectedFiles ?? internalSelectedFiles;
  const setSelectedFiles = onSelectionChange ?? setInternalSelectedFiles;
  const [fileToDelete, setFileToDelete] = useState<FileRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRowClick = (file: FileRow) => {
    if (onFileClick) {
      onFileClick(file);
    } else if (onFileView) {
      onFileView(file);
    }
  };

  const handleDownload = async (file: FileRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onFileDownload) {
      onFileDownload(file);
    } else {
      window.location.href = `/api/files/${file.id}/download`;
    }
  };

  const handleDelete = async () => {
    const file = fileToDelete;
    if (!file) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/files/${file.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete file');
      }

      if (onFileDelete) {
        onFileDelete(file);
      }
      if (onFilesChanged) {
        onFilesChanged();
      }
      if (selectedFiles.has(file.id)) {
        const next = new Set(selectedFiles);
        next.delete(file.id);
        setSelectedFiles(next);
      }
      toast.success('File deleted');
    } catch (error) {
      console.error('Error deleting file:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete file');
    } finally {
      setIsDeleting(false);
      setFileToDelete(null);
    }
  };

  const confirmDelete = (file: FileRow, e: React.MouseEvent) => {
    e.stopPropagation();
    setFileToDelete(file);
  };

  const handleResync = async (file: FileRow, e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      const response = await fetch(`/api/files/${file.id}/resync`, {
        method: 'POST',
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resync file to Buildium');
      }

      toast.success('File synced to Buildium successfully');
      if (onFilesChanged) {
        onFilesChanged();
      }
    } catch (error) {
      console.error('Error resyncing file:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to resync file to Buildium');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFiles(new Set(files.map((f) => f.id)));
    } else {
      setSelectedFiles(new Set());
    }
  };

  const handleSelectFile = (fileId: string, checked: boolean) => {
    const newSelected = new Set(selectedFiles);
    if (checked) {
      newSelected.add(fileId);
    } else {
      newSelected.delete(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const containerClass = cn(
    variant === 'card' ? 'bg-card rounded-lg border' : '',
    'overflow-hidden',
    className,
  );

  const contentPadding = variant === 'card' ? 'p-6' : 'px-4 py-6 sm:px-6';

  if (isLoading) {
    return (
      <div className={containerClass}>
        <div className={contentPadding}>
          <div className="text-muted-foreground py-12 text-center">
            <div className="border-primary mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2" />
            <Body as="p" tone="muted" size="sm">
              Loading files...
            </Body>
          </div>
        </div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className={containerClass}>
        <div className={contentPadding}>
          <div className="py-12 text-center">
            <FileText className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <Heading as="h3" size="h5" className="mb-2">
              No files found
            </Heading>
            <Body as="p" tone="muted" size="sm" className="mb-4">
              {selectedFiles.size > 0
                ? 'No files match your current filters'
                : 'Get started by uploading your first file'}
            </Body>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={containerClass}>
        <div className="overflow-x-auto" role="region" aria-label="Files table">
          <Table density="comfortable">
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 px-6 py-3">
                  <Checkbox
                    aria-label="Select all files"
                    checked={selectedFiles.size === files.length && files.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableHead>
                <TableHead className="px-6 py-3">
                  <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                    Title
                  </Label>
                </TableHead>
                <TableHead className="px-6 py-3">
                  <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                    Category
                  </Label>
                </TableHead>
                <TableHead className="px-6 py-3">
                  <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                    Location
                  </Label>
                </TableHead>
                <TableHead className="px-6 py-3">
                  <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                    Uploaded
                  </Label>
                </TableHead>
                <TableHead className="px-6 py-3 text-right">
                  <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                    Actions
                  </Label>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow
                  key={file.id}
                  density="comfortable"
                  className="cursor-pointer"
                  onClick={() => handleRowClick(file)}
                  role="button"
                  tabIndex={0}
                  aria-label={`File: ${file.title || file.file_name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleRowClick(file);
                    }
                  }}
                >
                  <TableCell
                    density="comfortable"
                    className="px-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      aria-label={`Select file ${file.title || file.file_name}`}
                      checked={selectedFiles.has(file.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectFile(file.id, e.target.checked);
                      }}
                    />
                  </TableCell>
                  <TableCell density="comfortable" className="px-6">
                    <div className="flex items-start gap-2">
                      <FileThumbnail
                        fileId={file.id}
                        fileName={file.file_name}
                        mimeType={file.mime_type}
                        size="sm"
                        className="shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <Body as="div" size="sm" className="truncate">
                          {file.title || file.file_name}
                        </Body>
                        {file.description && (
                          <Body as="div" tone="muted" size="sm" className="mt-0.5 truncate">
                            {file.description}
                          </Body>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell density="comfortable" className="px-6">
                    <Badge variant="outline">{file.category_name}</Badge>
                  </TableCell>
                  <TableCell density="comfortable" className="px-6">
                    {file.entity_url ? (
                      <Link
                        href={file.entity_url}
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary block max-w-xs truncate"
                      >
                        <Body as="span" size="sm" className="text-primary">
                          {file.location}
                        </Body>
                      </Link>
                    ) : (
                      <Body as="span" tone="muted" size="sm" className="block max-w-xs truncate">
                        {file.location}
                      </Body>
                    )}
                  </TableCell>
                  <TableCell density="compact" className="px-6">
                    <Body as="div" size="sm">
                      {formatDateTime(file.created_at)}
                    </Body>
                  </TableCell>
                  <TableCell
                    density="comfortable"
                    className="px-6 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <ActionButton aria-label="File actions" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onFileView) {
                              onFileView(file);
                            } else {
                              handleRowClick(file);
                            }
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleDownload(file, e)}>
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onFileEdit) {
                              onFileEdit(file);
                            }
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onFileShare) {
                              onFileShare(file);
                            }
                          }}
                        >
                          <Share2 className="mr-2 h-4 w-4" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onFileEmail) {
                              onFileEmail(file);
                            }
                          }}
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Email
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleResync(file, e)}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Resync to Buildium
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => confirmDelete(file, e)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
      <DestructiveActionModal
        open={!!fileToDelete}
        onOpenChange={(open) => {
          if (!isDeleting) setFileToDelete(open ? fileToDelete : null);
        }}
        title="Delete file?"
        description={`This will permanently delete "${fileToDelete?.title || fileToDelete?.file_name || 'this file'}".`}
        confirmLabel={isDeleting ? 'Deleting…' : 'Delete'}
        isProcessing={isDeleting}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
