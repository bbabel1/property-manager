"use client"

import { useMemo } from "react"

export default function DateRangeControls({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: Date
  defaultTo: Date
}) {
  const fromStr = useMemo(() => defaultFrom.toISOString().slice(0, 10), [defaultFrom])
  const toStr = useMemo(() => defaultTo.toISOString().slice(0, 10), [defaultTo])

  function update(param: "from" | "to", value: string) {
    const url = new URL(window.location.href)
    if (value) url.searchParams.set(param, value)
    else url.searchParams.delete(param)
    // Remove legacy as_of param if present
    url.searchParams.delete("as_of")
    window.location.assign(url.toString())
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted-foreground" htmlFor="from">From</label>
      <input
        id="from"
        type="date"
        defaultValue={fromStr}
        onChange={(e) => update("from", e.target.value)}
        className="border border-border rounded px-2 py-1 text-sm bg-background"
      />
      <label className="text-sm text-muted-foreground" htmlFor="to">To</label>
      <input
        id="to"
        type="date"
        defaultValue={toStr}
        onChange={(e) => update("to", e.target.value)}
        className="border border-border rounded px-2 py-1 text-sm bg-background"
      />
    </div>
  )
}

