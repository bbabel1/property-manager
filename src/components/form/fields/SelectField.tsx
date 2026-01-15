"use client"

import { useFormContext } from "react-hook-form"
import { Select } from "@/ui/select"

type Option = { value: string; label: string }

export default function SelectField({ name, label, options, placeholder, disabled }: {
  name: string
  label: string
  options: Option[]
  placeholder?: string
  disabled?: boolean
}) {
  const { register, formState } = useFormContext()
  const fieldError = formState.errors?.[name as keyof typeof formState.errors]
  const err =
    fieldError && typeof fieldError === 'object' && 'message' in fieldError
      ? (fieldError as { message?: string }).message
      : undefined
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <Select {...register(name)} disabled={disabled} className="h-9 px-2 text-sm">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </Select>
      {err && <p className="text-xs text-destructive mt-1">{err}</p>}
    </div>
  )
}
