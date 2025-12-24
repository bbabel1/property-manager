'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Users, Loader2 } from 'lucide-react';

interface FileSharingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileId: string | null;
  fileName?: string;
  orgId?: string;
  sharedEntities?: Array<{
    id: string;
    type: string;
    name: string;
    url?: string;
  }>;
  onSharesUpdated?: () => void;
}

export default function FileSharingDialog({
  open,
  onOpenChange,
  fileId,
  fileName,
  orgId,
  sharedEntities = [],
  onSharesUpdated,
}: FileSharingDialogProps) {
  const [entities, setEntities] = useState(sharedEntities);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSharedEntities = useCallback(async () => {
    if (!fileId) return;
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/files/shares?fileId=${encodeURIComponent(fileId)}${orgId ? `&orgId=${encodeURIComponent(orgId)}` : ''}`,
      );
      if (!res.ok) throw new Error('Failed to fetch shares');
      const data = await res.json();
      setEntities(Array.isArray(data?.data) ? data.data : []);
    } catch (error) {
      console.error('Error fetching shared entities:', error);
      setEntities(sharedEntities);
    } finally {
      setIsLoading(false);
    }
  }, [fileId, orgId, sharedEntities]);

  useEffect(() => {
    if (open && fileId) {
      void fetchSharedEntities();
    }
  }, [open, fileId, fetchSharedEntities]);

  const handleRemoveShare = async (entityId: string, entityType: string) => {
    if (!fileId) return;
    try {
      const res = await fetch(`/api/files/shares`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileId, entityId, entityType, orgId }),
      });
      if (!res.ok) throw new Error('Failed to remove share');
      setEntities((prev) => prev.filter((e) => e.id !== entityId || e.type !== entityType));
      onSharesUpdated?.();
    } catch (err) {
      console.error('Error removing share:', err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[680px] max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Manage Sharing
          </DialogTitle>
          <DialogDescription>Files shared with: {fileName || 'this file'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          ) : entities.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              <Users className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>This file is not shared with any entities</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entities.map((entity) => (
                <div
                  key={`${entity.type}-${entity.id}`}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{entity.type}</Badge>
                    <span className="font-medium">{entity.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveShare(entity.id, entity.type)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
