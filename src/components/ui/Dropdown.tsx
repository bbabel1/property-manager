import { Listbox } from '@headlessui/react';
import React from 'react';

/**
 * Dropdown component (Headless UI Listbox)
 * Props:
 * - value: selected value
 * - onChange: function to call with new value
 * - options: array of { value, label }
 * - placeholder: string to show when no value is selected
 */
export function Dropdown({ value, onChange, options, placeholder }) {
  return (
    <div className="relative">
      <Listbox value={value} onChange={onChange}>
        <Listbox.Button className="w-full h-9 px-3 py-2 bg-white border border-gray-300 rounded-md text-gray-900 appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:border-blue-500 flex items-center justify-between">
          <span className="block truncate text-sm">
            {value ? options.find(o => o.value === value)?.label : placeholder}
          </span>
          <svg className="h-5 w-5 text-gray-400 ml-2" viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M7 7l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Listbox.Button>
        <Listbox.Options className="absolute z-10 mt-1 w-full bg-white text-gray-900 max-h-60 rounded-md border border-gray-300 ring-1 ring-black/5 focus:outline-none p-1 overflow-auto animate-in fade-in-0 zoom-in-95">
          {options.map(option => (
            <Listbox.Option
              key={option.value}
              value={option.value}
              className="relative flex w-full select-none items-center rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground hover:bg-accent hover:text-accent-foreground data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground"
            >
              {option.label}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </Listbox>
    </div>
  );
}
