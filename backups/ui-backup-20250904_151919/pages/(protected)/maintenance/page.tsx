import { Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function MaintenancePage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Maintenance</h1>
        <Button className="flex items-center">
          <Wrench className="h-4 w-4 mr-2" />
          Create Work Order
        </Button>
      </div>
      
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-medium text-foreground mb-4">Maintenance Management</h2>
        <p className="text-muted-foreground">This page will contain the maintenance and work order management interface.</p>
      </div>
    </div>
  )
}
