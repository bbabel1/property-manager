import Link from 'next/link'
import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getVendorDashboardData } from '@/lib/vendor-service'
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell'

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
    <PageShell>
      <PageHeader
        title="Vendors"
        description="Manage your service providers and contractors."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href="/vendors/categories">Manage categories</Link>
            </Button>
            <Button size="sm" className="gap-2" asChild>
              <Link href="/vendors">
                <Plus className="h-4 w-4" />
                Add vendor
              </Link>
            </Button>
          </div>
        }
      />
      <PageBody>
        <VendorsTable vendors={data.vendors} categories={categories} />
      </PageBody>
    </PageShell>
  )
}
