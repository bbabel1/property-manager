'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency } from '@/lib/transactions/formatting';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Save } from 'lucide-react';
import { toast } from 'sonner';

interface BulkPricingModalProps {
  propertyId: string;
  offeringId: string;
  offeringName: string;
  units: Array<{ id: string; unit_number: string | null; unit_name: string | null }>;
  onSave: (pricing: Array<{ unitId: string; pricing: any }>) => Promise<void>;
}

export default function BulkPricingModal({
  propertyId,
  offeringId,
  offeringName,
  units,
  onSave,
}: BulkPricingModalProps) {
  const [open, setOpen] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState<Set<string>>(new Set());
  const [billingBasis, setBillingBasis] = useState<string>('per_unit');
  const [rate, setRate] = useState<string>('');
  const [frequency, setFrequency] = useState<string>('monthly');
  const [billOn, setBillOn] = useState<string>('calendar_day');
  const [rentBasis, setRentBasis] = useState<string>('scheduled');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [hourlyMinHours, setHourlyMinHours] = useState<string>('');
  const [effectiveStart, setEffectiveStart] = useState<string>(new Date().toISOString().slice(0, 10));
  const [effectiveEnd, setEffectiveEnd] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const formDisabled = saving;

  const resetForm = () => {
    setSelectedUnits(new Set());
    setBillingBasis('per_unit');
    setRate('');
    setFrequency('monthly');
    setBillOn('calendar_day');
    setRentBasis('scheduled');
    setMinAmount('');
    setMaxAmount('');
    setHourlyMinHours('');
    setEffectiveStart(new Date().toISOString().slice(0, 10));
    setEffectiveEnd('');
    setShowValidation(false);
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    } else {
      setShowValidation(true);
    }
  }, [open]);

  const handleToggleUnit = (unitId: string) => {
    if (formDisabled) return;
    const newSelected = new Set(selectedUnits);
    if (newSelected.has(unitId)) {
      newSelected.delete(unitId);
    } else {
      newSelected.add(unitId);
    }
    setSelectedUnits(newSelected);
  };

  const handleSelectAll = () => {
    if (formDisabled) return;
    if (selectedUnits.size === units.length) {
      setSelectedUnits(new Set());
    } else {
      setSelectedUnits(new Set(units.map((u) => u.id)));
    }
  };

  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    if (!billingBasis) errors.push('Billing basis is required.');
    if (!frequency) errors.push('Billing frequency is required.');
    if (!billOn) errors.push('Bill on is required.');
    if (!effectiveStart) errors.push('Effective start date is required.');
    if (effectiveStart && effectiveEnd) {
      const start = new Date(`${effectiveStart}T00:00:00Z`).getTime();
      const end = new Date(`${effectiveEnd}T00:00:00Z`).getTime();
      if (end < start) {
        errors.push('Effective end date must be on or after the start date.');
      }
    }

    if (billingBasis === 'hourly') {
      if (!rate) {
        errors.push('Hourly rate is required.');
      } else if (Number(rate) <= 0) {
        errors.push('Hourly rate must be greater than 0.');
      }
      if (!hourlyMinHours) {
        errors.push('Hourly minimum hours are required.');
      } else if (Number(hourlyMinHours) <= 0) {
        errors.push('Hourly minimum hours must be greater than 0.');
      }
    } else {
      if (!rate) {
        errors.push('Rate is required.');
      } else if (Number(rate) < 0) {
        errors.push('Rate cannot be negative.');
      }
    }

    if (billingBasis === 'percent_rent') {
      if (!rentBasis) errors.push('Rent basis is required for percent of rent.');
      const minVal = minAmount ? Number(minAmount) : null;
      const maxVal = maxAmount ? Number(maxAmount) : null;
      if (minVal !== null && minVal < 0) errors.push('Min amount cannot be negative.');
      if (maxVal !== null && maxVal < 0) errors.push('Max amount cannot be negative.');
      if (minVal !== null && maxVal !== null && maxVal < minVal) {
        errors.push('Max amount must be greater than or equal to min amount.');
      }
    }

    if (selectedUnits.size === 0) {
      errors.push('Select at least one unit to apply pricing.');
    }

    return errors;
  }, [billingBasis, billOn, effectiveEnd, effectiveStart, frequency, hourlyMinHours, rate, rentBasis, selectedUnits.size]);

  const handleSave = async () => {
    setShowValidation(true);
    if (validationErrors.length > 0) {
      toast.error('Please fix the highlighted issues before saving.');
      return;
    }

    try {
      setSaving(true);
      const effectiveStartIso = effectiveStart ? new Date(`${effectiveStart}T00:00:00Z`).toISOString() : null;
      const effectiveEndIso = effectiveEnd ? new Date(`${effectiveEnd}T23:59:59Z`).toISOString() : null;
      const pricing = Array.from(selectedUnits).map((unitId) => ({
        unitId,
        pricing: {
          property_id: propertyId,
          unit_id: unitId,
          offering_id: offeringId,
          billing_basis: billingBasis,
          bill_on: billOn,
          effective_start: effectiveStartIso,
          effective_end: effectiveEndIso || null,
          ...(billingBasis === 'percent_rent'
            ? {
                rate: rate ? parseFloat(rate) : null,
                rent_basis: rentBasis,
                min_amount: minAmount ? parseFloat(minAmount) : null,
                max_amount: maxAmount ? parseFloat(maxAmount) : null,
              }
            : {}),
          ...(billingBasis === 'hourly'
            ? {
                hourly_rate: rate ? parseFloat(rate) : null,
                hourly_min_hours: hourlyMinHours ? parseFloat(hourlyMinHours) : null,
              }
            : {
                rate: rate ? parseFloat(rate) : null,
              }),
          billing_frequency: frequency,
        },
      }));

      await onSave(pricing);
      setOpen(false);
      setSelectedUnits(new Set());
      setRate('');
      setMinAmount('');
      setMaxAmount('');
      setHourlyMinHours('');
      setEffectiveEnd('');
      setShowValidation(false);
      toast.success(`Applied pricing to ${pricing.length} unit${pricing.length === 1 ? '' : 's'}`);
    } catch (err) {
      console.error('Error saving bulk pricing:', err);
      toast.error('Failed to save bulk pricing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Bulk Pricing
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Bulk Pricing: {offeringName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Pricing Configuration */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bulk-basis">Billing Basis</Label>
              <Select value={billingBasis} onValueChange={setBillingBasis}>
                <SelectTrigger id="bulk-basis" disabled={formDisabled}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_unit">Per Unit</SelectItem>
                  <SelectItem value="per_property">Per Property</SelectItem>
                  <SelectItem value="percent_rent">Percent of Rent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-rate">Rate</Label>
              <Input
                id="bulk-rate"
                type="number"
                step="0.01"
                disabled={formDisabled}
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder={billingBasis === 'percent_rent' ? 'e.g., 5 (%)' : 'e.g., 100.00'}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-frequency">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="bulk-frequency" disabled={formDisabled}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annually">Annually</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Additional configuration */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="bill-on">Bill On</Label>
              <Select value={billOn} onValueChange={setBillOn}>
                <SelectTrigger id="bill-on" disabled={formDisabled}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calendar_day">Calendar Day</SelectItem>
                  <SelectItem value="job_close">Job Close</SelectItem>
                  <SelectItem value="lease_start">Lease Start</SelectItem>
                  <SelectItem value="lease_end">Lease End</SelectItem>
                  <SelectItem value="invoice_date">Invoice Date</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="effective-start">Effective Start</Label>
              <Input
                id="effective-start"
                type="date"
                disabled={formDisabled}
                value={effectiveStart}
                onChange={(e) => setEffectiveStart(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="effective-end">Effective End (optional)</Label>
              <Input
                id="effective-end"
                type="date"
                disabled={formDisabled}
                value={effectiveEnd}
                onChange={(e) => setEffectiveEnd(e.target.value)}
                min={effectiveStart || undefined}
              />
            </div>
          </div>

          {billingBasis === 'percent_rent' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="rent-basis">Rent Basis</Label>
                <Select value={rentBasis} onValueChange={setRentBasis}>
                  <SelectTrigger id="rent-basis" disabled={formDisabled}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="billed">Billed</SelectItem>
                    <SelectItem value="collected">Collected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="min-amount">Min Amount (optional)</Label>
                <Input
                  id="min-amount"
                  type="number"
                  step="0.01"
                  disabled={formDisabled}
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-amount">Max Amount (optional)</Label>
                <Input
                  id="max-amount"
                  type="number"
                  step="0.01"
                  disabled={formDisabled}
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          {billingBasis === 'hourly' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="hourly-min">Minimum Hours</Label>
                <Input
                  id="hourly-min"
                  type="number"
                  step="0.1"
                  disabled={formDisabled}
                  value={hourlyMinHours}
                  onChange={(e) => setHourlyMinHours(e.target.value)}
                  placeholder="e.g., 1.5"
                />
              </div>
              <div className="space-y-2">
                <Label className="invisible block">Placeholder</Label>
              </div>
              <div className="space-y-2">
                <Label className="invisible block">Placeholder</Label>
              </div>
            </div>
          )}

          {/* Unit Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Select Units</Label>
              <Button variant="ghost" size="sm" onClick={handleSelectAll}>
                {selectedUnits.size === units.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <div className="border-border max-h-[300px] overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Current Pricing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((unit) => {
                    const isSelected = selectedUnits.has(unit.id);
                    const unitLabel = unit.unit_number || unit.unit_name || 'Unit';
                    const displayRate =
                      billingBasis === 'percent_rent'
                        ? `${rate || 0}%`
                        : billingBasis === 'hourly'
                        ? `${formatCurrency(parseFloat(rate) || 0)} / hr`
                        : formatCurrency(parseFloat(rate) || 0);
                    return (
                      <TableRow
                        key={unit.id}
                        className="cursor-pointer"
                        onClick={() => handleToggleUnit(unit.id)}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onClick={(e) => e.stopPropagation()}
                            disabled={formDisabled}
                            onCheckedChange={() => handleToggleUnit(unit.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{unitLabel}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Will apply: {displayRate}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="text-muted-foreground text-xs">
              {selectedUnits.size} of {units.length} units selected
            </p>
          </div>

          {showValidation && validationErrors.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <ul className="list-disc pl-4">
                {validationErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || validationErrors.length > 0}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : `Apply to ${selectedUnits.size} Unit${selectedUnits.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
