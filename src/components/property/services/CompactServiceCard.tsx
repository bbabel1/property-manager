'use client';

import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/transactions/formatting';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { ServicePricingPreview } from '@/lib/service-pricing';

interface CompactServiceCardProps {
  offering: {
    id: string;
    name: string;
    isSelected: boolean;
    isIncluded: boolean;
    pricing?: ServicePricingPreview;
    defaultPricing?: ServicePricingPreview;
  };
  isEditMode: boolean;
  isPending: boolean;
  isActive: boolean;
  onToggle?: () => void;
  onClick: () => void;
}

export default function CompactServiceCard({
  offering,
  isEditMode,
  isPending,
  isActive,
  onToggle,
  onClick,
}: CompactServiceCardProps) {
  const pricing = offering.pricing || offering.defaultPricing;
  const hasPricing = pricing && pricing.rate !== null;

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border p-2.5 transition-all cursor-pointer',
        isActive
          ? 'border-primary bg-primary/5 dark:bg-primary/10'
          : 'border-border bg-card hover:bg-muted/50',
        isPending && 'opacity-50',
      )}
      onClick={onClick}
    >
      {/* Checkbox or Status Indicator */}
      {isEditMode && onToggle ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          <Checkbox
            checked={offering.isSelected}
            disabled={isPending}
            onCheckedChange={(checked) => {
              if (checked !== 'indeterminate') {
                onToggle();
              }
            }}
            aria-label={`Select ${offering.name}`}
          />
        </div>
      ) : (
        <div className="flex h-5 w-5 items-center justify-center">
          {offering.isIncluded ? (
            <div className="bg-primary h-2 w-2 rounded-full" />
          ) : offering.isSelected ? (
            <div className="bg-green-500 h-2 w-2 rounded-full" />
          ) : (
            <div className="bg-muted-foreground/30 h-2 w-2 rounded-full" />
          )}
        </div>
      )}

      {/* Service Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-sm truncate">{offering.name}</h4>
          {offering.isIncluded && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              Included
            </Badge>
          )}
        </div>
      </div>

      {/* Pricing - Minimal */}
      {hasPricing && (
        <div className="text-right text-xs">
          <div className="font-medium">{formatCurrency(pricing.rate!)}</div>
          <div className="text-muted-foreground text-[10px]">
            {pricing.billing_frequency || 'N/A'}
          </div>
        </div>
      )}

      {/* Chevron */}
      <ChevronRight className="text-muted-foreground h-4 w-4 flex-shrink-0" />
    </div>
  );
}
