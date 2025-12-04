import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PropertyVendorsProps {
  propertyId: string
}

export function PropertyVendors({ propertyId }: PropertyVendorsProps) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center">
      <div className="mx-auto max-w-xl space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Vendor automation available
        </div>
        <h3 className="text-lg font-semibold text-foreground">Manage vendors from the centralized VMS hub</h3>
        <p className="text-sm text-muted-foreground">
          Source, engage, and monitor vendors with AI-powered recommendations, automated RFQs, compliance alerts, and Buildium-synced billing.
        </p>
        <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
          <span>Property context preserved</span>
          <span>•</span>
          <span>Trigger RFQs directly from jobs</span>
          <span>•</span>
          <span>Track financials and documents</span>
        </div>
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button asChild className="gap-2">
            <Link href={{ pathname: '/vendors', query: { propertyId } }}>
              Open Vendor Management
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" className="text-xs text-muted-foreground">
            <Link href="/vendors#automation">View automation playbooks</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
