import Link from 'next/link'

export default function ContactsTab() {
  return (
    <div id="panel-contacts" role="tabpanel" aria-labelledby="contacts">
      <div className="rounded-md border border-border bg-card p-4">
        <h3 className="text-foreground text-base font-semibold">Manage property contacts</h3>
        <p className="text-muted-foreground text-sm">
          Open the Contacts workspace filtered to this property to add managers, vendors, or tenants.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/contacts"
            className="text-primary text-sm font-medium underline-offset-4 hover:underline"
          >
            Go to Contacts
          </Link>
          <span className="text-muted-foreground text-sm">|</span>
          <Link
            href="/vendors"
            className="text-primary text-sm font-medium underline-offset-4 hover:underline"
          >
            Manage Vendors
          </Link>
        </div>
      </div>
    </div>
  )
}
