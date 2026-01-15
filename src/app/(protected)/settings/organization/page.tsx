"use client"

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { COUNTRIES } from '@/lib/constants/countries'
import { Body, Heading } from '@/ui/typography'

type OrgFormState = {
  companyName: string
  url: string
  contactFirstName: string
  contactLastName: string
  contactPhoneNumber: string
  addressLine1: string
  addressLine2: string
  addressLine3: string
  city: string
  state: string
  postalCode: string
  country: string
  accountingBookId: string
  defaultBankAccountId: string
  defaultAccountingBasis: 'Accrual' | 'Cash'
  trustAccountWarning: 'Off' | 'ByProperty' | 'ByRentalOwner'
  fiscalYearEndMonth: string
  fiscalYearEndDay: string
}

type ApiOrganization = {
  Id: number | null
  CompanyName: string | null
  Url: string | null
  Contact:
    | {
        FirstName: string | null
        LastName: string | null
        PhoneNumber: string | null
        Address:
          | {
              AddressLine1: string | null
              AddressLine2: string | null
              AddressLine3: string | null
              City: string | null
              State: string | null
              PostalCode: string | null
              Country: string | null
            }
          | null
      }
    | null
  AccountingSettings:
    | {
        AccountingBookId: number | null
        DefaultBankAccountId: number | null
        DefaultAccountingBasis: 'Accrual' | 'Cash' | null
        TrustAccountWarning: 'Off' | 'ByProperty' | 'ByRentalOwner' | null
        FiscalYearEndMonth: number | null
        FiscalYearEndDay: number | null
      }
    | null
}

const ACCOUNTING_BASIS_OPTIONS: OrgFormState['defaultAccountingBasis'][] = ['Accrual', 'Cash']
const TRUST_ACCOUNT_WARNING_OPTIONS: OrgFormState['trustAccountWarning'][] = ['Off', 'ByProperty', 'ByRentalOwner']
const COUNTRY_NOT_SET_VALUE = '__not_set__'

const parseNumber = (value: string): number | null => {
  if (!value || value.trim().length === 0) return null
  const num = Number(value)
  return Number.isFinite(num) ? Math.trunc(num) : null
}

export default function OrganizationPage() {
  const [orgPublicId, setOrgPublicId] = useState<number | null>(null)
  const [form, setForm] = useState<OrgFormState>({
    companyName: '',
    url: '',
    contactFirstName: '',
    contactLastName: '',
    contactPhoneNumber: '',
    addressLine1: '',
    addressLine2: '',
    addressLine3: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    accountingBookId: '',
    defaultBankAccountId: '',
    defaultAccountingBasis: 'Accrual',
    trustAccountWarning: 'Off',
    fiscalYearEndMonth: '',
    fiscalYearEndDay: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [initialForm, setInitialForm] = useState<OrgFormState | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([])
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false)
  const [bankAccountsError, setBankAccountsError] = useState<string | null>(null)

  const setField = <K extends keyof OrgFormState>(key: K, value: OrgFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const hydrateForm = useCallback((organization: ApiOrganization) => {
    const contact = organization.Contact
    const address = contact?.Address
    const accounting = organization.AccountingSettings
    const countryFromApi = address?.Country && COUNTRIES.includes(address.Country as (typeof COUNTRIES)[number]) ? address.Country : ''

    setOrgPublicId(organization.Id ?? null)
    const hydrated: OrgFormState = {
      companyName: organization.CompanyName ?? '',
      url: organization.Url ?? '',
      contactFirstName: contact?.FirstName ?? '',
      contactLastName: contact?.LastName ?? '',
      contactPhoneNumber: contact?.PhoneNumber ?? '',
      addressLine1: address?.AddressLine1 ?? '',
      addressLine2: address?.AddressLine2 ?? '',
      addressLine3: address?.AddressLine3 ?? '',
      city: address?.City ?? '',
      state: address?.State ?? '',
      postalCode: address?.PostalCode ?? '',
      country: countryFromApi,
      accountingBookId:
        accounting?.AccountingBookId !== null && accounting?.AccountingBookId !== undefined
          ? String(accounting.AccountingBookId)
          : '',
      defaultBankAccountId:
        accounting?.DefaultBankAccountId !== null && accounting?.DefaultBankAccountId !== undefined
          ? String(accounting.DefaultBankAccountId)
          : '',
      defaultAccountingBasis: (accounting?.DefaultAccountingBasis ?? 'Accrual') as OrgFormState['defaultAccountingBasis'],
      trustAccountWarning: (accounting?.TrustAccountWarning ?? 'Off') as OrgFormState['trustAccountWarning'],
      fiscalYearEndMonth:
        accounting?.FiscalYearEndMonth !== null && accounting?.FiscalYearEndMonth !== undefined
          ? String(accounting.FiscalYearEndMonth)
          : '',
      fiscalYearEndDay:
        accounting?.FiscalYearEndDay !== null && accounting?.FiscalYearEndDay !== undefined
          ? String(accounting.FiscalYearEndDay)
          : '',
    }
    setForm(hydrated)
    setInitialForm(hydrated)
  }, [])

  const loadBankAccounts = useCallback(async () => {
    setBankAccountsLoading(true)
    setBankAccountsError(null)
    try {
      const res = await fetch('/api/gl-accounts?isBankAccount=true')
      const payload = await res.json()
      if (!res.ok) {
        const message = payload?.error || 'Failed to load bank accounts'
        setBankAccountsError(message)
        return
      }
      const options: BankAccountOption[] = []
      const accountRows = Array.isArray(payload?.data) ? (payload.data as { public_id?: unknown; id?: unknown; account_number?: unknown; name?: unknown }[]) : []
      for (const row of accountRows) {
        const value =
          row.public_id !== undefined && row.public_id !== null
            ? String(row.public_id)
            : row.id
              ? String(row.id)
              : null
        if (!value) continue
        const num = typeof row.account_number === 'string' ? ` (${row.account_number})` : ''
        options.push({
          label: `${(row.name as string | undefined) ?? 'Unnamed account'}${num}`,
          value,
        })
      }
      setBankAccounts(options)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load bank accounts'
      setBankAccountsError(message)
    } finally {
      setBankAccountsLoading(false)
    }
  }, [])

  const loadOrganization = useCallback(async () => {
    setLoading(true)
    setPageError(null)
    try {
      const res = await fetch('/api/organization')
      const payload = await res.json()
      if (!res.ok) {
        const message = payload?.error || 'Failed to load organization'
        setPageError(message)
        toast.error('Unable to load organization', { description: message })
        return
      }
      hydrateForm(payload.organization as ApiOrganization)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load organization'
      setPageError(message)
      toast.error('Unable to load organization', { description: message })
    } finally {
      setLoading(false)
    }
  }, [hydrateForm])

  useEffect(() => {
    void loadOrganization()
    void loadBankAccounts()
  }, [loadOrganization, loadBankAccounts])

  const selectedBankAccountId = form.defaultBankAccountId || 'none'

  const handleSave = async () => {
    if (!form.companyName.trim()) {
      toast.error('Organization name is required')
      return
    }

    const accountingBookId = parseNumber(form.accountingBookId)
    if (form.accountingBookId && accountingBookId === null) {
      toast.error('Accounting book ID must be a number')
      return
    }
    const trimmedBankAccount = form.defaultBankAccountId.trim()
    const selectedBankOption = trimmedBankAccount
      ? bankAccounts.find((acct) => acct.value === trimmedBankAccount)
      : null
    if (trimmedBankAccount && !selectedBankOption) {
      toast.error('Default bank account must come from the bank accounts list')
      return
    }
    const defaultBankAccountId = selectedBankOption ? parseNumber(selectedBankOption.value) : null

    const fiscalMonthRaw = form.fiscalYearEndMonth.trim()
    const fiscalMonth = parseNumber(fiscalMonthRaw)
    if (fiscalMonth !== null && fiscalMonth !== 0 && (fiscalMonth < 1 || fiscalMonth > 12)) {
      toast.error('Fiscal year end month must be between 1 and 12 (or leave blank)')
      return
    }
    const fiscalDayRaw = form.fiscalYearEndDay.trim()
    const fiscalDay = parseNumber(fiscalDayRaw)
    if (fiscalDay !== null && fiscalDay !== 0 && (fiscalDay < 1 || fiscalDay > 31)) {
      toast.error('Fiscal year end day must be between 1 and 31 (or leave blank)')
      return
    }

    const addressPresent =
      form.addressLine1.trim() ||
      form.addressLine2.trim() ||
      form.addressLine3.trim() ||
      form.city.trim() ||
      form.state.trim() ||
      form.postalCode.trim() ||
      form.country.trim()

    const contactPresent =
      form.contactFirstName.trim() ||
      form.contactLastName.trim() ||
      form.contactPhoneNumber.trim() ||
      addressPresent

    const payload = {
      CompanyName: form.companyName.trim(),
      Url: form.url.trim() || null,
      Contact: contactPresent
        ? {
            FirstName: form.contactFirstName.trim() || null,
            LastName: form.contactLastName.trim() || null,
            PhoneNumber: form.contactPhoneNumber.trim() || null,
            Address: addressPresent
              ? {
                  AddressLine1: form.addressLine1.trim() || null,
                  AddressLine2: form.addressLine2.trim() || null,
                  AddressLine3: form.addressLine3.trim() || null,
                  City: form.city.trim() || null,
                  State: form.state.trim() || null,
                  PostalCode: form.postalCode.trim() || null,
                  Country: form.country.trim() || null,
                }
              : null,
          }
        : null,
      AccountingSettings: {
        AccountingBookId: accountingBookId,
        DefaultBankAccountId: defaultBankAccountId,
        DefaultAccountingBasis: form.defaultAccountingBasis,
        TrustAccountWarning: form.trustAccountWarning,
        FiscalYearEndMonth: fiscalMonth === 0 ? null : fiscalMonth,
        FiscalYearEndDay: fiscalDay === 0 ? null : fiscalDay,
      },
    }

    setSaving(true)
    try {
      const res = await fetch('/api/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const response = await res.json()
      if (!res.ok) {
        const message = response?.error || 'Failed to save organization'
        toast.error('Save failed', { description: message })
        return
      }
      hydrateForm(response.organization as ApiOrganization)
      toast.success('Organization profile updated')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save organization'
      toast.error('Save failed', { description: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Heading as="h1" size="h2">
          Organization
        </Heading>
        <Body as="p" tone="muted" size="sm">
          Keep your organization profile, contact, and accounting settings aligned with the data stored in the
          organizations table.
        </Body>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Org profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {pageError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {pageError}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Organization name</Label>
              <Input
                id="companyName"
                value={form.companyName}
                onChange={(e) => setField('companyName', e.target.value)}
                placeholder="Ora Property Management"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgUrl">Organization URL</Label>
              <Input
                id="orgUrl"
                value={form.url}
                onChange={(e) => setField('url', e.target.value)}
                placeholder="https://example.com"
                disabled={loading || saving}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">Primary contact first name</Label>
              <Input
                id="firstName"
                value={form.contactFirstName}
                onChange={(e) => setField('contactFirstName', e.target.value)}
                placeholder="Alex"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Primary contact last name</Label>
              <Input
                id="lastName"
                value={form.contactLastName}
                onChange={(e) => setField('contactLastName', e.target.value)}
                placeholder="Johnson"
                disabled={loading || saving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Primary contact phone</Label>
            <Input
              id="phoneNumber"
              value={form.contactPhoneNumber}
              onChange={(e) => setField('contactPhoneNumber', e.target.value)}
              placeholder="(555) 555-1234"
              disabled={loading || saving}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address1">Address line 1</Label>
              <Input
                id="address1"
                value={form.addressLine1}
                onChange={(e) => setField('addressLine1', e.target.value)}
                placeholder="123 Main St"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address2">Address line 2</Label>
              <Input
                id="address2"
                value={form.addressLine2}
                onChange={(e) => setField('addressLine2', e.target.value)}
                placeholder="Suite 400"
                disabled={loading || saving}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="address3">Address line 3</Label>
              <Input
                id="address3"
                value={form.addressLine3}
                onChange={(e) => setField('addressLine3', e.target.value)}
                placeholder="Building B"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setField('city', e.target.value)}
                placeholder="New York"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State / Province</Label>
              <Input
                id="state"
                value={form.state}
                onChange={(e) => setField('state', e.target.value)}
                placeholder="NY"
                disabled={loading || saving}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input
                id="postalCode"
                value={form.postalCode}
                onChange={(e) => setField('postalCode', e.target.value)}
                placeholder="10001"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="country">Country</Label>
              <Select
                value={form.country || COUNTRY_NOT_SET_VALUE}
                onValueChange={(value) =>
                  setField('country', value === COUNTRY_NOT_SET_VALUE ? '' : value)
                }
                disabled={loading || saving}
              >
                <SelectTrigger id="country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={COUNTRY_NOT_SET_VALUE}>Not set</SelectItem>
                  {COUNTRIES.map((country) => (
                    <SelectItem key={country} value={country}>
                      {country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="accountingBookId">Accounting book ID</Label>
              <Input
                id="accountingBookId"
                inputMode="numeric"
                value={form.accountingBookId}
                onChange={(e) => setField('accountingBookId', e.target.value)}
                placeholder="0"
                disabled={loading || saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defaultBankAccountId">Default bank account</Label>
              <Select
                value={selectedBankAccountId}
                onValueChange={(value) => setField('defaultBankAccountId', value === 'none' ? '' : value)}
                disabled={loading || saving || bankAccountsLoading}
              >
                <SelectTrigger
                  id="defaultBankAccountId"
                  className={cn(bankAccountsError ? 'border-destructive' : '')}
                >
                  <SelectValue placeholder={bankAccountsLoading ? 'Loading bank accounts...' : 'Select bank account'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {bankAccounts.map((acct) => (
                    <SelectItem key={acct.value || acct.label} value={acct.value}>
                      {acct.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bankAccountsError ? (
                <p className="text-xs text-destructive">Bank accounts unavailable: {bankAccountsError}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="accountingBasis">Default accounting basis</Label>
              <Select
                value={form.defaultAccountingBasis}
                onValueChange={(value) =>
                  setField('defaultAccountingBasis', value as OrgFormState['defaultAccountingBasis'])
                }
                disabled={loading || saving}
              >
                <SelectTrigger id="accountingBasis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNTING_BASIS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="trustWarning">Trust account warning</Label>
              <Select
                value={form.trustAccountWarning}
                onValueChange={(value) =>
                  setField('trustAccountWarning', value as OrgFormState['trustAccountWarning'])
                }
                disabled={loading || saving}
              >
                <SelectTrigger id="trustWarning">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TRUST_ACCOUNT_WARNING_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="fiscalMonth">Fiscal year end month</Label>
                <Input
                  id="fiscalMonth"
                  inputMode="numeric"
                  value={form.fiscalYearEndMonth}
                  onChange={(e) => setField('fiscalYearEndMonth', e.target.value)}
                  placeholder="12"
                  disabled={loading || saving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fiscalDay">Fiscal year end day</Label>
                <Input
                  id="fiscalDay"
                  inputMode="numeric"
                  value={form.fiscalYearEndDay}
                  onChange={(e) => setField('fiscalYearEndDay', e.target.value)}
                  placeholder="31"
                  disabled={loading || saving}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Org public ID: {orgPublicId ?? '—'}</span>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  if (initialForm) {
                    setForm(initialForm)
                    setPageError(null)
                  }
                }}
                disabled={loading || saving}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading || saving}>
                {saving ? 'Saving...' : 'Save organization profile'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
type BankAccountOption = {
  label: string
  value: string
}
