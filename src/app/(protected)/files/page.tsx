'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload } from 'lucide-react';
import FilesTable from '@/components/files/FilesTable';
import FilesFilters from '@/components/files/FilesFilters';
import FileUploadDialog from '@/components/files/FileUploadDialog';
import FileViewDialog from '@/components/files/FileViewDialog';
import FileEmailDialog from '@/components/files/FileEmailDialog';
import FileEditDialog from '@/components/files/FileEditDialog';
import FileSharingDialog from '@/components/files/FileSharingDialog';
import { useSearchParams, useRouter } from 'next/navigation';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';
import BulkActionsBar from '@/components/files/BulkActionsBar';

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
  size_bytes: number | null;
  created_at: string;
  updated_at: string;
  mime_type: string | null;
  buildium_category_id?: number | null;
  buildium_file_id?: number | null;
  entity_type?: string | null;
}

interface CategoryOption {
  id: string;
  name: string;
  buildiumCategoryId?: number | null;
}

const MAX_RETRY_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 2000;
const MAX_RETRY_DELAY_MS = 10000;

type FilesListResponse = {
  success: boolean;
  data?: FileRow[];
  pagination?: { total?: number | null } | null;
  error?: string;
  message?: string;
};

export default function FilesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [files, setFiles] = useState<FileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<number>(0);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [viewingFile, setViewingFile] = useState<FileRow | null>(null);
  const [emailingFile, setEmailingFile] = useState<FileRow | null>(null);
  const [editingFile, setEditingFile] = useState<FileRow | null>(null);
  const [sharingFile, setSharingFile] = useState<FileRow | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptsRef = useRef(0);
  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // Filter state from URL params
  const search = searchParams.get('search') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        let response: Response;
        try {
          response = await fetchWithSupabaseAuth('/api/files/categories', {
            credentials: 'include',
          });
        } catch (authError) {
          console.warn('fetchWithSupabaseAuth failed for categories, trying fallback:', authError);
          response = await fetch('/api/files/categories', {
            credentials: 'include',
          });
        }
        if (response.status === 401) {
          response = await fetch('/api/files/categories', {
            credentials: 'include',
          });
        }
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setCategories(data.data || []);
          }
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    fetchCategories();
  }, []);

  // Fetch files whenever filters change
  const fetchFiles = useCallback(
    async (options?: { isRetry?: boolean }) => {
      const isRetry = options?.isRetry ?? false;
      clearRetryTimeout();

      if (!isRetry) {
        retryAttemptsRef.current = 0;
        setError(null);
      }

      setIsLoading(true);

      try {
        const params = new URLSearchParams();
        params.set('limit', '100');
        if (search) params.set('search', search);
        if (categoryId) params.set('categoryId', categoryId);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);

        let response: Response;
        try {
          response = await fetchWithSupabaseAuth(`/api/files/list?${params.toString()}`, {
            credentials: 'include',
          });
        } catch (authError) {
          console.warn('fetchWithSupabaseAuth failed, trying fallback with cookies:', authError);
          response = await fetch(`/api/files/list?${params.toString()}`, {
            credentials: 'include',
          });
        }
        if (response.status === 401) {
          response = await fetch(`/api/files/list?${params.toString()}`, {
            credentials: 'include',
          });
        }

        const rawBody = await response.text();

        let parsed: FilesListResponse | null = null;
        if (rawBody) {
          try {
            parsed = JSON.parse(rawBody) as FilesListResponse;
          } catch {
            parsed = { success: false, error: rawBody };
          }
        }

        if (!response.ok) {
          const message =
            (parsed && (parsed.error || parsed.message)) || rawBody || 'Failed to fetch files';
          throw new Error(message);
        }

        if (parsed?.success) {
          const filesData = Array.isArray(parsed.data) ? parsed.data : [];
          const totalMatches =
            typeof parsed.pagination?.total === 'number' ? parsed.pagination.total : filesData.length;
          setFiles(filesData);
          setMatches(totalMatches);
          retryAttemptsRef.current = 0;
          clearRetryTimeout();
          setError(null);
        } else {
          throw new Error(parsed?.error || 'Failed to fetch files');
        }
      } catch (err) {
        console.error('Error fetching files:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to load files';
        setError(errorMessage);

        const navigatorOffline =
          typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine;
        const isTypeError = err instanceof TypeError;
        const messageLower = errorMessage.toLowerCase();
        const looksTransient =
          isTypeError ||
          navigatorOffline ||
          messageLower.includes('network') ||
          messageLower.includes('failed to fetch');

        if (looksTransient && retryAttemptsRef.current < MAX_RETRY_ATTEMPTS) {
          const nextAttempt = retryAttemptsRef.current + 1;
          retryAttemptsRef.current = nextAttempt;
          const delay = Math.min(
            BASE_RETRY_DELAY_MS * Math.pow(2, nextAttempt - 1),
            MAX_RETRY_DELAY_MS,
          );
          retryTimeoutRef.current = setTimeout(() => {
            fetchFiles({ isRetry: true });
          }, delay);
        } else {
          retryAttemptsRef.current = 0;
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      clearRetryTimeout,
      search,
      categoryId,
      dateFrom,
      dateTo,
    ],
  );

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  useEffect(() => {
    return () => {
      clearRetryTimeout();
      retryAttemptsRef.current = 0;
    };
  }, [clearRetryTimeout]);

  const handleShareStatusChange = useCallback(
    (fileId: string, status: { shareWithTenants: boolean; shareWithRentalOwners: boolean }) => {
      setFiles((prev) =>
        prev.map((file) =>
          file.id === fileId
            ? {
                ...file,
                shareWithTenants: status.shareWithTenants,
                shareWithRentalOwners: status.shareWithRentalOwners,
                is_shared: Boolean(status.shareWithTenants || status.shareWithRentalOwners),
              }
            : file,
        ),
      );
      setViewingFile((prev) =>
        prev && prev.id === fileId
          ? {
              ...prev,
              shareWithTenants: status.shareWithTenants,
              shareWithRentalOwners: status.shareWithRentalOwners,
              is_shared: Boolean(status.shareWithTenants || status.shareWithRentalOwners),
            }
          : prev,
      );
    },
    [],
  );

  // Update URL params when filters change
  const updateSearchParams = useCallback(
    (updates: {
      search?: string;
      categoryId?: string;
      dateFrom?: string;
      dateTo?: string;
    }) => {
      const params = new URLSearchParams(searchParams?.toString() || '');

      if (updates.search !== undefined) {
        if (updates.search) {
          params.set('search', updates.search);
        } else {
          params.delete('search');
        }
      }

      if (updates.categoryId !== undefined) {
        if (updates.categoryId) {
          params.set('categoryId', updates.categoryId);
        } else {
          params.delete('categoryId');
        }
      }

      if (updates.dateFrom !== undefined) {
        if (updates.dateFrom) {
          params.set('dateFrom', updates.dateFrom);
        } else {
          params.delete('dateFrom');
        }
      }

      if (updates.dateTo !== undefined) {
        if (updates.dateTo) {
          params.set('dateTo', updates.dateTo);
        } else {
          params.delete('dateTo');
        }
      }

      router.replace(`/files?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      updateSearchParams({ search: value });
    },
    [updateSearchParams],
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      updateSearchParams({ categoryId: value });
    },
    [updateSearchParams],
  );

  const handleClearFilters = useCallback(() => {
    router.replace('/files', { scroll: false });
    setSelectedFiles(new Set()); // Clear selection when clearing filters
  }, [router]);

  const handleDateFromChange = useCallback(
    (value: string) => {
      updateSearchParams({ dateFrom: value });
    },
    [updateSearchParams],
  );

  const handleDateToChange = useCallback(
    (value: string) => {
      updateSearchParams({ dateTo: value });
    },
    [updateSearchParams],
  );

  const handleFileClick = (file: FileRow) => {
    setViewingFile(file);
  };

  const handleFileView = (file: FileRow) => {
    setViewingFile(file);
  };

  const handleFileDownload = (file: FileRow) => {
    window.location.href = `/api/files/${file.id}/download`;
  };

  const handleFileEdit = async (file: FileRow) => {
    // Fetch full file details including buildium_category_id
    try {
      const response = await fetchWithSupabaseAuth(`/api/files/${file.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.file) {
          setEditingFile({ ...file, ...data.file });
        } else {
          setEditingFile(file);
        }
      } else {
        setEditingFile(file);
      }
    } catch (err) {
      console.error('Error fetching file details:', err);
      setEditingFile(file);
    }
  };

  const handleFileEmail = (file: FileRow) => {
    setEmailingFile(file);
  };

  const handleFileDelete = () => {
    // File list will refresh via onFilesChanged
    fetchFiles();
  };

  const handleFileShare = (file: FileRow) => {
    setSharingFile(file);
  };

  return (
    <PageShell>
      <PageHeader
        title="Files"
        description="Manage and organize all your property management files"
        actions={
          <Button
            className="flex w-full items-center gap-2 sm:w-auto"
            onClick={() => setIsUploadDialogOpen(true)}
            aria-label="Upload new file"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Upload File
          </Button>
        }
      />

      <PageBody>
        <Card className="border-border/80 shadow-sm overflow-hidden">
          <FilesFilters
            search={search}
            categoryId={categoryId}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onSearchChange={handleSearchChange}
            onCategoryChange={handleCategoryChange}
            onDateFromChange={handleDateFromChange}
            onDateToChange={handleDateToChange}
            onClearFilters={handleClearFilters}
            categoryOptions={categories}
            variant="embedded"
            className="border-border/80 border-b"
          />

          <BulkActionsBar
            selectedFiles={selectedFiles}
            onSelectionChange={setSelectedFiles}
            onRefresh={fetchFiles}
            variant="inline"
          />

          <div className="border-border/80 border-b px-4 py-3 text-sm text-muted-foreground sm:px-6">
            {matches} {matches === 1 ? 'match' : 'matches'}
          </div>

          <CardContent className="p-0">
            {error ? (
              <div className="px-6 py-12 text-center">
                <p className="text-destructive mb-4">{error}</p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            ) : (
              <FilesTable
                files={files}
                isLoading={isLoading}
                onFileClick={handleFileClick}
                onFileView={handleFileView}
                onFileDownload={handleFileDownload}
                onFileEdit={handleFileEdit}
                onFileEmail={handleFileEmail}
                onFileDelete={handleFileDelete}
                onFileShare={handleFileShare}
                onFilesChanged={fetchFiles}
                selectedFiles={selectedFiles}
                onSelectionChange={setSelectedFiles}
                variant="embedded"
              />
            )}
          </CardContent>
        </Card>
      </PageBody>

      {/* Upload Dialog */}
      <FileUploadDialog
        open={isUploadDialogOpen}
        onOpenChange={setIsUploadDialogOpen}
        onUploaded={() => {
          fetchFiles(); // Refresh file list after upload
        }}
        categoryOptions={categories}
      />

      {/* View Dialog */}
      <FileViewDialog
        open={!!viewingFile}
        onOpenChange={(open) => {
          if (!open) setViewingFile(null);
        }}
        fileId={viewingFile?.id || null}
        fileName={viewingFile?.title || viewingFile?.file_name}
        file={viewingFile || null}
        onEdit={() => {
          if (viewingFile) {
            setEditingFile(viewingFile);
          }
        }}
        onShare={() => {
          if (viewingFile) {
            setSharingFile(viewingFile);
          }
        }}
        onShareStatusChange={(status) => {
          if (viewingFile) {
            handleShareStatusChange(viewingFile.id, status);
          }
        }}
      />

      {/* Email Dialog */}
      <FileEmailDialog
        open={!!emailingFile}
        onOpenChange={(open) => {
          if (!open) setEmailingFile(null);
        }}
        fileId={emailingFile?.id || null}
        fileName={emailingFile?.title || emailingFile?.file_name}
      />

      {/* Edit Dialog */}
      <FileEditDialog
        open={!!editingFile}
        onOpenChange={(open) => {
          if (!open) setEditingFile(null);
        }}
        file={
          editingFile
            ? {
                id: editingFile.id,
                file_name: editingFile.file_name,
                title: editingFile.title,
                description: editingFile.description,
                category_name: editingFile.category_name,
                buildium_category_id: editingFile.buildium_category_id ?? null,
              }
            : null
        }
        categoryOptions={categories}
        onSaved={() => {
          fetchFiles(); // Refresh file list after edit
        }}
      />

      {/* Sharing Dialog */}
      <FileSharingDialog
        open={!!sharingFile}
        onOpenChange={(open) => {
          if (!open) setSharingFile(null);
        }}
        fileId={sharingFile?.id || null}
        fileName={sharingFile?.title || sharingFile?.file_name}
        onSharesUpdated={() => {
          fetchFiles(); // Refresh to update sharing indicators
        }}
      />
    </PageShell>
  );
}
