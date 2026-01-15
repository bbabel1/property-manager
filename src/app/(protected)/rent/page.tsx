import { DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Body, Heading } from '@/ui/typography'

export default function RentPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Heading as="h1" size="h3" className="font-bold">
          Rent Tracking
        </Heading>
        <Button className="flex items-center">
          <DollarSign className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </div>
      
      <div className="bg-card rounded-lg border p-6">
        <Heading as="h2" size="h5" className="mb-4">
          Rent Tracking
        </Heading>
        <Body tone="muted" size="sm">
          This page will contain the rent tracking and payment management interface.
        </Body>
      </div>
    </div>
  )
}
