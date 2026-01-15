'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown } from 'lucide-react';
import { Body, Heading, Label } from '@/ui/typography';

type PersonPayload = {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  alt_phone?: string | null;
  alt_email?: string | null;
  same_as_unit_address?: boolean;
  addr1?: string | null;
  addr2?: string | null;
  city?: string | null;
  state?: string | null;
  postal?: string | null;
  alt_addr1?: string | null;
  alt_addr2?: string | null;
  alt_city?: string | null;
  alt_state?: string | null;
  alt_postal?: string | null;
};

type AddTenantModalProps = {
  open: boolean;
  onOpenChange(open: boolean): void;
  onAddTenant?: (tenant: PersonPayload) => void;
  onAddCosigner?: (cosigner: PersonPayload) => void;
};

export default function AddTenantModal({
  open,
  onOpenChange,
  onAddTenant,
  onAddCosigner,
}: AddTenantModalProps) {
  const [showAltPhone, setShowAltPhone] = useState(false);
  const [showAltEmail, setShowAltEmail] = useState(false);
  const [showAltAddress, setShowAltAddress] = useState(false);
  const [tenantSameAddress, setTenantSameAddress] = useState(true);
  const [tenantAddr1, setTenantAddr1] = useState('');
  const [tenantAddr2, setTenantAddr2] = useState('');
  const [tenantCity, setTenantCity] = useState('');
  const [tenantState, setTenantState] = useState('');
  const [tenantPostal, setTenantPostal] = useState('');
  const [tenantAltAddr1, setTenantAltAddr1] = useState('');
  const [tenantAltAddr2, setTenantAltAddr2] = useState('');
  const [tenantAltCity, setTenantAltCity] = useState('');
  const [tenantAltState, setTenantAltState] = useState('');
  const [tenantAltPostal, setTenantAltPostal] = useState('');
  const [cosignerSameAddress, setCosignerSameAddress] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [altPhone, setAltPhone] = useState('');
  const [altEmail, setAltEmail] = useState('');
  const [activeTab, setActiveTab] = useState<'tenant' | 'cosigner'>('tenant');
  const toNull = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[680px] max-w-[680px]">
        <DialogHeader className="mb-2">
          <DialogTitle>Add applicant, tenant or cosigner</DialogTitle>
        </DialogHeader>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'tenant' | 'cosigner')}
          className="space-y-4"
        >
          <TabsList className="w-full">
            <TabsTrigger value="tenant" className="flex-1">
              Applicant/Tenant
            </TabsTrigger>
            <TabsTrigger value="cosigner" className="flex-1">
              Cosigner
            </TabsTrigger>
          </TabsList>
          <TabsContent value="tenant" className="space-y-5">
            <Section title="Contact information">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="First name" required>
                  <Input
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </Field>
                <Field label="Last name" required>
                  <Input
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Mobile phone number">
                  <Input
                    placeholder="(555) 555-5555"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
                <div className="flex items-end">
                  {!showAltPhone ? (
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => setShowAltPhone(true)}
                    >
                      + Add alternate phone
                    </button>
                  ) : (
                    <Field label="Alternate phone">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="(555) 555-1234"
                          value={altPhone}
                          onChange={(e) => setAltPhone(e.target.value)}
                        />
                        <button
                          type="button"
                          className="text-primary underline"
                          onClick={() => {
                            setShowAltPhone(false);
                            setAltPhone('');
                          }}
                        >
                          × Remove
                        </button>
                      </div>
                    </Field>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Email">
                  <Input
                    placeholder="name@email.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <div className="flex items-end">
                  {!showAltEmail ? (
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => setShowAltEmail(true)}
                    >
                      + Add alternate email
                    </button>
                  ) : (
                    <Field label="Alternate email">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="alt@email.com"
                          type="email"
                          value={altEmail}
                          onChange={(e) => setAltEmail(e.target.value)}
                        />
                        <button
                          type="button"
                          className="text-primary underline"
                          onClick={() => {
                            setShowAltEmail(false);
                            setAltEmail('');
                          }}
                        >
                          × Remove
                        </button>
                      </div>
                    </Field>
                  )}
                </div>
              </div>
            </Section>

            <Section title="Address" required>
              <Label as="label" className="text-foreground flex items-center gap-2">
                <Checkbox
                  checked={tenantSameAddress}
                  onCheckedChange={(v) => {
                    const next = Boolean(v);
                    setTenantSameAddress(next);
                    if (next) {
                      setTenantAddr1('');
                      setTenantAddr2('');
                      setTenantCity('');
                      setTenantState('');
                      setTenantPostal('');
                    } else {
                      setShowAltAddress(false);
                      setTenantAltAddr1('');
                      setTenantAltAddr2('');
                      setTenantAltCity('');
                      setTenantAltState('');
                      setTenantAltPostal('');
                    }
                  }}
                />
                Same as unit address
              </Label>
              {!tenantSameAddress ? (
                <div className="mt-3 space-y-3">
                  <Field label="Address line 1">
                    <Input
                      placeholder="123 Main St"
                      value={tenantAddr1}
                      onChange={(e) => setTenantAddr1(e.target.value)}
                    />
                  </Field>
                  <Field label="Address line 2">
                    <Input
                      placeholder="Unit 3"
                      value={tenantAddr2}
                      onChange={(e) => setTenantAddr2(e.target.value)}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <Field label="City">
                      <Input value={tenantCity} onChange={(e) => setTenantCity(e.target.value)} />
                    </Field>
                    <Field label="State">
                      <Input value={tenantState} onChange={(e) => setTenantState(e.target.value)} />
                    </Field>
                    <Field label="Postal code">
                      <Input
                        value={tenantPostal}
                        onChange={(e) => setTenantPostal(e.target.value)}
                      />
                    </Field>
                  </div>
                </div>
              ) : (
                <div className="mt-2">
                  {!showAltAddress ? (
                    <button
                      type="button"
                      className="text-primary underline"
                      onClick={() => setShowAltAddress(true)}
                    >
                      + Add alternate address
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <Field label="Alternate address line 1">
                        <Input
                          value={tenantAltAddr1}
                          onChange={(e) => setTenantAltAddr1(e.target.value)}
                        />
                      </Field>
                      <Field label="Alternate address line 2">
                        <Input
                          value={tenantAltAddr2}
                          onChange={(e) => setTenantAltAddr2(e.target.value)}
                        />
                      </Field>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Field label="City">
                          <Input
                            value={tenantAltCity}
                            onChange={(e) => setTenantAltCity(e.target.value)}
                          />
                        </Field>
                        <Field label="State">
                          <Input
                            value={tenantAltState}
                            onChange={(e) => setTenantAltState(e.target.value)}
                          />
                        </Field>
                        <Field label="Postal code">
                          <Input
                            value={tenantAltPostal}
                            onChange={(e) => setTenantAltPostal(e.target.value)}
                          />
                        </Field>
                      </div>
                      <button
                        type="button"
                        className="text-primary underline"
                        onClick={() => {
                          setShowAltAddress(false);
                          setTenantAltAddr1('');
                          setTenantAltAddr2('');
                          setTenantAltCity('');
                          setTenantAltState('');
                          setTenantAltPostal('');
                        }}
                      >
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
              <Button
                onClick={() => {
                  if (!firstName.trim() || !lastName.trim()) return;
                  onAddTenant?.({
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                    email: toNull(email),
                    phone: toNull(phone),
                    alt_phone: showAltPhone ? toNull(altPhone) : null,
                    alt_email: showAltEmail ? toNull(altEmail) : null,
                    same_as_unit_address: tenantSameAddress,
                    addr1: tenantSameAddress ? null : toNull(tenantAddr1),
                    addr2: tenantSameAddress ? null : toNull(tenantAddr2),
                    city: tenantSameAddress ? null : toNull(tenantCity),
                    state: tenantSameAddress ? null : toNull(tenantState),
                    postal: tenantSameAddress ? null : toNull(tenantPostal),
                    alt_addr1: tenantSameAddress && showAltAddress ? toNull(tenantAltAddr1) : null,
                    alt_addr2: tenantSameAddress && showAltAddress ? toNull(tenantAltAddr2) : null,
                    alt_city: tenantSameAddress && showAltAddress ? toNull(tenantAltCity) : null,
                    alt_state: tenantSameAddress && showAltAddress ? toNull(tenantAltState) : null,
                    alt_postal:
                      tenantSameAddress && showAltAddress ? toNull(tenantAltPostal) : null,
                  });
                  // Reset form
                  setFirstName('');
                  setLastName('');
                  setEmail('');
                  setPhone('');
                  setAltPhone('');
                  setAltEmail('');
                  setShowAltPhone(false);
                  setShowAltEmail(false);
                  setTenantSameAddress(true);
                  setTenantAddr1('');
                  setTenantAddr2('');
                  setTenantCity('');
                  setTenantState('');
                  setTenantPostal('');
                  setShowAltAddress(false);
                  setTenantAltAddr1('');
                  setTenantAltAddr2('');
                  setTenantAltCity('');
                  setTenantAltState('');
                  setTenantAltPostal('');
                }}
                disabled={!firstName.trim() || !lastName.trim()}
              >
                Add tenant
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </TabsContent>
          <TabsContent value="cosigner" className="space-y-5">
            <Section title="Contact information">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="First name" required>
                  <Input
                    placeholder="First name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </Field>
                <Field label="Last name" required>
                  <Input
                    placeholder="Last name"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Mobile phone number">
                  <Input
                    placeholder="(555) 555-5555"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Email">
                  <Input
                    placeholder="name@email.com"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              </div>
            </Section>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => {
                  if (!firstName.trim() || !lastName.trim()) return;
                  onAddCosigner?.({
                    first_name: firstName.trim(),
                    last_name: lastName.trim(),
                    email: toNull(email),
                    phone: toNull(phone),
                    same_as_unit_address: cosignerSameAddress,
                  });
                  // Reset form
                  setFirstName('');
                  setLastName('');
                  setEmail('');
                  setPhone('');
                  setAltPhone('');
                  setAltEmail('');
                  setShowAltPhone(false);
                  setShowAltEmail(false);
                  setTenantSameAddress(true);
                  setTenantAddr1('');
                  setTenantAddr2('');
                  setTenantCity('');
                  setTenantState('');
                  setTenantPostal('');
                  setShowAltAddress(false);
                  setTenantAltAddr1('');
                  setTenantAltAddr2('');
                  setTenantAltCity('');
                  setTenantAltState('');
                  setTenantAltPostal('');
                  setCosignerSameAddress(true);
                  onOpenChange(false);
                }}
                disabled={!firstName.trim() || !lastName.trim()}
              >
                Add cosigner
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  required,
  children,
}: {
  title: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border/70 rounded-lg border">
      <div className="border-border/60 bg-muted text-foreground border-b px-4 py-2">
        <Heading as="div" size="h6">
          {title}
          {required ? <span className="text-destructive ml-1">*</span> : null}
        </Heading>
      </div>
      <div className="space-y-3 px-4 py-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <Label as="span" size="xs" tone="muted" className="tracking-wide uppercase">
        {label}
        {required ? ' *' : ''}
      </Label>
      {children}
    </label>
  );
}

function Disclosure({ title }: { title: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-border/70 rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="text-foreground flex w-full items-center justify-between px-4 py-3"
      >
        <Label as="span">{title}</Label>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <Body tone="muted" className="px-4 pb-4">
          Form fields coming soon.
        </Body>
      ) : null}
    </div>
  );
}
