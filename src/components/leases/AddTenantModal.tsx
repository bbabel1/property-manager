"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDown } from 'lucide-react'

type AddTenantModalProps = {
  open: boolean
  onOpenChange(open: boolean): void
}

export default function AddTenantModal({ open, onOpenChange }: AddTenantModalProps) {
  const [showAltPhone, setShowAltPhone] = useState(false)
  const [showAltEmail, setShowAltEmail] = useState(false)
  const [showAltAddress, setShowAltAddress] = useState(false)
  const [sameAddress, setSameAddress] = useState(true)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-3rem)] sm:max-w-4xl md:max-w-5xl">
        <DialogHeader className="mb-2">
          <DialogTitle>Add applicant, tenant or cosigner</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="tenant" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="tenant" className="flex-1">Applicant/Tenant</TabsTrigger>
            <TabsTrigger value="cosigner" className="flex-1">Cosigner</TabsTrigger>
          </TabsList>
          <TabsContent value="tenant" className="space-y-5">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox disabled />
              Choose existing tenant or applicant (coming soon)
            </label>

            <Section title="Contact information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="First name" required><Input placeholder="First name" /></Field>
                <Field label="Last name" required><Input placeholder="Last name" /></Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Mobile phone number"><Input placeholder="(555) 555-5555" /></Field>
                <div className="flex items-end">
                  {!showAltPhone ? (
                    <button type="button" className="text-primary text-sm underline" onClick={() => setShowAltPhone(true)}>
                      + Add alternate phone
                    </button>
                  ) : (
                    <Field label="Alternate phone">
                      <div className="flex items-center gap-2">
                        <Input placeholder="(555) 555-1234" />
                        <button type="button" className="text-primary text-sm underline" onClick={() => setShowAltPhone(false)}>
                          × Remove
                        </button>
                      </div>
                    </Field>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Email"><Input placeholder="name@email.com" /></Field>
                <div className="flex items-end">
                  {!showAltEmail ? (
                    <button type="button" className="text-primary text-sm underline" onClick={() => setShowAltEmail(true)}>
                      + Add alternate email
                    </button>
                  ) : (
                    <Field label="Alternate email">
                      <div className="flex items-center gap-2">
                        <Input placeholder="alt@email.com" />
                        <button type="button" className="text-primary text-sm underline" onClick={() => setShowAltEmail(false)}>
                          × Remove
                        </button>
                      </div>
                    </Field>
                  )}
                </div>
              </div>
            </Section>

            <Section title="Address" required>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox checked={sameAddress} onCheckedChange={(v) => setSameAddress(Boolean(v))} />
                Same as unit address
              </label>
              {!sameAddress ? (
                <div className="mt-3 space-y-3">
                  <Field label="Address line 1"><Input placeholder="123 Main St" /></Field>
                  <Field label="Address line 2"><Input placeholder="Unit 3" /></Field>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Field label="City"><Input /></Field>
                    <Field label="State"><Input /></Field>
                    <Field label="Postal code"><Input /></Field>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  {!showAltAddress ? (
                    <button type="button" className="text-primary text-sm underline" onClick={() => setShowAltAddress(true)}>
                      + Add alternate address
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <Field label="Alternate address line 1"><Input /></Field>
                      <Field label="Alternate address line 2"><Input /></Field>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Field label="City"><Input /></Field>
                        <Field label="State"><Input /></Field>
                        <Field label="Postal code"><Input /></Field>
                      </div>
                      <button type="button" className="text-primary text-sm underline" onClick={() => setShowAltAddress(false)}>
                        × Remove alternate address
                      </button>
                    </div>
                  )}
                </div>
              )}
            </Section>

            <Disclosure title="Personal information" />
            <Disclosure title="Emergency contact" />

            <div className="flex items-center gap-2">
              <Button>Add tenant</Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="cosigner" className="space-y-5">
            <p className="text-sm text-muted-foreground">Cosigner onboarding coming soon.</p>
            <div className="flex items-center gap-2">
              <Button disabled>Add cosigner</Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, required, children }: { title: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/70">
      <div className="border-b border-border/60 bg-muted px-4 py-2 text-sm font-medium text-foreground">
        {title}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </div>
      <div className="space-y-3 px-4 py-4 text-sm text-muted-foreground">{children}</div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground uppercase">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}

function Disclosure({ title }: { title: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-border/70">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
      >
        {title}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="px-4 pb-4 text-sm text-muted-foreground">Form fields coming soon.</div> : null}
    </div>
  )
}
