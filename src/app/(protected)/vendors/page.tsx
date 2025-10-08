import { getVendorDashboardData } from '@/lib/vendor-service'
import VendorSummary from '@/components/vendors/VendorSummary'
import VendorDirectory from '@/components/vendors/VendorDirectory'
import VendorFinancials from '@/components/vendors/VendorFinancials'
import VendorAutomation from '@/components/vendors/VendorAutomation'
import VendorSchedule from '@/components/vendors/VendorSchedule'
import VendorAiPanel from '@/components/vendors/VendorAiPanel'
import VendorSourcingPanel from '@/components/vendors/VendorSourcingPanel'
import { Button } from '@/components/ui/button'
import { Import, Plus, Upload } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function VendorsPage() {
  const data = await getVendorDashboardData()

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-gradient-to-br from-background via-background to-muted/30 p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-foreground">Vendor Management Hub</h1>
            <p className="text-sm text-muted-foreground">
              AI-first vendor sourcing, scheduling, compliance, and financial workflows aligned with your Buildium data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Invite vendor
            </Button>
            <Button variant="outline" className="gap-2">
              <Import className="h-4 w-4" />
              Sync Buildium vendors
            </Button>
            <Button variant="ghost" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload COI
            </Button>
          </div>
        </div>
      </section>

      <VendorSummary data={data} />

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <VendorDirectory vendors={data.vendors} />
        <div className="flex flex-col gap-4">
          <VendorAiPanel snapshot={data.aiSnapshot} />
          <VendorSourcingPanel snapshot={data.aiSnapshot} />
        </div>
      </div>

      <VendorFinancials spend={data.spendByVendor} quotePipeline={data.quotePipeline} summary={data.summary} />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <VendorSchedule schedule={data.schedule} />
        <VendorAutomation complianceAlerts={data.complianceAlerts} automationSignals={data.automationSignals} />
      </div>
    </div>
  )
}

