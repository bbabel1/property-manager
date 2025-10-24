'use client'

import { useMemo, useState } from 'react'
import { CalendarDays, Mail, MoreHorizontal, Phone, Search } from 'lucide-react'

import type { VendorInsight } from '@/lib/vendor-service'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableRowLink } from '@/components/ui/table-row-link'
import { cn } from '@/components/ui/utils'

type VendorsTableProps = {
  vendors: VendorInsight[]
  categories: string[]
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
})

function normalizeDate(value?: string | null): Date | null {
  if (!value) return null
  const isoLike = value.includes('T') ? value : `${value}T00:00:00`
  const date = new Date(isoLike)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatInsurance(value?: string | null): string {
  const date = normalizeDate(value)
  return date ? `Expires: ${dateFormatter.format(date)}` : 'No record'
}

const emptyPlaceholder = '—'

export function VendorsTable({ vendors, categories }: VendorsTableProps) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string>('all')

  const filteredVendors = useMemo(() => {
    const query = search.trim().toLowerCase()
    return vendors
      .filter((vendor) => {
        if (category !== 'all') {
          return (vendor.categoryName ?? '').toLowerCase() === category.toLowerCase()
        }
        return true
      })
      .filter((vendor) => {
        if (!query) return true
        const haystack = [
          vendor.displayName,
          vendor.companyName,
          vendor.categoryName,
          vendor.contactEmail,
          vendor.contactPhone,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(query)
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
  }, [vendors, category, search])

  return (
    <Card>
      <CardHeader className="gap-4 space-y-4 md:flex md:items-center md:justify-between md:space-y-0">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:w-72">
            <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
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
        <div className="text-sm text-muted-foreground">
          Showing{' '}
          <span className="font-medium text-foreground">
            {filteredVendors.length}
          </span>{' '}
          vendor{filteredVendors.length === 1 ? '' : 's'}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filteredVendors.length > 0 ? (
          <Table className="min-w-full divide-y divide-border">
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead className="w-[26%]">Vendor</TableHead>
                <TableHead className="w-[14%] pl-0" aria-label="Category" />
                <TableHead className="w-[18%]">Position</TableHead>
                <TableHead className="w-[24%]">Contact Info</TableHead>
                <TableHead className="w-[18%]">Insurance</TableHead>
                <TableHead className="w-[12%]">Status</TableHead>
                <TableHead className="w-12 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-card divide-y divide-border">
              {filteredVendors.map((vendor) => {
                const insurance = formatInsurance(vendor.insuranceExpirationDate)
                const statusLabel = vendor.isActive ? 'Active' : 'Inactive'
                const statusClass = vendor.isActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600 border border-slate-200'

                return (
                  <TableRowLink
                    key={vendor.id}
                    href={`/vendors/${vendor.id}`}
                    className="group hover:bg-muted/40 transition-colors"
                  >
                    <TableCell>
                      <div className="space-y-1.5">
                        <span className="font-medium text-foreground transition-colors group-hover:text-primary group-hover:underline">
                          {vendor.displayName}
                        </span>
                        <p className="text-sm text-muted-foreground">
                          {vendor.companyName || emptyPlaceholder}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="align-middle pl-0">
                      {vendor.categoryName ? (
                        <Badge className="bg-primary/10 text-primary border border-primary/20">
                          {vendor.categoryName}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">{emptyPlaceholder}</span>
                      )}
                    </TableCell>
                    <TableCell className="align-middle">
                      <span className="text-sm text-foreground">
                        {vendor.categoryName || emptyPlaceholder}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                        {vendor.contactPhone ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{vendor.contactPhone}</span>
                          </div>
                        ) : null}
                        {vendor.contactEmail ? (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{vendor.contactEmail}</span>
                          </div>
                        ) : null}
                        {!vendor.contactPhone && !vendor.contactEmail ? (
                          <span className="text-foreground">{emptyPlaceholder}</span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2 text-foreground">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          <span>{insurance}</span>
                        </div>
                        {vendor.complianceStatus && vendor.complianceStatus !== 'ok' ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              'w-max border-amber-200 bg-amber-50 text-amber-700',
                              vendor.complianceStatus === 'expired' && 'border-red-200 bg-red-50 text-red-700',
                              vendor.complianceStatus === 'missing' && 'border-slate-200 bg-slate-100 text-slate-600'
                            )}
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
                      <Badge variant="outline" className={statusClass}>
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
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
            No vendors match your filters.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
