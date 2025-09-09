import { FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LeasesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Lease Renewals</h1>
        <Button className="flex items-center">
          <FileText className="h-4 w-4 mr-2" />
          Add Lease
        </Button>
      </div>
      
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-medium text-foreground mb-4">Lease Management</h2>
        <p className="text-muted-foreground">This page will contain the lease renewals and management interface.</p>
      </div>
    </div>
  )
}
