'use client';

import { useState, useCallback } from 'react';
import { Plus, Trash2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Body, Label } from '@/ui/typography';
import { cn } from '@/lib/utils';

export interface UnitRow {
  clientRowId: string;
  unitNumber: string;
  unitBedrooms: string;
  unitBathrooms: string;
  unitSize: number | null;
  description: string;
  saved: boolean;
  error?: string;
}

interface BulkUnitCreatorProps {
  units: UnitRow[];
  onUnitsChange: (units: UnitRow[]) => void;
  onSaveUnits: (units: UnitRow[]) => Promise<void>;
  disabled?: boolean;
  isSaving?: boolean;
}

function generateClientRowId(): string {
  return crypto.randomUUID();
}

const BEDROOM_OPTIONS = ['Studio', '1', '2', '3', '4', '5', '6+'];
const BATHROOM_OPTIONS = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4+'];

export default function BulkUnitCreator({
  units,
  onUnitsChange,
  onSaveUnits,
  disabled = false,
  isSaving = false,
}: BulkUnitCreatorProps) {
  const [bulkCount, setBulkCount] = useState(1);

  const handleAddUnit = useCallback(() => {
    const newUnit: UnitRow = {
      clientRowId: generateClientRowId(),
      unitNumber: '',
      unitBedrooms: '',
      unitBathrooms: '',
      unitSize: null,
      description: '',
      saved: false,
    };
    onUnitsChange([...units, newUnit]);
  }, [units, onUnitsChange]);

  const handleBulkAdd = useCallback(() => {
    const existingNumbers = new Set(units.map((u) => u.unitNumber.toLowerCase()));
    const newUnits: UnitRow[] = [];

    for (let i = 1; i <= bulkCount; i++) {
      let unitNumber = String(i);
      // Find next available number
      while (existingNumbers.has(unitNumber.toLowerCase())) {
        unitNumber = String(parseInt(unitNumber, 10) + 1);
      }
      existingNumbers.add(unitNumber.toLowerCase());

      newUnits.push({
        clientRowId: generateClientRowId(),
        unitNumber,
        unitBedrooms: '',
        unitBathrooms: '',
        unitSize: null,
        description: '',
        saved: false,
      });
    }

    onUnitsChange([...units, ...newUnits]);
    setBulkCount(1);
  }, [units, onUnitsChange, bulkCount]);

  const handleRemoveUnit = useCallback(
    (clientRowId: string) => {
      onUnitsChange(units.filter((u) => u.clientRowId !== clientRowId));
    },
    [units, onUnitsChange],
  );

  const handleUpdateUnit = useCallback(
    (clientRowId: string, field: keyof UnitRow, value: string | number | null) => {
      onUnitsChange(
        units.map((u) =>
          u.clientRowId === clientRowId ? { ...u, [field]: value, saved: false, error: undefined } : u,
        ),
      );
    },
    [units, onUnitsChange],
  );

  const handleSave = async () => {
    // Validate all units have unit numbers
    const invalidUnits = units.filter((u) => !u.unitNumber.trim());
    if (invalidUnits.length > 0) {
      onUnitsChange(
        units.map((u) =>
          !u.unitNumber.trim() ? { ...u, error: 'Unit number is required' } : u,
        ),
      );
      return;
    }

    // Check for duplicate unit numbers
    const unitNumbers = units.map((u) => u.unitNumber.toLowerCase());
    const duplicates = unitNumbers.filter((num, idx) => unitNumbers.indexOf(num) !== idx);
    if (duplicates.length > 0) {
      onUnitsChange(
        units.map((u) =>
          duplicates.includes(u.unitNumber.toLowerCase())
            ? { ...u, error: 'Duplicate unit number' }
            : u,
        ),
      );
      return;
    }

    await onSaveUnits(units);
  };

  const unsavedCount = units.filter((u) => !u.saved).length;
  const hasErrors = units.some((u) => u.error);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-sm font-medium">Units</Label>
          <Body className="text-muted-foreground mt-1 text-sm">
            Add units for this property. At least one unit is required.
          </Body>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={1}
            max={100}
            value={bulkCount}
            onChange={(e) => setBulkCount(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))}
            className="w-20"
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBulkAdd}
            disabled={disabled}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add {bulkCount} Unit{bulkCount > 1 ? 's' : ''}
          </Button>
        </div>
      </div>

      {/* Units table */}
      {units.length > 0 && (
        <div className="rounded-md border">
          <div className="bg-muted/50 grid grid-cols-[1fr_100px_100px_100px_40px] gap-2 border-b p-3 text-sm font-medium">
            <div>Unit Number *</div>
            <div>Bedrooms</div>
            <div>Bathrooms</div>
            <div>Size (sqft)</div>
            <div></div>
          </div>
          <div className="divide-y">
            {units.map((unit) => (
              <div
                key={unit.clientRowId}
                className={cn(
                  'grid grid-cols-[1fr_100px_100px_100px_40px] items-center gap-2 p-2',
                  unit.error && 'bg-destructive/5',
                  unit.saved && 'bg-green-50 dark:bg-green-950/20',
                )}
              >
                <div className="relative">
                  <Input
                    value={unit.unitNumber}
                    onChange={(e) => handleUpdateUnit(unit.clientRowId, 'unitNumber', e.target.value)}
                    placeholder="e.g., 1A, 101"
                    disabled={disabled}
                    className={cn(unit.error && 'border-destructive')}
                  />
                  {unit.error && (
                    <div className="text-destructive mt-1 flex items-center gap-1 text-xs">
                      <AlertCircle className="h-3 w-3" />
                      {unit.error}
                    </div>
                  )}
                  {unit.saved && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                      <Check className="h-4 w-4 text-green-600" />
                    </div>
                  )}
                </div>
                <Select
                  value={unit.unitBedrooms}
                  onValueChange={(value) => handleUpdateUnit(unit.clientRowId, 'unitBedrooms', value)}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent>
                    {BEDROOM_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={unit.unitBathrooms}
                  onValueChange={(value) => handleUpdateUnit(unit.clientRowId, 'unitBathrooms', value)}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent>
                    {BATHROOM_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={unit.unitSize || ''}
                  onChange={(e) =>
                    handleUpdateUnit(
                      unit.clientRowId,
                      'unitSize',
                      e.target.value ? parseInt(e.target.value, 10) : null,
                    )
                  }
                  placeholder="-"
                  disabled={disabled}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveUnit(unit.clientRowId)}
                  disabled={disabled}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add single unit button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddUnit}
        disabled={disabled}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Unit
      </Button>

      {/* Save button */}
      {units.length > 0 && unsavedCount > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-amber-50 p-3 dark:bg-amber-950/20">
          <Body className="text-sm">
            {unsavedCount} unsaved unit{unsavedCount > 1 ? 's' : ''}
          </Body>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={disabled || isSaving || hasErrors}
          >
            {isSaving ? 'Saving...' : 'Save Units'}
          </Button>
        </div>
      )}

      {units.length === 0 && (
        <Body className="text-muted-foreground text-center text-sm">
          No units added yet. Add at least one unit to proceed.
        </Body>
      )}
    </div>
  );
}
