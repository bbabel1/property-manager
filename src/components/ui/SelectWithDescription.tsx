"use client"

import * as Select from '@radix-ui/react-select'
import { ChevronDown, ChevronUp, Check } from 'lucide-react'
import React from 'react'
import clsx from 'clsx'

export type OptionWithDescription = {
  value: string
  label: string
  description?: string
}

export function SelectWithDescription({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  triggerClassName,
}: {
  value: string | ''
  onChange: (v: string) => void
  options: OptionWithDescription[]
  placeholder?: string
  triggerClassName?: string
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        className={clsx(
          'w-full h-11 px-3 border border-border rounded-md bg-background text-foreground text-sm inline-flex items-center justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          triggerClassName
        )}
      >
        <Select.Value placeholder={<span className="text-muted-foreground">{placeholder}</span>} />
        <Select.Icon>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="z-50 overflow-hidden rounded-md border border-border bg-card text-popover-foreground shadow-lg shadow-black/10 dark:bg-card">
          <Select.ScrollUpButton className="flex items-center justify-center py-1">
            <ChevronUp className="h-4 w-4" />
          </Select.ScrollUpButton>
          <Select.Viewport className="p-1">
            {options.map(opt => (
              <Select.Item key={opt.value} value={opt.value} className="relative flex cursor-pointer select-none items-start rounded p-2 hover:bg-muted focus:bg-muted focus:outline-none">
                <div className="leading-tight">
                  <div className="text-sm font-medium">
                    {/* ItemText is used by Radix for the value shown in the trigger; keep it to label only */}
                    <Select.ItemText>{opt.label}</Select.ItemText>
                  </div>
                  {opt.description ? (
                    <div className="text-xs text-muted-foreground">{opt.description}</div>
                  ) : null}
                </div>
                <Select.ItemIndicator className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Check className="h-4 w-4" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        <Select.ScrollDownButton className="flex items-center justify-center py-1">
          <ChevronDown className="h-4 w-4" />
        </Select.ScrollDownButton>
      </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
