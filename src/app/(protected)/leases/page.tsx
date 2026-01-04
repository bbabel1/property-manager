'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Search } from 'lucide-react';

import { Cluster, PageBody, PageHeader, PageShell, Stack } from '@/components/layout/page-shell';
import AddLeaseForm from '@/components/leases/AddLeaseModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type LeaseListItem = {
  id: number;
  status: string;
  lease_from_date: string;
  lease_to_date: string | null;
  rent_amount: number | null;
  balance?: number;
  tenant_name?: string | null;
  property_id?: string | null;
  property_name?: string | null;
  property_address_line1?: string | null;
  property_city?: string | null;
  property_state?: string | null;
  property_postal_code?: string | null;
  unit_id?: string | null;
  unit_number?: string | null;
  unit_name?: string | null;
};

const formatCurrency = (amount: number | null | undefined) => {
  if (amount == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatDateRange = (from: string | null | undefined, to: string | null | undefined) => {
  const start = formatDate(from);
  const end = to ? formatDate(to) : 'Present';
  return `${start} – ${end}`;
};

const statusBadgeClass = (status: string | null | undefined) => {
  const normalized = normalizeStatusLabel(status).toLowerCase();
  if (normalized === 'active') {
    return 'status-pill border-[var(--color-success-500)] bg-[var(--color-success-50)] text-[var(--color-success-700)]';
  }
  if (normalized === 'future' || normalized === 'renewal') {
    return 'status-pill border-sky-200 bg-sky-50 text-sky-700';
  }
  if (normalized === 'past' || normalized === 'expired') {
    return 'status-pill border-slate-300 bg-slate-100 text-slate-700';
  }
  if (normalized === 'cancelled' || normalized === 'terminated') {
    return 'status-pill border-rose-200 bg-rose-50 text-rose-700';
  }
  return 'status-pill border-amber-200 bg-amber-50 text-amber-700';
};

const normalizeStatusLabel = (status: string | null | undefined) => {
  if (!status) return 'Unknown';
  return status
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
};

export default function LeasesPage() {
  const router = useRouter();
  const [leases, setLeases] = useState<LeaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All statuses');
  const [showAddForm, setShowAddForm] = useState(false);

  const loadLeases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/leases', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch leases');
      const data = await response.json();
      setLeases(Array.isArray(data) ? data : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load leases';
      setError(message);
      setLeases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeases();
  }, [loadLeases]);

  const statusOptions = useMemo(() => {
    const unique = new Set<string>();
    leases.forEach((lease) => {
      if (lease.status) unique.add(normalizeStatusLabel(lease.status));
    });
    return Array.from(unique).sort();
  }, [leases]);

  const filteredLeases = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return leases.filter((lease) => {
      const matchesStatus =
        statusFilter === 'All statuses' ||
        normalizeStatusLabel(lease.status).toLowerCase() === statusFilter.toLowerCase();

      if (!matchesStatus) return false;
      if (!query) return true;

      const candidateValues = [
        lease.property_name,
        lease.tenant_name,
        lease.unit_number,
        lease.unit_name,
        lease.property_address_line1,
        lease.property_city,
        lease.property_state,
        lease.status,
        lease.id ? String(lease.id) : null,
      ];

      return candidateValues.some((value) =>
        typeof value === 'string' ? value.toLowerCase().includes(query) : false,
      );
    });
  }, [leases, searchTerm, statusFilter]);

  const handleRowClick = (leaseId: number) => {
    router.push(`/leases/${leaseId}`);
  };

  const propertyAddress = (lease: LeaseListItem) => {
    const cityState = [lease.property_city, lease.property_state].filter(Boolean).join(', ');
    return [lease.property_address_line1, cityState].filter(Boolean).join(' • ');
  };

  return (
    <PageShell>
      <PageHeader
        title="Leases"
        description="Monitor active leases, renewal opportunities, and tenancy details in one place."
        actions={
          showAddForm ? (
            <Button variant="outline" onClick={() => setShowAddForm(false)}>
              Cancel
            </Button>
          ) : (
            <Button className="flex items-center gap-2" onClick={() => setShowAddForm(true)}>
              <Plus className="h-4 w-4" />
              Add Lease
            </Button>
          )
        }
      />
      <PageBody>
        <Stack gap="lg">
          {showAddForm ? (
            <AddLeaseForm
              onCancel={() => setShowAddForm(false)}
              onSuccess={() => {
                loadLeases();
                setShowAddForm(false);
              }}
            />
          ) : (
            <Card className="overflow-hidden">
              <Stack gap="md" className="px-6 py-4">
                <Stack gap="sm" className="sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative w-full sm:max-w-sm">
                    <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search leases..."
                      className="pl-9"
                    />
                  </div>
                  <Cluster gap="sm" className="w-full sm:w-auto" align="center" justify="end" wrap={false}>
                    <label className="sr-only" htmlFor="leases-status-filter">
                      Filter leases by status
                    </label>
                    <select
                      id="leases-status-filter"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value)}
                      className="border-input bg-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 sm:w-48"
                    >
                      <option>All statuses</option>
                      {statusOptions.map((option) => (
                        <option key={option}>{option}</option>
                      ))}
                    </select>
                  </Cluster>
                </Stack>
              </Stack>
              <div className="border-b px-6 py-3 text-sm text-muted-foreground">
                {loading
                  ? 'Loading leases…'
                  : `Showing ${filteredLeases.length} lease${filteredLeases.length === 1 ? '' : 's'}`}
              </div>
              <div className="px-6 py-4">
                {loading ? (
                  <Stack gap="sm" align="center" className="py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Loading leases…</span>
                  </Stack>
                ) : error ? (
                  <Stack gap="sm" align="center" className="py-12 text-center">
                    <p className="text-destructive text-sm">{error}</p>
                    <Button onClick={loadLeases} className="mt-1">
                      Try Again
                    </Button>
                  </Stack>
                ) : filteredLeases.length === 0 ? (
                  <Stack gap="sm" align="center" className="py-12 text-center text-muted-foreground">
                    <p className="text-sm">
                      {leases.length === 0
                        ? 'No leases found. Start by adding your first lease.'
                        : 'No leases match the current filters.'}
                    </p>
                  </Stack>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Term</TableHead>
                        <TableHead>Rent</TableHead>
                        <TableHead>Lease Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeases.map((lease) => (
                        <TableRow
                          key={lease.id}
                          onClick={() => handleRowClick(lease.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleRowClick(lease.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer"
                        >
                          <TableCell>
                            <div className="text-foreground font-medium">
                              {lease.property_name ?? 'Unknown property'}
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {lease.unit_number ? `Unit ${lease.unit_number}` : lease.unit_name || '—'}
                            </div>
                            {propertyAddress(lease) ? (
                              <div className="text-muted-foreground text-xs">{propertyAddress(lease)}</div>
                            ) : null}
                          </TableCell>
                          <TableCell className="align-middle">
                            {lease.tenant_name ? (
                              <span className="text-foreground">{lease.tenant_name}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={statusBadgeClass(lease.status)}>
                              {normalizeStatusLabel(lease.status)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDateRange(lease.lease_from_date, lease.lease_to_date)}
                          </TableCell>
                          <TableCell>{formatCurrency(lease.rent_amount)}</TableCell>
                          <TableCell>{formatCurrency(lease.balance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </Card>
          )}
        </Stack>
      </PageBody>
    </PageShell>
  );
}
