import React, { useState } from 'react';
import { BuildingIcon, HomeIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium ${
              s === 1
                ? 'border-blue-700 bg-blue-700 text-white'
                : 'border-gray-200 bg-gray-100 text-gray-500'
            }`}
          >
            {s}
          </div>
          {i < steps.length - 1 && <div className="h-0.5 w-10 rounded bg-gray-200" />}
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
          <DialogTitle className="text-lg font-semibold">Add New Property</DialogTitle>
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
            <h3 className="text-base font-medium">Property Type</h3>
            <p className="mt-1 text-sm text-gray-500">What type of property are you adding?</p>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {propertyTypes.map((type, idx) => (
              <button
                key={type}
                onClick={() => setSelected(type)}
                className={`flex flex-col items-center rounded-lg border px-4 py-3 text-sm transition hover:shadow-sm ${
                  selected === type
                    ? 'border-blue-600 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                } ${idx === propertyTypes.length - 1 ? 'sm:col-span-2' : ''}`}
                type="button"
              >
                <HomeIcon className="mb-2 h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-800">{type}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-border flex items-center justify-between gap-3 border-t px-6 py-4">
          <button
            type="button"
            disabled
            className="border-border bg-background text-muted-foreground flex items-center gap-2 rounded-md border px-4 py-2 text-sm"
          >
            Previous
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNext?.(selected)}
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
              disabled={!selected}
            >
              Next
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewPropertyModal;
