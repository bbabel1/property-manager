'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/components/ui/utils';

type CategoryItem = {
  id: string;
  name: string;
  isActive: boolean | null;
  vendorCount: number;
};

type ManageVendorCategoriesProps = {
  categories: CategoryItem[];
};

export function ManageVendorCategories({ categories }: ManageVendorCategoriesProps) {
  const [rows, setRows] = useState<CategoryItem[]>(categories);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailLabel = (count: number) => {
    if (count === 0) return 'No vendors are assigned to this category';
    if (count === 1) return 'One vendor is assigned to this category';
    return `${count} vendors are assigned to this category`;
  };

  const startAdd = () => {
    setAdding(true);
    setNewName('');
    setError(null);
  };

  const cancelAdd = () => {
    setAdding(false);
    setNewName('');
    setSaving(false);
    setError(null);
  };

  const saveCategory = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setError('Category name is required');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/vendor-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = body?.error || 'Unable to save category';
        throw new Error(message);
      }

      const body = (await res.json()) as { data?: { id: string; name: string; isActive?: boolean | null } };
      if (!body?.data) throw new Error('Missing response data');

      setRows((prev) => [
        ...prev,
        {
          id: body.data!.id,
          name: body.data!.name,
          isActive: body.data!.isActive ?? true,
          vendorCount: 0,
        },
      ]);
      cancelAdd();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save category';
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-0">
        <div className="overflow-hidden rounded-lg border border-border/70">
          <table className="w-full border-collapse">
            <thead className="bg-muted/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="border-b border-border/70 px-4 py-3 text-left">Category name</th>
                <th className="border-b border-border/70 px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {rows.map((category) => (
                <tr
                  key={category.id}
                  className={cn(
                    'border-border/70 border-b last:border-b-0',
                    category.isActive === false ? 'bg-muted/50 text-muted-foreground' : '',
                  )}
                >
                  <td className="px-4 py-3 font-medium text-foreground">{category.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{detailLabel(category.vendorCount)}</td>
                </tr>
              ))}
              {adding ? (
                <tr className="border-border/70 border-b bg-muted/30">
                  <td className="px-4 py-3">
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="New category name"
                      autoFocus
                      disabled={saving}
                    />
                    {error ? <p className="text-destructive mt-1 text-xs">{error}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={saveCategory} disabled={saving}>
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={cancelAdd} disabled={saving}>
                        Cancel
                      </Button>
                      {saving ? <span className="text-muted-foreground text-xs">Saving…</span> : null}
                    </div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {!adding ? (
          <div className="px-4 py-3">
            <Button variant="ghost" size="sm" className="gap-2 px-0" onClick={startAdd}>
              <Plus className="h-4 w-4" />
              Add a new category
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
