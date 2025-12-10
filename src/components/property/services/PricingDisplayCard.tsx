'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/transactions/formatting';
import { Edit, Copy, Trash2, Calendar } from 'lucide-react';
import { ServicePricingConfig } from '@/lib/service-pricing';

interface PricingDisplayCardProps {
  pricing: ServicePricingConfig;
  serviceName?: string;
  unitName?: string;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onDisable?: () => void;
}

export default function PricingDisplayCard({
  pricing,
  serviceName,
  unitName,
  onEdit,
  onDuplicate,
  onDisable,
}: PricingDisplayCardProps) {
  const effectiveStart = new Date(pricing.effective_start);
  const effectiveEnd = pricing.effective_end ? new Date(pricing.effective_end) : null;
  const isActive = pricing.is_active && !effectiveEnd;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-lg">{serviceName || 'Service Pricing'}</CardTitle>
              {isActive && (
                <Badge variant="default" className="text-xs">
                  Active
                </Badge>
              )}
              {unitName && (
                <Badge variant="outline" className="text-xs">
                  {unitName}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            {onDuplicate && (
              <Button variant="ghost" size="sm" onClick={onDuplicate}>
                <Copy className="h-4 w-4" />
              </Button>
            )}
            {onDisable && (
              <Button variant="ghost" size="sm" onClick={onDisable}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Billing Type
            </div>
            <div className="mt-1">
              <Badge variant="outline">{pricing.billing_basis}</Badge>
            </div>
          </div>
          <div>
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Frequency
            </div>
            <div className="mt-1 text-sm font-medium">{pricing.billing_frequency}</div>
          </div>
        </div>

        {pricing.rate !== null && (
          <div>
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Rate
            </div>
            <div className="mt-1 text-lg font-semibold">
              {pricing.billing_basis === 'percent_rent'
                ? `${pricing.rate}%`
                : formatCurrency(pricing.rate)}
            </div>
          </div>
        )}

        {(pricing.min_amount !== null || pricing.max_amount !== null) && (
          <div>
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Range
            </div>
            <div className="mt-1 text-sm">
              {pricing.min_amount !== null && formatCurrency(pricing.min_amount)}
              {pricing.min_amount !== null && pricing.max_amount !== null && ' - '}
              {pricing.max_amount !== null && formatCurrency(pricing.max_amount)}
            </div>
          </div>
        )}

        <div>
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Effective Date
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <Calendar className="text-muted-foreground h-4 w-4" />
            <span>
              {effectiveStart.toLocaleDateString()}
              {effectiveEnd ? ` - ${effectiveEnd.toLocaleDateString()}` : ' - Ongoing'}
            </span>
          </div>
        </div>

        {pricing.billing_basis === 'percent_rent' && pricing.rent_basis && (
          <div>
            <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Rent Basis
            </div>
            <div className="mt-1">
              <Badge variant="outline">{pricing.rent_basis}</Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

