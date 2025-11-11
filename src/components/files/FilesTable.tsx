'use client';

import { useState } from 'react';
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

  const handleDelete = async (file: FileRow, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to delete "${file.title || file.file_name}"?`)) {
      return;
    }

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
    } catch (error) {
      console.error('Error deleting file:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete file');
    }
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

      alert('File synced to Buildium successfully');
      if (onFilesChanged) {
        onFilesChanged();
      }
    } catch (error) {
      console.error('Error resyncing file:', error);
      alert(error instanceof Error ? error.message : 'Failed to resync file to Buildium');
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
            <p>Loading files...</p>
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
            <h3 className="text-foreground mb-2 text-lg font-medium">No files found</h3>
            <p className="text-muted-foreground mb-4">
              {selectedFiles.size > 0
                ? 'No files match your current filters'
                : 'Get started by uploading your first file'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <div className="overflow-x-auto" role="region" aria-label="Files table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  aria-label="Select all files"
                  checked={selectedFiles.size === files.length && files.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <TableRow
                key={file.id}
                className="hover:bg-muted/50 cursor-pointer"
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
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    aria-label={`Select file ${file.title || file.file_name}`}
                    checked={selectedFiles.has(file.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleSelectFile(file.id, e.target.checked);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-start gap-2">
                    <FileThumbnail
                      fileId={file.id}
                      fileName={file.file_name}
                      mimeType={file.mime_type}
                      size="sm"
                      className="shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground truncate font-medium">
                        {file.title || file.file_name}
                      </div>
                      {file.description && (
                        <div className="text-muted-foreground mt-0.5 truncate text-sm">
                          {file.description}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="font-normal">
                    {file.category_name}
                  </Badge>
                </TableCell>
                <TableCell>
                  {file.entity_url ? (
                    <Link
                      href={file.entity_url}
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary block max-w-xs truncate text-sm hover:underline"
                    >
                      {file.location}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground block max-w-xs truncate text-sm">
                      {file.location}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-foreground text-sm">{formatDateTime(file.created_at)}</div>
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
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
                        onClick={(e) => handleDelete(file, e)}
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
  );
}
