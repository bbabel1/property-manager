"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function ClearFiltersButton() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function handleClick() {
    const base = searchParams ? searchParams.toString() : ''
    const params = new URLSearchParams(base)
    ;['units', 'unit', 'gl', 'range', 'from', 'to', 'basis'].forEach((param) => params.delete(param))
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }

  return (
    <div className="pb-2 ml-auto">
      <Button type="button" variant="link" className="px-0 text-sm" onClick={handleClick}>
        Clear all filters
      </Button>
    </div>
  )
}
