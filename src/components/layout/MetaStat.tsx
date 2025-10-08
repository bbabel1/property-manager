import React from 'react'

export default function MetaStat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      {/* Wrap value in a div to avoid nested <p> elements when value contains block elements */}
      <div className="text-sm text-foreground mt-1 leading-tight">{value}</div>
    </div>
  )
}
