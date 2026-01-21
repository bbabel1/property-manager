'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, Mail, MoreHorizontal, Phone, Search } from 'lucide-react';

import type { VendorInsight } from '@/lib/vendor-service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TableRowLink } from '@/components/ui/table-row-link';

type VendorsTableProps = {
  vendors: VendorInsight[];
  categories: string[];
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

function normalizeDate(value?: string | null): Date | null {
  if (!value) return null;
  const isoLike = value.includes('T') ? value : `${value}T00:00:00Z`;
  const date = new Date(isoLike);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatInsurance(value?: string | null): string {
  const date = normalizeDate(value);
  return date ? `Expires: ${dateFormatter.format(date)}` : 'No record';
}

const emptyPlaceholder = '—';

const STATUS_PILL_STYLES = {
  active: 'status-pill-success',
  inactive: 'status-pill-danger',
};

const COMPLIANCE_BADGE_VARIANT: Record<
  NonNullable<VendorInsight['complianceStatus']>,
  'outline' | 'destructive' | null
> = {
  ok: null,
  expiring: 'outline',
  expired: 'destructive',
  missing: 'destructive',
};

export function VendorsTable({ vendors, categories }: VendorsTableProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const filteredVendors = useMemo(() => {
    const query = search.trim().toLowerCase();
    return vendors
      .filter((vendor) => {
        if (category !== 'all') {
          return (vendor.categoryName ?? '').toLowerCase() === category.toLowerCase();
        }
        return true;
      })
      .filter((vendor) => {
        if (!query) return true;
        const haystack = [
          vendor.displayName,
          vendor.companyName,
          vendor.categoryName,
          vendor.contactEmail,
          vendor.contactPhone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [vendors, category, search]);

  return (
    <Card>
      <CardHeader className="gap-4 space-y-4 md:flex md:items-center md:justify-between md:space-y-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:w-72">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search vendors..."
              className="pl-9"
            />
          </div>
          <Select value={category} onValueChange={(value) => setCategory(value)}>
            <SelectTrigger className="md:w-48">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-muted-foreground text-sm">
          Showing <span className="text-foreground font-medium">{filteredVendors.length}</span>{' '}
          vendor{filteredVendors.length === 1 ? '' : 's'}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredVendors.length > 0 ? (
          <Table className="divide-border min-w-full divide-y">
            <TableHeader className="[&_th]:px-6 [&_th]:py-3">
              <TableRow>
                <TableHead className="w-[26%]">Vendor</TableHead>
                <TableHead className="w-[14%]" aria-label="Category" />
                <TableHead className="w-[18%]">Position</TableHead>
                <TableHead className="w-[24%]">Contact Info</TableHead>
                <TableHead className="w-[18%]">Insurance</TableHead>
                <TableHead className="w-[12%]">Status</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-card divide-border divide-y [&_td]:px-6 [&_td]:py-4">
              {filteredVendors.map((vendor) => {
                const insurance = formatInsurance(vendor.insuranceExpirationDate);
                const statusLabel = vendor.isActive ? 'Active' : 'Inactive';
                const statusClass = vendor.isActive
                  ? STATUS_PILL_STYLES.active
                  : STATUS_PILL_STYLES.inactive;
                const complianceVariant =
                  vendor.complianceStatus && vendor.complianceStatus !== 'ok'
                    ? COMPLIANCE_BADGE_VARIANT[vendor.complianceStatus]
                    : null;

                return (
                  <TableRowLink
                    key={vendor.id}
                    href={`/vendors/${vendor.id}`}
                    className="group hover:bg-muted/40 transition-colors"
                  >
                    <TableCell>
                      <div className="space-y-1.5">
                        <span className="text-foreground group-hover:text-primary font-medium transition-colors group-hover:underline">
                          {vendor.displayName}
                        </span>
                        <p className="text-muted-foreground text-sm">
                          {vendor.companyName || emptyPlaceholder}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="pl-0 align-middle">
                      {vendor.categoryName ? (
                        <Badge className="bg-primary/10 text-primary border-primary/20 border">
                          {vendor.categoryName}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">{emptyPlaceholder}</span>
                      )}
                    </TableCell>
                    <TableCell className="align-middle">
                      <span className="text-foreground text-sm">
                        {vendor.categoryName || emptyPlaceholder}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-muted-foreground flex flex-col gap-2 text-sm">
                        {vendor.contactPhone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="text-muted-foreground h-4 w-4" />
                            <span className="text-foreground">{vendor.contactPhone}</span>
                          </div>
                        ) : null}
                        {vendor.contactEmail ? (
                          <div className="flex items-center gap-2">
                            <Mail className="text-muted-foreground h-4 w-4" />
                            <span className="text-foreground">{vendor.contactEmail}</span>
                          </div>
                        ) : null}
                        {!vendor.contactPhone && !vendor.contactEmail ? (
                          <span className="text-foreground">{emptyPlaceholder}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-muted-foreground flex flex-col gap-1 text-sm">
                        <div className="text-foreground flex items-center gap-2">
                          <CalendarDays className="text-muted-foreground h-4 w-4" />
                          <span>{insurance}</span>
                        </div>
                        {complianceVariant ? (
                          <Badge
                            variant={complianceVariant}
                            className={`w-max ${
                              vendor.complianceStatus === 'expiring'
                                ? 'border-amber-600 bg-amber-50 text-amber-700'
                                : ''
                            }`}
                          >
                            {vendor.complianceStatus === 'expiring'
                              ? 'Expiring'
                              : vendor.complianceStatus === 'expired'
                                ? 'Expired'
                                : 'Missing COI'}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`status-pill ${statusClass}`}>
                        {statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <MoreHorizontal className="h-5 w-5" />
                        <span className="sr-only">Open vendor actions</span>
                      </Button>
                    </TableCell>
                  </TableRowLink>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-muted-foreground flex items-center justify-center p-12 text-sm">
            No vendors match your filters.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
