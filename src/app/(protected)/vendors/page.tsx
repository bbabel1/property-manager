import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getVendorDashboardData } from '@/lib/vendor-service'

import { VendorsTable } from './_components/vendor-table'

export const dynamic = 'force-dynamic'

export default async function VendorsPage() {
  const data = await getVendorDashboardData()

  const categories = Array.from(
    new Set(
      data.vendors
        .map((vendor) => (vendor.categoryName ? vendor.categoryName.trim() : null))
        .filter((name): name is string => Boolean(name))
    )
  ).sort((a, b) => a.localeCompare(b))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Vendors</h1>
          <p className="text-muted-foreground">Manage your service providers and contractors.</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Vendor
        </Button>
      </div>

      <VendorsTable vendors={data.vendors} categories={categories} />
    </div>
  )
}
