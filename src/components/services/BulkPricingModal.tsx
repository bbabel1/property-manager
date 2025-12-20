'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface BulkPricingModalProps {
  propertyId: string;
  offeringId: string;
  offeringName: string;
  units: Array<{ id: string; unit_number: string | null; unit_name: string | null }>;
  onSave: (pricing: Array<{ unitId: string; pricing: any }>) => Promise<void>;
}

// Bulk pricing overrides are disabled; service plans control automated posting.
export default function BulkPricingModal({ offeringName }: BulkPricingModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Bulk Pricing
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[480px] max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Bulk Pricing: {offeringName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Bulk pricing configuration is now managed via Service Plans.
        </p>
      </DialogContent>
    </Dialog>
  );
}
