"use client"

import { Button } from "@/components/ui/button"

export default function ClearFiltersButton() {
  function handleClick() {
    const url = new URL(window.location.href)
    ;['units', 'unit', 'gl', 'range', 'from', 'to'].forEach((param) => url.searchParams.delete(param))
    window.location.assign(url.toString())
  }

  return (
    <div className="pb-2 ml-auto">
      <Button type="button" variant="link" className="px-0 text-sm" onClick={handleClick}>
        Clear all filters
      </Button>
    </div>
  )
}
