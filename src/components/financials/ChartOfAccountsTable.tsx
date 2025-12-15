'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import type { Database } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/components/ui/utils';

type GLAccount = Database['public']['Tables']['gl_accounts']['Row'];

type ApiResponse =
  | { success: true; data: GLAccount[] }
  | { success?: false; error?: string; data?: GLAccount[] };

const placeholder = '—';

function normalizeType(value?: string | null) {
  return value && value.trim().length ? value : 'Other';
}

function formatBoolean(value: boolean | null | undefined) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return placeholder;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return placeholder;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? placeholder : date.toLocaleString();
}

export function ChartOfAccountsTable() {
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [search, setSearch] = useState('');
  const [showAccountNumbers, setShowAccountNumbers] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<GLAccount | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState({
    name: '',
    account_number: '',
    type: '',
    sub_type: '',
    default_account_name: '',
    cash_flow_classification: '',
    description: '',
    is_active: true,
    exclude_from_cash_balances: false,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [buildiumSyncNote, setBuildiumSyncNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/gl-accounts', { cache: 'no-store' });
        const payload = (await res.json()) as ApiResponse;
        if (cancelled) return;
        if (!res.ok || (payload as any)?.error) {
          throw new Error((payload as any)?.error || 'Failed to load accounts');
        }
        const data = Array.isArray(payload?.data) ? payload.data : [];
        setAccounts(data);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load accounts';
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const accountTypes = useMemo(() => {
    const types = new Set<string>();
    accounts.forEach((account) => {
      const normalized = normalizeType(account.type);
      types.add(normalized);
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [accounts]);

  const relationships = useMemo(() => {
    const parentByChild = new Map<string, GLAccount>();
    const childrenByParent = new Map<string, GLAccount[]>();
    const byBuildiumId = new Map<number, GLAccount>();

    accounts.forEach((account) => {
      if (typeof account.buildium_gl_account_id === 'number') {
        byBuildiumId.set(account.buildium_gl_account_id, account);
      }
    });

    accounts.forEach((account) => {
      const childIds = Array.isArray(account.sub_accounts) ? account.sub_accounts.filter(Boolean) : [];
      if (childIds.length) {
        const children = childIds
          .map((id) => accounts.find((candidate) => candidate.id === id))
          .filter(Boolean) as GLAccount[];
        if (children.length) {
          childrenByParent.set(account.id, children);
          children.forEach((child) => parentByChild.set(child.id, account));
        }
      }

      if (account.buildium_parent_gl_account_id && !parentByChild.has(account.id)) {
        const parent = byBuildiumId.get(account.buildium_parent_gl_account_id);
        if (parent) {
          parentByChild.set(account.id, parent);
          const existing = childrenByParent.get(parent.id) || [];
          if (!existing.some((item) => item.id === account.id)) {
            childrenByParent.set(parent.id, [...existing, account]);
          }
        }
      }
    });

    return { parentByChild, childrenByParent };
  }, [accounts]);

  useEffect(() => {
    if (selectedAccount) {
      setIsEditing(false);
      setEditState({
        name: selectedAccount.name || '',
        account_number: selectedAccount.account_number || '',
        type: selectedAccount.type || '',
        sub_type: selectedAccount.sub_type || '',
        default_account_name: selectedAccount.default_account_name || '',
        cash_flow_classification: selectedAccount.cash_flow_classification || '',
        description: selectedAccount.description || '',
        is_active: selectedAccount.is_active !== false,
        exclude_from_cash_balances: selectedAccount.exclude_from_cash_balances ?? false,
      });
      setSaveError(null);
      setBuildiumSyncNote(null);
    }
  }, [selectedAccount]);

  const filteredAccounts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return accounts
      .filter((account) => {
        if (statusFilter === 'active') return account.is_active !== false;
        if (statusFilter === 'inactive') return account.is_active === false;
        return true;
      })
      .filter((account) => {
        if (typeFilter === 'all') return true;
        return normalizeType(account.type) === typeFilter;
      })
      .filter((account) => {
        if (!query) return true;
        const haystack = [
          account.name,
          account.account_number,
          account.type,
          account.sub_type,
          account.default_account_name,
          account.cash_flow_classification,
          account.description,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const typeCompare = normalizeType(a.type).localeCompare(normalizeType(b.type));
        if (typeCompare !== 0) return typeCompare;
        return a.name.localeCompare(b.name);
      });
  }, [accounts, search, statusFilter, typeFilter]);

  const statusLabel = statusFilter === 'all' ? 'All' : statusFilter === 'active' ? 'Active' : 'Inactive';

  async function handleSave() {
    if (!selectedAccount) return;
    setSaving(true);
    setSaveError(null);
    setBuildiumSyncNote(null);

    const payload: Record<string, unknown> = {};
    const stringOrNull = (value: string) => {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    };

    if (editState.name.trim() && editState.name.trim() !== selectedAccount.name) {
      payload.name = editState.name.trim();
    }
    if (stringOrNull(editState.account_number) !== (selectedAccount.account_number ?? null)) {
      payload.account_number = stringOrNull(editState.account_number);
    }
    if (stringOrNull(editState.description) !== (selectedAccount.description ?? null)) {
      payload.description = stringOrNull(editState.description);
    }
    if (editState.type.trim() && editState.type.trim() !== (selectedAccount.type || '')) {
      payload.type = editState.type.trim();
    }
    if (stringOrNull(editState.sub_type) !== (selectedAccount.sub_type ?? null)) {
      payload.sub_type = stringOrNull(editState.sub_type);
    }
    if (stringOrNull(editState.default_account_name) !== (selectedAccount.default_account_name ?? null)) {
      payload.default_account_name = stringOrNull(editState.default_account_name);
    }
    if (
      stringOrNull(editState.cash_flow_classification) !==
      (selectedAccount.cash_flow_classification ?? null)
    ) {
      payload.cash_flow_classification = stringOrNull(editState.cash_flow_classification);
    }
    const currentActive = selectedAccount.is_active !== false;
    if (editState.is_active !== currentActive || selectedAccount.is_active === null) {
      payload.is_active = editState.is_active;
    }
    const currentExclude = selectedAccount.exclude_from_cash_balances ?? false;
    if (editState.exclude_from_cash_balances !== currentExclude) {
      payload.exclude_from_cash_balances = editState.exclude_from_cash_balances;
    }

    if (Object.keys(payload).length === 0) {
      setSaving(false);
      setSaveError('No changes to save');
      return;
    }

    try {
      const res = await fetch(`/api/gl-accounts/${selectedAccount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok || json?.success === false) {
        const message = json?.error || 'Failed to save changes';
        throw new Error(message);
      }

      const updated: GLAccount | undefined = json?.data;
      if (updated?.id) {
        setAccounts((prev) => prev.map((acc) => (acc.id === updated.id ? updated : acc)));
        setSelectedAccount(updated);
        setIsEditing(false);
      }

      if (json?.buildiumSync?.success === false) {
        setBuildiumSyncNote(json.buildiumSync.error || 'Saved, but failed to sync to Buildium.');
      } else if (json?.buildiumSync?.skipped) {
        setBuildiumSyncNote('Saved locally. Buildium integration is disabled for this organization.');
      } else if (json?.buildiumSync?.success) {
        setBuildiumSyncNote('Saved and synced to Buildium.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save changes';
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="gap-4 space-y-4 md:flex md:items-center md:justify-between md:space-y-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-1">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="md:w-52">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">All accounts</SelectItem>
              {accountTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger className="md:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-full md:w-64">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search accounts"
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={showAccountNumbers}
              onCheckedChange={setShowAccountNumbers}
              aria-label="Show account numbers"
            />
            Show account numbers
          </label>
          <div className="text-muted-foreground text-sm">
            Showing{' '}
            <span className="text-foreground font-medium">{filteredAccounts.length}</span>{' '}
            {statusLabel.toLowerCase()} account{filteredAccounts.length === 1 ? '' : 's'}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 px-6 py-8 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading accounts…
          </div>
        ) : error ? (
          <div className="text-destructive px-6 py-8 text-sm">{error}</div>
        ) : filteredAccounts.length === 0 ? (
          <div className="text-muted-foreground px-6 py-10 text-sm">
            No accounts match your filters.
          </div>
        ) : (
          <Table className="divide-border min-w-full divide-y">
            <TableHeader className="[&_th]:px-6 [&_th]:py-3">
              <TableRow>
                <TableHead className="w-[22%]">Name</TableHead>
                <TableHead className="w-[16%]">Type</TableHead>
                <TableHead className="w-[18%]">Hierarchy</TableHead>
                <TableHead className="w-[16%]">Default account for</TableHead>
                <TableHead className="w-[16%]">Cash flow classification</TableHead>
                <TableHead className="w-[18%]">Notes</TableHead>
                <TableHead className="w-[10%]" />
              </TableRow>
            </TableHeader>
            <TableBody className="bg-card divide-border divide-y [&_td]:px-6 [&_td]:py-3">
              {filteredAccounts.map((account) => {
                const typeLabel = normalizeType(account.type);
                const secondaryType = account.sub_type && account.sub_type !== account.type;
                const showInactive = account.is_active === false;
                const parentAccount = relationships.parentByChild.get(account.id);
                const childAccounts = relationships.childrenByParent.get(account.id) || [];
                const childNamesPreview = childAccounts.slice(0, 3).map((child) => child.name).join(', ');
                const hasMoreChildren = childAccounts.length > 3;

                return (
                  <TableRow key={account.id} className="hover:bg-muted/40 transition-colors">
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-foreground font-medium">{account.name}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          {showAccountNumbers && account.account_number ? (
                            <span className="text-muted-foreground text-xs">
                              Acct #{account.account_number}
                            </span>
                          ) : null}
                          {showInactive ? (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                              Inactive
                            </Badge>
                          ) : null}
                          {!showInactive && account.is_active ? (
                            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                              Active
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-foreground text-sm">{typeLabel}</span>
                        {secondaryType ? (
                          <span className="text-muted-foreground text-xs">{account.sub_type}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {parentAccount || childAccounts.length ? (
                        <div className="flex flex-col gap-1">
                          {parentAccount ? (
                            <span className="font-medium text-foreground">Subaccount of {parentAccount.name}</span>
                          ) : null}
                          {childAccounts.length ? (
                            <>
                              <span className="font-medium text-foreground">
                                Parent of {childAccounts.length} subaccount{childAccounts.length === 1 ? '' : 's'}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                {childNamesPreview}
                                {hasMoreChildren ? '…' : ''}
                              </span>
                            </>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Standalone</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {account.default_account_name || placeholder}
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {account.cash_flow_classification || placeholder}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-sm',
                        account.description ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {account.description || placeholder}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedAccount(account);
                          setDetailsOpen(true);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setSelectedAccount(null);
            setIsEditing(false);
            setBuildiumSyncNote(null);
            setSaveError(null);
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          {selectedAccount ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-col gap-1">
                  <span className="text-xl font-semibold">{selectedAccount.name}</span>
                  <span className="text-muted-foreground text-sm">
                    {selectedAccount.account_number ? `Acct #${selectedAccount.account_number} · ` : ''}
                    {normalizeType(selectedAccount.type)}
                    {selectedAccount.sub_type && selectedAccount.sub_type !== selectedAccount.type
                      ? ` • ${selectedAccount.sub_type}`
                      : ''}
                  </span>
                </DialogTitle>
              </DialogHeader>

              {saveError ? <div className="text-destructive text-sm">{saveError}</div> : null}
              {buildiumSyncNote ? <div className="text-muted-foreground text-sm">{buildiumSyncNote}</div> : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Name</span>
                  <Input
                    disabled={!isEditing}
                    value={editState.name}
                    onChange={(e) => setEditState((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Account number</span>
                  <Input
                    disabled={!isEditing}
                    value={editState.account_number}
                    onChange={(e) =>
                      setEditState((prev) => ({ ...prev, account_number: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Type</span>
                  <Input
                    disabled={!isEditing}
                    value={editState.type}
                    onChange={(e) => setEditState((prev) => ({ ...prev, type: e.target.value }))}
                    placeholder="e.g. Expense"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Sub-type</span>
                  <Input
                    disabled={!isEditing}
                    value={editState.sub_type}
                    onChange={(e) => setEditState((prev) => ({ ...prev, sub_type: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">Default account for</span>
                  <Input
                    disabled={!isEditing}
                    value={editState.default_account_name}
                    onChange={(e) =>
                      setEditState((prev) => ({ ...prev, default_account_name: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">
                    Cash flow classification
                  </span>
                  <Input
                    disabled={!isEditing}
                    value={editState.cash_flow_classification}
                    onChange={(e) =>
                      setEditState((prev) => ({ ...prev, cash_flow_classification: e.target.value }))
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/30 p-3">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">Active</span>
                    <span className="text-sm text-foreground">Enable/disable this account</span>
                  </div>
                  <Switch
                    disabled={!isEditing}
                    checked={editState.is_active}
                    onCheckedChange={(checked) => setEditState((prev) => ({ ...prev, is_active: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/30 p-3">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs uppercase tracking-wide">
                      Exclude from cash balances
                    </span>
                    <span className="text-sm text-foreground">Hide from cash balance rollups</span>
                  </div>
                  <Switch
                    disabled={!isEditing}
                    checked={editState.exclude_from_cash_balances}
                    onCheckedChange={(checked) =>
                      setEditState((prev) => ({ ...prev, exclude_from_cash_balances: checked }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Notes</span>
                <Textarea
                  disabled={!isEditing}
                  value={editState.description}
                  onChange={(e) => setEditState((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional notes"
                  rows={4}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                {[
                  { label: 'Hierarchy', value: null },
                  { label: 'Security deposit liability', value: formatBoolean(selectedAccount.is_security_deposit_liability) },
                  { label: 'Bank account', value: formatBoolean(selectedAccount.is_bank_account) },
                  { label: 'Credit card account', value: formatBoolean(selectedAccount.is_credit_card_account) },
                  { label: 'Contra account', value: formatBoolean(selectedAccount.is_contra_account) },
                  { label: 'Default GL account', value: formatBoolean(selectedAccount.is_default_gl_account) },
                  { label: 'Buildium account ID', value: selectedAccount.buildium_gl_account_id || placeholder },
                  { label: 'Buildium parent account ID', value: selectedAccount.buildium_parent_gl_account_id || placeholder },
                  { label: 'Organization', value: selectedAccount.org_id || placeholder },
                  { label: 'Internal ID', value: selectedAccount.id },
                  { label: 'Updated at', value: formatDateTime(selectedAccount.updated_at) },
                  { label: 'Created at', value: formatDateTime(selectedAccount.created_at) },
                ].map((item) => {
                  if (item.label === 'Hierarchy') {
                    const parent = relationships.parentByChild.get(selectedAccount.id);
                    const children = relationships.childrenByParent.get(selectedAccount.id) || [];

                    return (
                      <div key={item.label} className="flex flex-col gap-1 rounded-md border border-border/70 bg-muted/30 p-3">
                        <span className="text-muted-foreground text-xs uppercase tracking-wide">{item.label}</span>
                        <div className="text-sm text-foreground">
                          {parent || children.length ? (
                            <div className="flex flex-col gap-2">
                              {parent ? <span>Subaccount of {parent.name}</span> : null}
                              {children.length ? (
                                <div className="flex flex-col gap-2">
                                  <span>
                                    Parent of {children.length} subaccount{children.length === 1 ? '' : 's'}
                                  </span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {children.map((child) => (
                                      <Badge key={child.id} variant="secondary" className="bg-muted text-foreground">
                                        {child.name}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Standalone</span>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={item.label} className="flex flex-col gap-1 rounded-md border border-border/70 bg-muted/30 p-3">
                      <span className="text-muted-foreground text-xs uppercase tracking-wide">{item.label}</span>
                      <span className="text-sm text-foreground">{item.value ?? placeholder}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2">
                {isEditing ? (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        if (selectedAccount) {
                          setEditState({
                            name: selectedAccount.name || '',
                            account_number: selectedAccount.account_number || '',
                            type: selectedAccount.type || '',
                            sub_type: selectedAccount.sub_type || '',
                            default_account_name: selectedAccount.default_account_name || '',
                            cash_flow_classification: selectedAccount.cash_flow_classification || '',
                            description: selectedAccount.description || '',
                            is_active: selectedAccount.is_active !== false,
                            exclude_from_cash_balances: selectedAccount.exclude_from_cash_balances ?? false,
                          });
                        }
                        setIsEditing(false);
                        setSaveError(null);
                        setBuildiumSyncNote(null);
                      }}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving || !editState.name.trim()}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Save changes
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setDetailsOpen(false)} disabled={saving}>
                      Close
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsEditing(true);
                        setBuildiumSyncNote(null);
                      }}
                    >
                      Edit
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="text-muted-foreground text-sm">Select an account to view details.</div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default ChartOfAccountsTable;
