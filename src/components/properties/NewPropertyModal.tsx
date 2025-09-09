import React, { useState } from 'react'
import { BuildingIcon, HomeIcon, XIcon } from 'lucide-react'

interface NewPropertyModalProps {
  isOpen: boolean
  onClose: () => void
  onNext?: (selectedType: string | null) => void
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
]

const Stepper = () => {
  const steps = [1, 2, 3, 4, 5]
  return (
    <div className="flex items-center justify-center gap-3">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-medium ${
              s === 1
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}
          >
            {s}
          </div>
          {i < steps.length - 1 && (
            <div className="h-0.5 w-10 rounded bg-gray-200" />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

const NewPropertyModal = ({ isOpen, onClose, onNext }: NewPropertyModalProps) => {
  const [selected, setSelected] = useState<string | null>(null)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-[680px] max-w-[92vw] rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Add New Property</h2>
          <button
            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            {/* Fallback to X if icon mapping differs */}
            <span className="block leading-none text-xl">×</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          <div className="mb-6">
            <Stepper />
          </div>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="mb-3 rounded-full bg-blue-50 p-3 text-blue-700">
              <BuildingIcon className="h-7 w-7" />
            </div>
            <h3 className="text-base font-medium">Property Type</h3>
            <p className="mt-1 text-sm text-gray-500">
              What type of property are you adding?
            </p>
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
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            disabled
            className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm text-gray-400"
          >
            Previous
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNext?.(selected)}
              className="rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
              disabled={!selected}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NewPropertyModal

