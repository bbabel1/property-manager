'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type CategoryRecord = {
  id: string;
  name: string;
  taskCount: number;
};

type CategoryDraft = {
  id: string;
  localId: string;
  originalName: string;
  draftName: string;
  taskCount: number;
  isNew: boolean;
  isDeleted?: boolean;
  isUnassigned?: boolean;
};

type ManageTaskCategoriesFormProps = {
  categories: CategoryRecord[];
  unassignedCount: number;
};

function taskCountLabel(count: number) {
  if (count === 0) return 'No tasks are assigned to this category';
  if (count === 1) return 'One task is assigned to this category';
  return `${count} tasks are assigned to this category`;
}

export default function ManageTaskCategoriesForm({
  categories,
  unassignedCount,
}: ManageTaskCategoriesFormProps) {
  const router = useRouter();
  const initialDrafts: CategoryDraft[] = [
    ...categories.map((category) => ({
      id: category.id,
      localId: category.id,
      originalName: category.name,
      draftName: category.name,
      taskCount: category.taskCount,
      isNew: false,
      isDeleted: false,
    })),
  ];

  if (unassignedCount > 0) {
    initialDrafts.unshift({
      id: '__uncategorized__',
      localId: '__uncategorized__',
      originalName: 'Uncategorized',
      draftName: 'Uncategorized',
      taskCount: unassignedCount,
      isNew: false,
      isDeleted: false,
      isUnassigned: true,
    });
  }

  const [drafts, setDrafts] = useState<CategoryDraft[]>(initialDrafts);
  const [saving, setSaving] = useState(false);

  const visibleDrafts = drafts.filter((draft) => !draft.isDeleted);

  const hasChanges = useMemo(() => {
    return drafts.some((draft) => {
      if (draft.isUnassigned) return false;
      if (draft.isDeleted) return true;
      if (draft.isNew) return draft.draftName.trim().length > 0;
      return draft.draftName.trim() !== draft.originalName.trim();
    });
  }, [drafts]);

  const handleAdd = () => {
    const id = `temp-${Date.now()}`;
    setDrafts((prev) => [
      ...prev,
      {
        id,
        localId: id,
        originalName: '',
        draftName: '',
        taskCount: 0,
        isNew: true,
        isDeleted: false,
      },
    ]);
  };

  const handleRemove = (localId: string) => {
    setDrafts((prev) =>
      prev.map((draft) => (draft.localId === localId ? { ...draft, isDeleted: true } : draft)),
    );
  };

  const handleNameChange = (localId: string, name: string) => {
    setDrafts((prev) =>
      prev.map((draft) => (draft.localId === localId ? { ...draft, draftName: name } : draft)),
    );
  };

  const handleSave = async () => {
    const trimmedDrafts = drafts.map((draft) => ({
      ...draft,
      draftName: draft.draftName.trim(),
    }));
    const invalid = trimmedDrafts.some(
      (draft) => !draft.isDeleted && !draft.draftName && !draft.isUnassigned,
    );
    if (invalid) {
      toast.error('Category names cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      toast.success('Task categories saved (demo)');
      router.push('/tasks');
    } catch (error) {
      console.error('Failed to save categories', error);
      toast.error('Something went wrong while saving categories.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-6 pb-12">
      <div className="space-y-2">
        <h1 className="text-foreground text-3xl font-semibold">Manage task categories</h1>
        <p className="text-muted-foreground text-sm">
          Organize tasks by editing existing categories or adding new ones.
        </p>
      </div>

      <Card className="border-border/70 border shadow-sm">
        <CardContent className="space-y-4 p-0">
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="border-border border-b">
                <TableHead className="text-muted-foreground w-2/5 text-xs tracking-wide uppercase">
                  Category name
                </TableHead>
                <TableHead className="text-muted-foreground text-xs tracking-wide uppercase">
                  Details
                </TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Remove</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleDrafts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground py-6 text-center text-sm">
                    No categories yet. Add one below to get started.
                  </TableCell>
                </TableRow>
              ) : (
                visibleDrafts.map((draft) => {
                  const isRemovable = !draft.isUnassigned && draft.taskCount === 0;
                  return (
                    <TableRow key={draft.localId} className="border-border/70 border-b">
                      <TableCell className="py-4 align-middle">
                        <Input
                          value={draft.draftName}
                          onChange={(event) => handleNameChange(draft.localId, event.target.value)}
                          disabled={saving || draft.isUnassigned}
                          placeholder="Category name"
                          className="focus:border-primary border-transparent bg-transparent px-0 text-base font-medium shadow-none focus:bg-white"
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground py-4 align-middle text-sm">
                        {draft.isUnassigned
                          ? 'Tasks without a category are listed here.'
                          : taskCountLabel(draft.taskCount)}
                      </TableCell>
                      <TableCell className="py-4 text-right align-middle">
                        {isRemovable ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemove(draft.localId)}
                            disabled={saving}
                            aria-label={`Remove ${draft.draftName || 'category'}`}
                          >
                            <X className="text-muted-foreground size-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <div className="px-6 pb-6">
            <Button
              type="button"
              variant="link"
              className="px-0 text-sm font-medium"
              onClick={handleAdd}
              disabled={saving}
            >
              <Plus className="mr-2 size-4" />
              Add a new category
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push('/tasks')}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
