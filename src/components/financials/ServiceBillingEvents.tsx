'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/format-currency';
import Link from 'next/link';
import { Receipt, ExternalLink, X, CheckCircle } from 'lucide-react';

interface BillingEvent {
  id: string;
  property_id: string;
  unit_id: string | null;
  offering_id: string;
  offering_name: string;
  plan_id: string | null;
  period_start: string;
  period_end: string;
  amount: number;
  source_basis: string;
  rent_basis: string | null;
  rent_amount: number | null;
  calculated_at: string;
  invoiced_at: string | null;
  transaction_id: string | null;
}

interface ServiceBillingEventsProps {
  propertyId: string;
  unitId?: string;
}

export default function ServiceBillingEvents({ propertyId, unitId }: ServiceBillingEventsProps) {
  const [events, setEvents] = useState<BillingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterOffering, setFilterOffering] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'invoiced' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadEvents();
  }, [propertyId, unitId, filterOffering, filterStatus]);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ propertyId });
      if (unitId) params.append('unitId', unitId);
      if (filterOffering !== 'all') params.append('offeringId', filterOffering);
      if (filterStatus === 'invoiced') params.append('invoiced', 'true');
      if (filterStatus === 'pending') params.append('invoiced', 'false');

      const response = await fetch(`/api/services/billing-events?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load billing events');
      }

      setEvents(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing events');
    } finally {
      setLoading(false);
    }
  };

  const handleVoidEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to void this billing event?')) return;

    try {
      const response = await fetch(`/api/services/billing-events/${eventId}/void`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to void billing event');
      }

      loadEvents();
    } catch (err) {
      console.error('Error voiding event:', err);
      alert('Failed to void billing event');
    }
  };

  const filteredEvents = events.filter((event) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        event.offering_name.toLowerCase().includes(searchLower) ||
        event.period_start.toLowerCase().includes(searchLower) ||
        event.source_basis.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const uniqueOfferings = Array.from(new Set(events.map((e) => e.offering_id))).map((id) => {
    const event = events.find((e) => e.offering_id === id);
    return { id, name: event?.offering_name || 'Unknown' };
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Loading billing events...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-destructive text-center">{error}</div>
          <div className="mt-4 text-center">
            <Button onClick={loadEvents} variant="outline">
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalAmount = filteredEvents.reduce((sum, e) => sum + e.amount, 0);
  const invoicedAmount = filteredEvents
    .filter((e) => e.invoiced_at)
    .reduce((sum, e) => sum + e.amount, 0);
  const pendingAmount = totalAmount - invoicedAmount;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalAmount)}</div>
            <p className="text-muted-foreground text-xs">{filteredEvents.length} events</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(invoicedAmount)}</div>
            <p className="text-muted-foreground text-xs">
              {filteredEvents.filter((e) => e.invoiced_at).length} events
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(pendingAmount)}</div>
            <p className="text-muted-foreground text-xs">
              {filteredEvents.filter((e) => !e.invoiced_at).length} events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Billing Events</CardTitle>
          <CardDescription>
            Service fee billing events and their associated transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Input
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filterOffering} onValueChange={setFilterOffering}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Services" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {uniqueOfferings.map((offering) => (
                  <SelectItem key={offering.id} value={offering.id}>
                    {offering.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
              No billing events found for the selected filters.
            </div>
          ) : (
            <div className="border-border overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Basis</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        <div className="text-sm">
                          <div>{new Date(event.period_start).toLocaleDateString()}</div>
                          <div className="text-muted-foreground text-xs">
                            to {new Date(event.period_end).toLocaleDateString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{event.offering_name}</div>
                        {event.plan_id && (
                          <div className="text-muted-foreground text-xs">Plan: {event.plan_id}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{event.source_basis}</Badge>
                        {event.rent_basis && (
                          <div className="text-muted-foreground mt-1 text-xs">
                            Rent: {event.rent_basis}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{formatCurrency(event.amount)}</TableCell>
                      <TableCell>
                        {event.invoiced_at ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Invoiced
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {event.transaction_id ? (
                          <Link
                            href={`/transactions/${event.transaction_id}`}
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            View
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!event.invoiced_at && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVoidEvent(event.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
