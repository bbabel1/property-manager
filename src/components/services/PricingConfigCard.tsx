'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Save, X } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { ServicePricingConfig } from '@/lib/service-pricing';

interface PricingConfigCardProps {
  propertyId: string;
  unitId?: string;
  offeringId: string;
  offeringName: string;
  currentPricing?: ServicePricingConfig;
  onSave: (pricing: Partial<ServicePricingConfig>) => Promise<void>;
  onCancel: () => void;
}

export default function PricingConfigCard({
  propertyId,
  unitId,
  offeringId,
  offeringName,
  currentPricing,
  onSave,
  onCancel,
}: PricingConfigCardProps) {
  const [billingBasis, setBillingBasis] = useState<string>(
    currentPricing?.billing_basis || 'per_property',
  );
  const [rate, setRate] = useState<string>(currentPricing?.rate?.toString() || '');
  const [frequency, setFrequency] = useState<string>(
    currentPricing?.billing_frequency || 'monthly',
  );
  const [minAmount, setMinAmount] = useState<string>(currentPricing?.min_amount?.toString() || '');
  const [maxAmount, setMaxAmount] = useState<string>(currentPricing?.max_amount?.toString() || '');
  const [effectiveStart, setEffectiveStart] = useState<Date | undefined>(
    currentPricing?.effective_start ? new Date(currentPricing.effective_start) : new Date(),
  );
  const [rentBasis, setRentBasis] = useState<string>(currentPricing?.rent_basis || 'scheduled');
  const [minMonthlyFee, setMinMonthlyFee] = useState<string>(
    currentPricing?.min_monthly_fee?.toString() || '',
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const pricing: Partial<ServicePricingConfig> = {
        property_id: propertyId,
        unit_id: unitId || null,
        offering_id: offeringId,
        billing_basis: billingBasis as any,
        rate: rate ? parseFloat(rate) : null,
        billing_frequency: frequency as any,
        min_amount: minAmount ? parseFloat(minAmount) : null,
        max_amount: maxAmount ? parseFloat(maxAmount) : null,
        effective_start: effectiveStart?.toISOString(),
        rent_basis: billingBasis === 'percent_rent' ? (rentBasis as any) : null,
        min_monthly_fee:
          billingBasis === 'percent_rent' && minMonthlyFee ? parseFloat(minMonthlyFee) : null,
      };
      await onSave(pricing);
    } catch (err) {
      console.error('Error saving pricing:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configure Pricing: {offeringName}</CardTitle>
        <CardDescription>
          {unitId ? 'Unit-level pricing override' : 'Property-level pricing configuration'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="billing-basis">Billing Basis</Label>
            <Select value={billingBasis} onValueChange={setBillingBasis}>
              <SelectTrigger id="billing-basis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="per_property">Per Property</SelectItem>
                <SelectItem value="per_unit">Per Unit</SelectItem>
                <SelectItem value="percent_rent">Percent of Rent</SelectItem>
                <SelectItem value="job_cost">Job Cost</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="one_time">One-Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frequency">Billing Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger id="frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
                <SelectItem value="per_event">Per Event</SelectItem>
                <SelectItem value="per_job">Per Job</SelectItem>
                <SelectItem value="one_time">One-Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate">{billingBasis === 'percent_rent' ? 'Percentage' : 'Rate'}</Label>
            <Input
              id="rate"
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder={billingBasis === 'percent_rent' ? 'e.g., 2.5' : 'e.g., 100.00'}
            />
            {billingBasis === 'percent_rent' && (
              <p className="text-muted-foreground text-xs">
                Percentage of rent (e.g., 2.5 for 2.5%)
              </p>
            )}
          </div>

          {billingBasis === 'percent_rent' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="rent-basis">Rent Basis</Label>
                <Select value={rentBasis} onValueChange={setRentBasis}>
                  <SelectTrigger id="rent-basis">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled Rent</SelectItem>
                    <SelectItem value="billed">Billed Rent</SelectItem>
                    <SelectItem value="collected">Collected Rent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="min-monthly-fee">Min Monthly Fee</Label>
                <Input
                  id="min-monthly-fee"
                  type="number"
                  step="0.01"
                  value={minMonthlyFee}
                  onChange={(e) => setMinMonthlyFee(e.target.value)}
                  placeholder="e.g., 50.00"
                />
                <p className="text-muted-foreground text-xs">
                  Minimum fee when calculated percentage is lower
                </p>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="min-amount">Min Amount (Optional)</Label>
            <Input
              id="min-amount"
              type="number"
              step="0.01"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
              placeholder="e.g., 0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-amount">Max Amount (Optional)</Label>
            <Input
              id="max-amount"
              type="number"
              step="0.01"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
              placeholder="e.g., 1000.00"
            />
          </div>

          <div className="space-y-2">
            <Label>Effective Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !effectiveStart && 'text-muted-foreground',
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {effectiveStart ? effectiveStart.toLocaleDateString() : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={effectiveStart}
                  onSelect={setEffectiveStart}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-muted-foreground text-xs">
              This pricing will take effect on this date. Previous pricing will be automatically
              ended.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Pricing'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
