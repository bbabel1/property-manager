'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/transactions/formatting';
import { Edit, Trash2, Copy, Calendar, DollarSign } from 'lucide-react';
import { ServiceBadges } from './ServiceBadges';
import InlinePricingEditor from './InlinePricingEditor';
import { ServicePricingConfig } from '@/lib/service-pricing';

interface ServiceDetailViewProps {
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
      effective_start?: string;
      effective_end?: string | null;
    };
    defaultPricing?: {
      rate: number | null;
      frequency: string;
      min_amount: number | null;
      max_amount: number | null;
    };
  };
  propertyId: string;
  isEditMode?: boolean;
  onEdit?: () => void;
  onDisable?: () => void;
  onDuplicate?: () => void;
  onPricingSave?: (pricing: Partial<ServicePricingConfig>) => Promise<void>;
  onRefresh?: () => void;
}

export default function ServiceDetailView({
  offering,
  propertyId,
  isEditMode = false,
  onEdit,
  onDisable,
  onDuplicate,
  onPricingSave,
  onRefresh,
}: ServiceDetailViewProps) {
  const [isEditingPricing, setIsEditingPricing] = useState(false);
  const pricing = offering.pricing || offering.defaultPricing;

  const handlePricingSave = async (pricingData: Partial<ServicePricingConfig>) => {
    if (onPricingSave) {
      await onPricingSave(pricingData);
      setIsEditingPricing(false);
      if (onRefresh) {
        onRefresh();
      }
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle>{offering.name}</CardTitle>
              <CardDescription className="mt-2">
                {offering.description || 'No description available.'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {onEdit && (
                <Button variant="outline" size="sm" onClick={onEdit}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
              {onDuplicate && (
                <Button variant="outline" size="sm" onClick={onDuplicate}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </Button>
              )}
              {onDisable && (
                <Button variant="outline" size="sm" onClick={onDisable}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Disable
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status and Category */}
          <div>
            <div className="text-muted-foreground mb-2 text-sm font-medium">Status</div>
            <ServiceBadges
              isIncluded={offering.isIncluded}
              isSelected={offering.isSelected}
              billingBasis={pricing?.billing_basis}
            />
            {offering.category && (
              <Badge variant="outline" className="mt-2">
                {offering.category}
              </Badge>
            )}
          </div>

          {/* Pricing Rules */}
          {pricing && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-muted-foreground text-sm font-medium">Pricing Rules</div>
                {isEditMode && !isEditingPricing && onPricingSave && (
                  <Button variant="ghost" size="sm" onClick={() => setIsEditingPricing(true)}>
                    <Edit className="mr-2 h-3 w-3" />
                    Edit
                  </Button>
                )}
              </div>
              {isEditingPricing && onPricingSave ? (
                <InlinePricingEditor
                  pricing={offering.pricing as ServicePricingConfig | undefined}
                  onSave={handlePricingSave}
                  onCancel={() => setIsEditingPricing(false)}
                  propertyId={propertyId}
                  offeringId={offering.id}
                />
              ) : (
                <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Billing Basis</span>
                  <Badge variant="outline">{pricing.billing_basis || 'N/A'}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Frequency</span>
                  <Badge variant="outline">{pricing.frequency || 'N/A'}</Badge>
                </div>
                {pricing.rate !== null && pricing.rate !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      Rate
                    </span>
                    <span className="font-medium">
                      {pricing.billing_basis === 'percent_rent'
                        ? `${pricing.rate}%`
                        : formatCurrency(pricing.rate)}
                    </span>
                  </div>
                )}
                {(pricing.min_amount !== null || pricing.max_amount !== null) && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Range</span>
                    <span className="text-sm">
                      {pricing.min_amount !== null && formatCurrency(pricing.min_amount)}
                      {pricing.min_amount !== null && pricing.max_amount !== null && ' - '}
                      {pricing.max_amount !== null && formatCurrency(pricing.max_amount)}
                    </span>
                  </div>
                )}
              </div>
              )}
            </div>
          )}

          {/* Effective Dates */}
          {pricing?.effective_start && (
            <div>
              <div className="text-muted-foreground mb-2 text-sm font-medium">Effective Dates</div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="text-muted-foreground h-4 w-4" />
                <span>
                  {new Date(pricing.effective_start).toLocaleDateString()}
                  {pricing.effective_end
                    ? ` - ${new Date(pricing.effective_end).toLocaleDateString()}`
                    : ' - Ongoing'}
                </span>
              </div>
            </div>
          )}

          {/* Override Settings */}
          <div>
            <div className="text-muted-foreground mb-2 text-sm font-medium">Override Settings</div>
            <div className="text-muted-foreground text-sm">
              {offering.isIncluded
                ? 'This service is included in your plan. You can override pricing at the property or unit level.'
                : 'This service can be configured at the property or unit level.'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

