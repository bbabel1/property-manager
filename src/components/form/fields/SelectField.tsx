"use client"

import { useFormContext } from "react-hook-form"

type Option = { value: string; label: string }

export default function SelectField({ name, label, options, placeholder, disabled }: {
  name: string
  label: string
  options: Option[]
  placeholder?: string
  disabled?: boolean
}) {
  const { register, formState, setValue } = useFormContext()
  const err = (formState.errors as any)?.[name]?.message as string | undefined
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <select {...register(name)} disabled={disabled}
              className="w-full h-9 px-2 border border-border rounded-md bg-background text-foreground text-sm">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {err && <p className="text-xs text-destructive mt-1">{err}</p>}
    </div>
  )
}

