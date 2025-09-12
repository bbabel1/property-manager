"use client"

import { useFormContext } from "react-hook-form"

export default function TextField({ name, label, placeholder, type = 'text', disabled }: {
  name: string
  label: string
  placeholder?: string
  type?: string
  disabled?: boolean
}) {
  const { register, formState } = useFormContext()
  const err = (formState.errors as any)?.[name]?.message as string | undefined
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input type={type} {...register(name)} placeholder={placeholder}
             disabled={disabled}
             className="w-full h-9 px-3 border border-border rounded-md bg-background text-foreground text-sm" />
      {err && <p className="text-xs text-destructive mt-1">{err}</p>}
    </div>
  )
}

