'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ServiceBadges } from './ServiceBadges';
import { formatCurrency } from '@/lib/transactions/formatting';
import { Edit, Settings, Copy } from 'lucide-react';
import { cn } from '@/components/ui/utils';

interface ServiceCardProps {
  offering: {
    id: string;
    name: string;
    description?: string | null;
    category?: string | null;
    isSelected: boolean;
    isIncluded: boolean;
    pricing?: {
      rate: number | null;
      frequency: string;
      min_amount: number | null;
      max_amount: number | null;
      billing_basis?: string;
    };
    defaultPricing?: {
      rate: number | null;
      frequency: string;
      min_amount: number | null;
      max_amount: number | null;
    };
  };
  isEditMode: boolean;
  isPending: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onClick: () => void;
  onEditPricing?: () => void;
  onConfigureRules?: () => void;
  onOverrideUnitLevel?: () => void;
}

export default function ServiceCard({
  offering,
  isEditMode,
  isPending,
  isSelected,
  onToggle,
  onClick,
  onEditPricing,
  onConfigureRules,
  onOverrideUnitLevel,
}: ServiceCardProps) {
  const pricing = offering.pricing || offering.defaultPricing;

  return (
    <div
      className={cn(
        'group relative rounded-lg border p-3 transition-all cursor-pointer',
        isSelected
          ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20'
          : 'border-border bg-card hover:border-primary/50',
        isPending && 'opacity-50',
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {isEditMode && (
          <div
            className="mt-0.5"
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
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm">{offering.name}</h4>
                {isEditMode && (
                  <Badge variant="outline" className="text-xs">
                    {offering.category || 'Other'}
                  </Badge>
                )}
              </div>
              {offering.description && !isEditMode && (
                <p className="text-muted-foreground text-xs line-clamp-2 mb-2">
                  {offering.description}
                </p>
              )}
              <ServiceBadges
                isIncluded={offering.isIncluded}
                isSelected={offering.isSelected}
                billingBasis={pricing?.billing_basis}
              />
            </div>

            {/* Pricing */}
            {pricing && (
              <div className="text-right text-sm">
                <div className="font-medium">
                  {pricing.rate !== null && pricing.rate !== undefined
                    ? formatCurrency(pricing.rate)
                    : 'N/A'}{' '}
                  <span className="text-muted-foreground text-xs">
                    / {pricing.frequency || 'N/A'}
                  </span>
                </div>
                {(pricing.min_amount || pricing.max_amount) && (
                  <div className="text-muted-foreground text-xs">
                    {pricing.min_amount && `Min: ${formatCurrency(pricing.min_amount)}`}
                    {pricing.min_amount && pricing.max_amount && ' • '}
                    {pricing.max_amount && `Max: ${formatCurrency(pricing.max_amount)}`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Hover Actions */}
          {!isEditMode && (
            <div className="mt-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              {onEditPricing && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditPricing();
                  }}
                >
                  <Edit className="mr-1 h-3 w-3" />
                  Edit Pricing
                </Button>
              )}
              {onConfigureRules && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfigureRules();
                  }}
                >
                  <Settings className="mr-1 h-3 w-3" />
                  Configure Rules
                </Button>
              )}
              {onOverrideUnitLevel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOverrideUnitLevel();
                  }}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Override at Unit Level
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

