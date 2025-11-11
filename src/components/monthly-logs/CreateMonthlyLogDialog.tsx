'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date-input';

type PropertyOption = { id: string; name: string };
type UnitOption = { id: string; propertyId: string; label: string };

type Props = {
  properties: PropertyOption[];
  units: UnitOption[];
  defaultPeriodStart: string;
};

const isoMonthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
});

function normalizePeriodStart(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  const month = parsed.getUTCMonth() + 1;
  const paddedMonth = month.toString().padStart(2, '0');
  return `${year}-${paddedMonth}-01`;
}

export default function CreateMonthlyLogDialog({ properties, units, defaultPeriodStart }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [startDate, setStartDate] = useState<string | null>(defaultPeriodStart || null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sortedProperties = useMemo(
    () => [...properties].sort((a, b) => a.name.localeCompare(b.name)),
    [properties],
  );

  const filteredUnits = useMemo(() => {
    if (!selectedPropertyId) return [];
    return units
      .filter((unit) => unit.propertyId === selectedPropertyId)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [units, selectedPropertyId]);

  useEffect(() => {
    if (!open) return;
    if (selectedPropertyId) return;
    if (sortedProperties.length === 0) return;
    const propertyWithUnits = sortedProperties.find((property) =>
      units.some((unit) => unit.propertyId === property.id),
    );
    if (propertyWithUnits) {
      setSelectedPropertyId(propertyWithUnits.id);
    } else {
      setSelectedPropertyId(sortedProperties[0].id);
    }
  }, [open, selectedPropertyId, sortedProperties, units]);

  useEffect(() => {
    if (!open) return;
    if (!selectedPropertyId) return;
    if (filteredUnits.length > 0) return;
    const fallback = sortedProperties.find(
      (property) =>
        property.id !== selectedPropertyId && units.some((unit) => unit.propertyId === property.id),
    );
    if (fallback) {
      setSelectedPropertyId(fallback.id);
    }
  }, [open, selectedPropertyId, filteredUnits, sortedProperties, units]);

  useEffect(() => {
    if (!open) return;
    if (selectedPropertyId && filteredUnits.length > 0) {
      const exists = filteredUnits.some((unit) => unit.id === selectedUnitId);
      if (!exists) {
        setSelectedUnitId(filteredUnits[0].id);
      }
    } else {
      setSelectedUnitId('');
    }
  }, [open, filteredUnits, selectedPropertyId, selectedUnitId]);

  const canOpen = sortedProperties.length > 0 && units.length > 0;
  const hasUnit = Boolean(selectedUnitId);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setOpen(false);
      setError(null);
      setSubmitting(false);
      setSelectedPropertyId('');
      setSelectedUnitId('');
      setStartDate(defaultPeriodStart || null);
      return;
    }
    if (!canOpen) {
      toast.error('You need at least one active property and unit to create a monthly log.');
      return;
    }
    setOpen(true);
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    if (!selectedPropertyId) {
      setError('Select a property to continue.');
      return;
    }
    if (!selectedUnitId) {
      setError('Select a unit to continue.');
      return;
    }
    const normalized = normalizePeriodStart(startDate);
    if (!normalized) {
      setError('Choose a valid start date (YYYY-MM-DD).');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/monthly-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          unitId: selectedUnitId,
          periodStart: normalized,
        }),
      });

      if (!response.ok) {
        let message = 'Unable to create monthly log.';
        try {
          const payload = await response.json();
          if (payload?.error) message = payload.error;
        } catch {
          // ignore parse issues
        }
        throw new Error(message);
      }

      const monthLabel = isoMonthFormatter.format(new Date(`${normalized}T00:00:00`));
      toast.success(`Monthly log for ${monthLabel} created.`);
      setOpen(false);
      setError(null);
      setSubmitting(false);
      setSelectedPropertyId('');
      setSelectedUnitId('');
      setStartDate(defaultPeriodStart || null);
      router.refresh();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to create monthly log.';
      setError(message);
      toast.error(message);
      setSubmitting(false);
    }
  };

  const triggerDisabled = !canOpen || submitting;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" disabled={triggerDisabled} className="gap-2">
          <Plus className="h-4 w-4" />
          New Log
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border/80 max-h-[90vh] w-[92vw] overflow-y-auto rounded-none border p-0 shadow-2xl sm:max-w-md sm:rounded-2xl md:max-w-lg">
        <DialogHeader className="border-border border-b p-6">
          <DialogTitle className="text-foreground text-xl font-semibold">
            Create Monthly Log
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Track a new monthly workflow by selecting a property, unit, and start date.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 p-6">
          <div className="space-y-2">
            <label
              htmlFor="monthly-log-property"
              className="block text-sm font-medium text-gray-700"
            >
              Property
            </label>
            <Select
              value={selectedPropertyId}
              onValueChange={(value) => {
                setSelectedPropertyId(value);
                setSelectedUnitId('');
              }}
            >
              <SelectTrigger id="monthly-log-property">
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                {sortedProperties.map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    {property.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label htmlFor="monthly-log-unit" className="block text-sm font-medium text-gray-700">
              Unit
            </label>
            <Select
              value={selectedUnitId}
              disabled={filteredUnits.length === 0}
              onValueChange={setSelectedUnitId}
            >
              <SelectTrigger id="monthly-log-unit">
                <SelectValue
                  placeholder={filteredUnits.length ? 'Select unit' : 'No active units'}
                />
              </SelectTrigger>
              <SelectContent>
                {filteredUnits.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="monthly-log-start-date"
              className="block text-sm font-medium text-gray-700"
            >
              Start date
            </label>
            <DateInput
              id="monthly-log-start-date"
              value={startDate || ''}
              onChange={setStartDate}
              containerClassName="w-[140px]"
            />
            <p className="text-muted-foreground text-xs">
              The monthly cycle will use the first day of the selected month.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <DialogFooter className="border-border border-t px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!hasUnit || submitting}>
              {submitting ? 'Creating…' : 'Create log'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
