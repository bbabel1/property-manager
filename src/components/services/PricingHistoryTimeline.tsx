'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format-currency';
import { Calendar, DollarSign } from 'lucide-react';

interface PricingHistoryEntry {
  id: string;
  effective_start: string;
  effective_end: string | null;
  billing_basis: string;
  rate: number | null;
  billing_frequency: string;
  min_amount: number | null;
  max_amount: number | null;
  is_active: boolean;
}

interface PricingHistoryTimelineProps {
  propertyId: string;
  unitId?: string;
  offeringId: string;
}

export default function PricingHistoryTimeline({
  propertyId,
  unitId,
  offeringId,
}: PricingHistoryTimelineProps) {
  const [history, setHistory] = useState<PricingHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, [propertyId, unitId, offeringId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ propertyId, offeringId });
      if (unitId) params.append('unitId', unitId);

      const response = await fetch(`/api/service-pricing?${params}`);
      const result = await response.json();

      if (response.ok) {
        // Sort by effective_start descending (most recent first)
        const sorted = (result.data || []).sort(
          (a: PricingHistoryEntry, b: PricingHistoryEntry) => {
            const dateA = new Date(a.effective_start).getTime();
            const dateB = new Date(b.effective_start).getTime();
            return dateB - dateA;
          },
        );
        setHistory(sorted);
      }
    } catch (err) {
      console.error('Error loading pricing history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center">
          Loading pricing history...
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground py-6 text-center">
          No pricing history found for this service offering.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing History</CardTitle>
        <CardDescription>
          Historical pricing configurations with effective dates. Active pricing is highlighted.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.map((entry, index) => {
            const startDate = new Date(entry.effective_start);
            const endDate = entry.effective_end ? new Date(entry.effective_end) : null;
            const isActive = entry.is_active && !endDate;

            return (
              <div
                key={entry.id}
                className={`relative border-l-2 pb-4 pl-4 ${
                  isActive ? 'border-primary' : 'border-border'
                }`}
              >
                {index < history.length - 1 && (
                  <div className="border-border absolute top-6 -left-[5px] h-full w-2 border-l-2" />
                )}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant={isActive ? 'default' : 'secondary'}>
                        {isActive ? 'Active' : 'Ended'}
                      </Badge>
                      <Badge variant="outline">{entry.billing_basis}</Badge>
                      <span className="text-muted-foreground text-sm">
                        {entry.billing_frequency}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {entry.rate != null && (
                        <div className="flex items-center gap-2">
                          <DollarSign className="text-muted-foreground h-4 w-4" />
                          <span className="font-medium">
                            {entry.billing_basis === 'percent_rent'
                              ? `${entry.rate}%`
                              : formatCurrency(entry.rate)}
                          </span>
                        </div>
                      )}
                      {(entry.min_amount != null || entry.max_amount != null) && (
                        <div className="text-muted-foreground text-sm">
                          {entry.min_amount != null && `Min: ${formatCurrency(entry.min_amount)}`}
                          {entry.min_amount != null && entry.max_amount != null && ' • '}
                          {entry.max_amount != null && `Max: ${formatCurrency(entry.max_amount)}`}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <div>
                        <div>
                          From:{' '}
                          {startDate.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </div>
                        {endDate ? (
                          <div>
                            To:{' '}
                            {endDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                        ) : (
                          <div className="text-primary font-medium">Ongoing</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
