'use client';

import { useState } from 'react';
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
  const [saving, setSaving] = useState(false);

  const handleToggleUnit = (unitId: string) => {
    const newSelected = new Set(selectedUnits);
    if (newSelected.has(unitId)) {
      newSelected.delete(unitId);
    } else {
      newSelected.add(unitId);
    }
    setSelectedUnits(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUnits.size === units.length) {
      setSelectedUnits(new Set());
    } else {
      setSelectedUnits(new Set(units.map((u) => u.id)));
    }
  };

  const handleSave = async () => {
    if (selectedUnits.size === 0) {
      alert('Please select at least one unit');
      return;
    }

    try {
      setSaving(true);
      const pricing = Array.from(selectedUnits).map((unitId) => ({
        unitId,
        pricing: {
          property_id: propertyId,
          unit_id: unitId,
          offering_id: offeringId,
          billing_basis: billingBasis,
          rate: rate ? parseFloat(rate) : null,
          billing_frequency: frequency,
          bill_on: 'calendar_day',
          effective_start: new Date().toISOString(),
        },
      }));

      await onSave(pricing);
      setOpen(false);
      setSelectedUnits(new Set());
      setRate('');
    } catch (err) {
      console.error('Error saving bulk pricing:', err);
      alert('Failed to save bulk pricing');
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
                <SelectTrigger id="bulk-basis">
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
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g., 100.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bulk-frequency">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="bulk-frequency">
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
                    return (
                      <TableRow
                        key={unit.id}
                        className="cursor-pointer"
                        onClick={() => handleToggleUnit(unit.id)}
                      >
                        <TableCell>
                          <Checkbox checked={isSelected} onCheckedChange={() => handleToggleUnit(unit.id)} />
                        </TableCell>
                        <TableCell className="font-medium">{unitLabel}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Will apply: {billingBasis === 'percent_rent' ? `${rate}%` : formatCurrency(parseFloat(rate) || 0)}</Badge>
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

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || selectedUnits.size === 0}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : `Apply to ${selectedUnits.size} Unit${selectedUnits.size !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
