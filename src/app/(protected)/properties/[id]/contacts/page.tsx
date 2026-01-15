import Link from 'next/link'
import { Body, Heading, Label } from '@/ui/typography'

export default function ContactsTab() {
  return (
    <div id="panel-contacts" role="tabpanel" aria-labelledby="contacts">
      <div className="rounded-md border border-border bg-card p-4">
        <Heading as="h3" size="h5">
          Manage property contacts
        </Heading>
        <Body tone="muted" size="sm">
          Open the Contacts workspace filtered to this property to add managers, vendors, or tenants.
        </Body>
        <div className="mt-3 flex flex-wrap gap-2">
          <Label
            as={Link}
            href="/contacts"
            className="text-primary underline-offset-4 hover:underline"
          >
            Go to Contacts
          </Label>
          <Body as="span" tone="muted" size="sm">
            |
          </Body>
          <Label
            as={Link}
            href="/vendors"
            className="text-primary underline-offset-4 hover:underline"
          >
            Manage Vendors
          </Label>
        </div>
      </div>
    </div>
  )
}
