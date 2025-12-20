'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface PricingConfigCardProps {
  propertyId: string;
  unitId?: string;
  offeringId: string;
  offeringName: string;
  currentPricing?: unknown;
  onSave: (pricing: Record<string, never>) => Promise<void>;
  onCancel: () => void;
}

// Pricing overrides are no longer editable here; service plans handle automatic posting.
export default function PricingConfigCard({
  offeringName,
  onCancel,
}: PricingConfigCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Pricing: {offeringName}</CardTitle>
        <CardDescription>Pricing is managed by Service Plans.</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-end">
        <Button variant="outline" onClick={onCancel}>
          Close
        </Button>
      </CardContent>
    </Card>
  );
}
