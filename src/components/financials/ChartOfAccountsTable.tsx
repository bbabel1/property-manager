'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';

import type { Database } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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

type GLAccount = Pick<
  Database['public']['Tables']['gl_accounts']['Row'],
  | 'id'
  | 'name'
  | 'type'
  | 'sub_type'
  | 'account_number'
  | 'default_account_name'
  | 'cash_flow_classification'
  | 'description'
  | 'is_active'
>;

type ApiResponse =
  | { success: true; data: GLAccount[] }
  | { success?: false; error?: string; data?: GLAccount[] };

const placeholder = '—';

function normalizeType(value?: string | null) {
  return value && value.trim().length ? value : 'Other';
}

export function ChartOfAccountsTable() {
  const [accounts, setAccounts] = useState<GLAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [search, setSearch] = useState('');
  const [showAccountNumbers, setShowAccountNumbers] = useState(false);

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
                <TableHead className="w-[24%]">Name</TableHead>
                <TableHead className="w-[20%]">Type</TableHead>
                <TableHead className="w-[18%]">Default account for</TableHead>
                <TableHead className="w-[20%]">Cash flow classification</TableHead>
                <TableHead className="w-[18%]">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-card divide-border divide-y [&_td]:px-6 [&_td]:py-3">
              {filteredAccounts.map((account) => {
                const typeLabel = normalizeType(account.type);
                const secondaryType = account.sub_type && account.sub_type !== account.type;
                const showInactive = account.is_active === false;
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
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default ChartOfAccountsTable;
