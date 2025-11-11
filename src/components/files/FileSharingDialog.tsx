'use client';

import { useState, useEffect } from 'react';
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
  sharedEntities = [],
  onSharesUpdated,
}: FileSharingDialogProps) {
  const [entities, setEntities] = useState(sharedEntities);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && fileId) {
      fetchSharedEntities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fileId]);

  const fetchSharedEntities = async () => {
    if (!fileId) return;
    setIsLoading(true);
    try {
      // TODO: Implement API endpoint to fetch file shares
      // For now, use the sharedEntities prop
      setEntities(sharedEntities);
    } catch (error) {
      console.error('Error fetching shared entities:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveShare = async (entityId: string, entityType: string) => {
    if (!fileId) return;
    // TODO: Implement API endpoint to remove share
    setEntities((prev) => prev.filter((e) => e.id !== entityId || e.type !== entityType));
    onSharesUpdated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
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
