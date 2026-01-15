import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Body, Heading } from '@/ui/typography'

export default function TenantsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Heading as="h1" size="h2" className="flex items-center">
          Tenants
        </Heading>
        <Button className="flex items-center">
          <Users className="h-4 w-4 mr-2" />
          Add Tenant
        </Button>
      </div>
      
      <div className="bg-card rounded-lg border p-6">
        <Heading as="h2" size="h3" className="mb-4">
          Tenants Management
        </Heading>
        <Body tone="muted">
          This page will contain the tenants management interface.
        </Body>
      </div>
    </div>
  )
}
