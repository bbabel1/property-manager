'use client';

import { Badge } from '@/components/ui/badge';

interface ServiceBadgesProps {
  isIncluded: boolean;
  isSelected: boolean;
  billingBasis?: string;
}

export function ServiceBadges({ isIncluded, isSelected, billingBasis }: ServiceBadgesProps) {
  return (
    <div className="flex flex-wrap gap-1">
      {isIncluded && (
        <Badge variant="secondary" className="text-xs">
          Included
        </Badge>
      )}
      {isSelected && !isIncluded && (
        <Badge variant="default" className="text-xs">
          Enabled
        </Badge>
      )}
      {!isSelected && (
        <Badge variant="outline" className="text-xs">
          Disabled
        </Badge>
      )}
      {billingBasis && (
        <Badge variant="outline" className="text-xs">
          {billingBasis === 'percent_rent' ? '% Rent' : billingBasis === 'per_property' ? 'Property' : billingBasis === 'per_unit' ? 'Unit' : billingBasis}
        </Badge>
      )}
    </div>
  );
}

