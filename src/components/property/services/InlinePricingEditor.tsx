'use client';

import { useState } from 'react';
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
import { Save, X } from 'lucide-react';
import { ServicePricingConfig } from '@/lib/service-pricing';

interface InlinePricingEditorProps {
  pricing?: ServicePricingConfig;
  onSave: (pricing: Partial<ServicePricingConfig>) => Promise<void>;
  onCancel: () => void;
  propertyId: string;
  offeringId: string;
}

export default function InlinePricingEditor({
  pricing,
  onSave,
  onCancel,
  propertyId,
  offeringId,
}: InlinePricingEditorProps) {
  const [billingBasis, setBillingBasis] = useState<string>(
    pricing?.billing_basis || 'per_property',
  );
  const [rate, setRate] = useState<string>(pricing?.rate?.toString() || '');
  const [frequency, setFrequency] = useState<string>(
    pricing?.billing_frequency || 'monthly',
  );
  const [minAmount, setMinAmount] = useState<string>(pricing?.min_amount?.toString() || '');
  const [maxAmount, setMaxAmount] = useState<string>(pricing?.max_amount?.toString() || '');
  const [effectiveStart, setEffectiveStart] = useState<string>(
    pricing?.effective_start
      ? new Date(pricing.effective_start).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
  );
  const [rentBasis, setRentBasis] = useState<string>(pricing?.rent_basis || 'scheduled');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const pricingData: Partial<ServicePricingConfig> = {
        property_id: propertyId,
        unit_id: null,
        offering_id: offeringId,
        billing_basis: billingBasis as any,
        rate: rate ? parseFloat(rate) : null,
        billing_frequency: frequency as any,
        min_amount: minAmount ? parseFloat(minAmount) : null,
        max_amount: maxAmount ? parseFloat(maxAmount) : null,
        effective_start: new Date(effectiveStart).toISOString(),
        rent_basis: billingBasis === 'percent_rent' ? (rentBasis as any) : null,
        is_active: true,
      };
      await onSave(pricingData);
    } catch (err) {
      console.error('Error saving pricing:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="inline-billing-basis">Billing Basis</Label>
          <Select value={billingBasis} onValueChange={setBillingBasis}>
            <SelectTrigger id="inline-billing-basis">
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
          <Label htmlFor="inline-frequency">Frequency</Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger id="inline-frequency">
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
          <Label htmlFor="inline-rate">
            Rate {billingBasis === 'percent_rent' ? '(%)' : '($)'}
          </Label>
          <Input
            id="inline-rate"
            type="number"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={billingBasis === 'percent_rent' ? '5.00' : '100.00'}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="inline-effective-start">Effective Start</Label>
          <Input
            id="inline-effective-start"
            type="date"
            value={effectiveStart}
            onChange={(e) => setEffectiveStart(e.target.value)}
          />
        </div>

        {billingBasis === 'percent_rent' && (
          <div className="space-y-2">
            <Label htmlFor="inline-rent-basis">Rent Basis</Label>
            <Select value={rentBasis} onValueChange={setRentBasis}>
              <SelectTrigger id="inline-rent-basis">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="billed">Billed</SelectItem>
                <SelectItem value="collected">Collected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="inline-min-amount">Min Amount (optional)</Label>
          <Input
            id="inline-min-amount"
            type="number"
            step="0.01"
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="inline-max-amount">Max Amount (optional)</Label>
          <Input
            id="inline-max-amount"
            type="number"
            step="0.01"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

