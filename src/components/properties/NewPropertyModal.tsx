import React, { useState } from 'react';
import { BuildingIcon, HomeIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Body, Heading, Label } from '@/ui/typography';

interface NewPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNext?: (selectedType: string | null) => void;
}

const propertyTypes = [
  'CondoTownhome',
  'MultiFamily',
  'SingleFamily',
  'Industrial',
  'Office',
  'Retail',
  'ShoppingCenter',
  'Storage',
  'ParkingSpace',
];

const Stepper = () => {
  const steps = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center justify-center gap-3">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full border ${
              s === 1
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-muted text-muted-foreground'
            }`}
          >
            <Label as="span" size="sm">
              {s}
            </Label>
          </div>
          {i < steps.length - 1 && <div className="h-0.5 w-10 rounded bg-muted" />}
        </React.Fragment>
      ))}
    </div>
  );
};

const NewPropertyModal = ({ isOpen, onClose, onNext }: NewPropertyModalProps) => {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="bg-card border-border/80 max-h-[90vh] w-[680px] max-w-[680px] overflow-y-auto rounded-none border p-0 shadow-2xl sm:rounded-2xl">
        {/* Header */}
        <DialogHeader className="border-border border-b px-6 py-4">
          <DialogTitle>
            <Heading as="div" size="h4">
              Add New Property
            </Heading>
          </DialogTitle>
        </DialogHeader>

        {/* Body */}
        <div className="px-8 py-6">
          <div className="mb-6">
            <Stepper />
          </div>

          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-3 rounded-full bg-blue-50 p-3 text-blue-700">
              <BuildingIcon className="h-7 w-7" />
            </div>
            <Heading as="h3" size="h6">
              Property Type
            </Heading>
            <Body as="p" size="sm" tone="muted" className="mt-1">
              What type of property are you adding?
            </Body>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {propertyTypes.map((type, idx) => (
              <button
                key={type}
                onClick={() => setSelected(type)}
                className={`flex flex-col items-center rounded-lg border px-4 py-3 transition hover:shadow-sm ${
                  selected === type
                    ? 'border-blue-600 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                } ${idx === propertyTypes.length - 1 ? 'sm:col-span-2' : ''}`}
                type="button"
              >
                <HomeIcon className="mb-2 h-4 w-4 text-muted-foreground" />
                <Label as="span" size="sm">
                  {type}
                </Label>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-border flex items-center justify-between gap-3 border-t px-6 py-4">
          <button
            type="button"
            disabled
            className="border-border bg-background text-muted-foreground flex items-center gap-2 rounded-md border px-4 py-2"
          >
            <Label as="span" size="sm" tone="muted">
              Previous
            </Label>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNext?.(selected)}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 hover:opacity-90 disabled:opacity-60"
              disabled={!selected}
            >
              <Label as="span" size="sm">
                Next
              </Label>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewPropertyModal;
