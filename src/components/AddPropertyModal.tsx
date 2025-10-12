'use client'

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { Building, MapPin, Users, DollarSign, UserCheck, Home } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import AddressAutocomplete from './HybridAddressAutocomplete'
import { mapGoogleCountryToEnum } from '@/lib/utils'
import { SelectWithDescription } from '@/components/ui/SelectWithDescription'
import CreateBankAccountModal from '@/components/CreateBankAccountModal'
import { PropertyCreateSchema, type PropertyCreateInput } from '@/schemas/property'
import type { BankAccountSummary } from '@/components/forms/types'

interface AddPropertyFormData {
  // Step 1: Property Type
  propertyType: string
  
  // Step 2: Property Details
  name: string
  addressLine1: string
  addressLine2?: string
  city: string
  state: string
  postalCode: string
  country: string
  yearBuilt?: string
  structureDescription?: string
  status?: 'Active' | 'Inactive'
  // Location extras
  borough?: string
  neighborhood?: string
  longitude?: number
  latitude?: number
  locationVerified?: boolean
  
  // Step 3: Ownership
  owners: Array<{
    id: string
    name: string
    ownershipPercentage: number
    disbursementPercentage: number
    primary: boolean
    status?: string | null
  }>
  
  // Step 4: Units
  units: Array<{
    unitNumber: string
    unitBedrooms?: string
    unitBathrooms?: string
    unitSize?: number
    description?: string
  }>

  // Step 5: Bank Account
  operatingBankAccountId?: string
  operatingBankAccountName?: string
  depositTrustAccountId?: string
  reserve?: number
  // Management/Service/Fee fields (Step 4 with banking)
  management_scope?: 'Building' | 'Unit'
  service_assignment?: 'Property Level' | 'Unit Level'
  service_plan?: 'Full' | 'Basic' | 'A-la-carte'
  active_services?: (
    'Rent Collection' | 'Maintenance' | 'Turnovers' | 'Compliance' | 'Bill Pay' | 'Condition Reports' | 'Renewals'
  )[]
  fee_assignment?: 'Building' | 'Unit'
  fee_type?: 'Percentage' | 'Flat Rate'
  fee_percentage?: number
  management_fee?: number
  billing_frequency?: 'Annual' | 'Monthly'
  
  // Step 6: Property Manager
  propertyManagerId?: string
}

// Single source of truth for an empty form
const INITIAL_FORM_DATA: AddPropertyFormData = {
  propertyType: '',
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  yearBuilt: '',
  structureDescription: '',
  status: 'Active',
  borough: '',
  neighborhood: '',
  longitude: undefined,
  latitude: undefined,
  locationVerified: false,
  owners: [],
  units: [{ unitNumber: '' }],
  operatingBankAccountId: '',
  operatingBankAccountName: '',
  depositTrustAccountId: '',
  reserve: 0,
  management_scope: undefined,
  service_assignment: undefined,
  service_plan: undefined,
  active_services: [],
  fee_assignment: undefined,
  fee_type: undefined,
  fee_percentage: undefined,
  management_fee: undefined,
  billing_frequency: undefined,
  propertyManagerId: ''
}

const STEPS = [
  { id: 1, title: 'Property Type', icon: Building },
  { id: 2, title: 'Property Details', icon: MapPin },
  { id: 3, title: 'Ownership', icon: Users },
  { id: 4, title: 'Unit Details', icon: Home },
  { id: 5, title: 'Bank Account', icon: DollarSign },
  { id: 6, title: 'Property Manager', icon: UserCheck }
]

const PROPERTY_TYPES = [
  'Condo',
  'Co-op',
  'Condop',
  'Mult-Family',
  'Townhouse'
]

const COUNTRIES = [
  'United States',
  'Canada',
  'United Kingdom',
  'Australia',
  'Germany',
  'France',
  'Japan',
  'China',
  'India',
  'Brazil'
]

type OwnerOption = { id: string; name: string; status?: string | null }
type BankAccountOption = Pick<BankAccountSummary, 'id' | 'name' | 'account_number' | 'routing_number'>
type StaffOption = { id: string; displayName: string }

export default function AddPropertyModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<AddPropertyFormData>(INITIAL_FORM_DATA)
  const [syncToBuildium, setSyncToBuildium] = useState(true)

  // Options fetched from API
  const [owners, setOwners] = useState<OwnerOption[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  const canProceed = (step: number, data: AddPropertyFormData) => {
    switch (step) {
      case 1:
        return !!data.propertyType
      case 2:
        return (
          !!data.name &&
          !!data.addressLine1 &&
          !!data.city &&
          !!data.state &&
          !!data.postalCode &&
          !!data.country
        )
      case 3: {
        const total = (data.owners || []).reduce((sum, o) => sum + (Number(o.ownershipPercentage) || 0), 0)
        return (data.owners || []).length > 0 && total === 100
      }
      case 4: {
        return (data.units || []).some(u => (u.unitNumber || '').trim().length > 0)
      }
      case 5: {
        // Require Operating Bank Account, Management Scope, Service Assignment, Service Plan
        const hasOp = !!data.operatingBankAccountId && String(data.operatingBankAccountId).trim().length > 0
        const hasMgmtScope = !!data.management_scope && String(data.management_scope).trim().length > 0
        const hasServiceAssign = !!data.service_assignment && String(data.service_assignment).trim().length > 0
        const hasServicePlan = !!data.service_plan && String(data.service_plan).trim().length > 0

        // Fees: when Fee Assignment = Building, require all fee fields
        const requiresFees = data.fee_assignment === 'Building'
        const hasFeeAssignment = !!data.fee_assignment && String(data.fee_assignment).trim().length > 0
        const hasFeeType = !requiresFees || (!!data.fee_type && String(data.fee_type).trim().length > 0)
        const requirePct = requiresFees && data.fee_type === 'Percentage'
        const requireFlat = requiresFees && data.fee_type === 'Flat Rate'
        const hasFeePct = !requirePct || (data.fee_percentage !== undefined && data.fee_percentage !== null && String(data.fee_percentage).trim() !== '')
        const hasMgmtFee = !requireFlat || (data.management_fee !== undefined && data.management_fee !== null && String(data.management_fee).trim() !== '')
        const hasBillingFreq = !requiresFees || (!!data.billing_frequency && String(data.billing_frequency).trim().length > 0)

        return (
          hasOp && hasMgmtScope && hasServiceAssign && hasServicePlan && hasFeeAssignment && hasFeeType && hasFeePct && hasMgmtFee && hasBillingFreq
        )
      }
      default:
        return true
    }
  }

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    const fetchOptions = async () => {
      try {
        const ownersRes = await fetch('/api/owners')
        if (!ownersRes.ok) throw new Error('Failed to load owners')
        const ownersJson = await ownersRes.json()

        if (cancelled) return
        setOwners(
          ownersJson.map((o: unknown) => {
            const owner = o as Record<string, unknown>
            const label = (
              owner.displayName ||
              owner.name ||
              `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() ||
              `${owner.first_name ?? ''} ${owner.last_name ?? ''}`.trim() ||
              owner.companyName ||
              owner.company_name ||
              'Unnamed Owner'
            )
            const status = owner.status || owner.owner_status || null
            return { id: String(owner.id), name: String(label), status: String(status) }
          })
        )
      } catch (e) {
        console.error('Failed to load owners:', e)
      }
    }
    fetchOptions()
    return () => { cancelled = true }
  }, [isOpen])

  // Auto-select all active services when Service Plan is 'Full'
  useEffect(() => {
    if (formData.service_plan === 'Full') {
      const allServices = ['Rent Collection','Maintenance','Turnovers','Compliance','Bill Pay','Condition Reports','Renewals'] as const
      if ((formData.active_services || []).length !== allServices.length) {
        setFormData(prev => ({ ...prev, active_services: [...allServices] as const }))
      }
    }
  }, [formData.service_plan, formData.active_services])

  // Auto-calculate property name from Street Address and Primary Owner
  useEffect(() => {
    const address = (formData.addressLine1 || '').trim()
    const primaryOwner = (formData.owners || []).find(o => o.primary)
    const ownerName = (primaryOwner?.name || '').trim()
    const computed = ownerName ? (address ? `${address} | ${ownerName}` : ownerName) : address
    if ((computed || '') !== (formData.name || '')) {
      setFormData(prev => ({ ...prev, name: computed }))
    }
  }, [formData.addressLine1, formData.owners, formData.name])

  const handleNext = () => {
    if (currentStep < 6) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setSubmitError(null)
      setSubmitSuccess(null)

      // Validate with Zod before submit
      const parsed = PropertyCreateSchema.safeParse({
        propertyType: formData.propertyType,
        name: formData.name,
        addressLine1: formData.addressLine1,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
        country: formData.country,
        yearBuilt: formData.yearBuilt || undefined,
        structureDescription: formData.structureDescription || undefined,
        owners: formData.owners,
        operatingBankAccountId: formData.operatingBankAccountId || undefined,
        reserve: formData.reserve || undefined,
        propertyManagerId: formData.propertyManagerId || undefined,
      } as PropertyCreateInput)

      if (!parsed.success) {
        const msg = parsed.error.issues.map((e) => e.message).join('\n')
        throw new Error(msg || 'Please correct the form errors')
      }

      // Submit the form data to your API
      const url = syncToBuildium ? '/api/properties?syncToBuildium=true' : '/api/properties'
      const { operatingBankAccountName, ...submitPayload } = formData

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitPayload),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create property')
      }

      const result = await response.json()
      console.log('Property created successfully:', result)
      setSubmitSuccess('Property created successfully')

      const propertyId: string | undefined = result?.property?.id
      const destination = propertyId ? `/properties/${propertyId}` : '/properties'

      onClose()
      if (onSuccess) onSuccess()
      // Reset form to initial shape for the next open
      setFormData(INITIAL_FORM_DATA)
      setSyncToBuildium(true)
      setCurrentStep(1)

      router.push(destination)
    } catch (error) {
      console.error('Error creating property:', error)
      setSubmitError(error instanceof Error ? error.message : 'Failed to create property. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const addOwner = (ownerId: string, ownerName?: string) => {
    // Prefer name passed from the Step 3 list; fall back to parent-fetched owners
    const fallback = owners.find(o => o.id === ownerId)
    const name = ownerName || fallback?.name
    if (name && !formData.owners.find(o => o.id === ownerId)) {
      setFormData(prev => ({
        ...prev,
        owners: [...prev.owners, {
          id: ownerId,
          name,
          ownershipPercentage: 100,
          disbursementPercentage: 100,
          primary: prev.owners.length === 0 // First owner is primary
        }]
      }))
    }
  }

  const removeOwner = (ownerId: string) => {
    setFormData(prev => ({
      ...prev,
      owners: prev.owners.filter(o => o.id !== ownerId)
    }))
  }

  const updateOwnerPercentage = (ownerId: string, field: 'ownershipPercentage' | 'disbursementPercentage', value: number) => {
    setFormData(prev => ({
      ...prev,
      owners: prev.owners.map(o => 
        o.id === ownerId ? { ...o, [field]: value } : o
      )
    }))
  }

  const setPrimaryOwner = (ownerId: string) => {
    // Toggle behavior: if the clicked owner is already primary, uncheck all; otherwise set as sole primary
    setFormData(prev => {
      const current = prev.owners.find(o => o.id === ownerId)?.primary
      const owners = current
        ? prev.owners.map(o => ({ ...o, primary: false }))
        : prev.owners.map(o => ({ ...o, primary: o.id === ownerId }))
      return { ...prev, owners }
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        onInteractOutside={(e: Event) => {
          const event = e as CustomEvent
          const orig = event?.detail?.originalEvent as Event | undefined
          const target = (orig?.target as HTMLElement) || (event.target as HTMLElement)
          if (target && (target.closest?.('.pac-container') || target.classList?.contains('pac-item'))) {
            e.preventDefault()
          }
        }}
        className="bg-card sm:rounded-2xl rounded-none border border-border/80 shadow-2xl w-[92vw] sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-[56rem] max-h-[90vh] overflow-y-auto p-0"
      >
        {/* Header */}
        <DialogHeader className="p-6 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">Add New Property</DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  currentStep >= step.id 
                    ? 'bg-primary border-primary text-primary-foreground' 
                    : 'border-input text-muted-foreground'
                }`}>
                  {currentStep > step.id ? (
                    <span className="text-sm">✓</span>
                  ) : (
                    <span className="text-sm">{step.id}</span>
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-16 h-0.5 mx-2 ${
                    currentStep > step.id ? 'bg-primary' : 'bg-border'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-5 md:p-6">
          {submitError && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}
          {submitSuccess && (
            <div className="mb-4 p-3 bg-success/10 border border-success/20 rounded-md">
              <p className="text-sm text-success">{submitSuccess}</p>
            </div>
          )}
          {currentStep === 1 && (
            <Step1PropertyType 
              formData={formData} 
              setFormData={setFormData} 
            />
          )}
          
          {currentStep === 2 && (
            <Step2PropertyDetails 
              formData={formData} 
              setFormData={setFormData} 
            />
          )}
          
          {currentStep === 3 && (
            <Step3Ownership 
              formData={formData} 
              setFormData={setFormData}
              addOwner={addOwner}
              removeOwner={removeOwner}
              updateOwnerPercentage={updateOwnerPercentage}
              setPrimaryOwner={setPrimaryOwner}
            />
          )}
          
          {currentStep === 4 && (
            <Step4UnitDetails 
              formData={formData}
              setFormData={setFormData}
            />
          )}
          
          {currentStep === 5 && (
            <Step4BankAccount 
              formData={formData} 
              setFormData={setFormData} 
            />
          )}
          
          {currentStep === 6 && (
            <Step5PropertyManager 
              formData={formData} 
              setFormData={setFormData} 
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between p-6 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            Previous
          </Button>

          <div className="flex items-center gap-4">
            {currentStep === 6 && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4 border-border rounded"
                  checked={syncToBuildium}
                  onChange={(e) => setSyncToBuildium(e.target.checked)}
                />
                Create this property in Buildium
              </label>
            )}
            <Button type="button" onClick={handleNext} disabled={submitting || !canProceed(currentStep, formData)}>
              {submitting ? 'Saving...' : currentStep === 6 ? 'Create Property' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Step 1: Property Type
function Step1PropertyType({ 
  formData, 
  setFormData 
}: { 
  formData: AddPropertyFormData; 
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>> 
}) {
  const CurrentIcon = STEPS[0].icon

  return (
    <div className="text-center">
      <CurrentIcon className="h-12 w-12 text-primary mx-auto mb-2" />
      <h3 className="text-xl font-semibold text-foreground mb-1">Property Type</h3>
      <p className="text-muted-foreground mb-4">What type of property are you adding?</p>
      
      <div className="max-w-3xl md:max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PROPERTY_TYPES.map((type) => {
            const selected = formData.propertyType === type
            return (
              <Button
                key={type}
                type="button"
                variant={selected ? 'default' : 'outline'}
                className={`h-14 md:h-16 flex-col gap-1 justify-center ${selected ? 'bg-primary text-primary-foreground' : 'bg-card'} transition-colors`}
                onClick={() => setFormData({ ...formData, propertyType: type })}
              >
                <Building className={`h-5 w-5 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                <span className={`text-sm ${selected ? 'text-primary-foreground' : 'text-foreground'}`}>{type}</span>
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Step 2: Property Details
function Step2PropertyDetails({ 
  formData, 
  setFormData 
}: { 
  formData: AddPropertyFormData; 
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>> 
}) {
  const CurrentIcon = STEPS[1].icon

  return (
    <div>
      <div className="text-center mb-4">
        <CurrentIcon className="h-12 w-12 text-primary mx-auto mb-2" />
        <h3 className="text-xl font-semibold text-foreground mb-1">Property Details</h3>
        <p className="text-muted-foreground">Enter the property address and basic information</p>
      </div>

      <div className="max-w-3xl md:max-w-4xl mx-auto space-y-4">

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Street Address *</label>
          <AddressAutocomplete
            value={formData.addressLine1}
            onChange={(value) => setFormData(prev => ({ ...prev, addressLine1: value }))}
            onPlaceSelect={(place) => {
              const mappedCountry = mapGoogleCountryToEnum(place.country)
              setFormData(prev => ({
                ...prev,
                addressLine1: place.address,
                city: place.city,
                state: place.state,
                postalCode: place.postalCode,
                country: mappedCountry,
                borough: place.borough || prev.borough,
                neighborhood: place.neighborhood || prev.neighborhood,
                longitude: place.longitude ?? prev.longitude,
                latitude: place.latitude ?? prev.latitude,
                locationVerified: true
              }))
            }}
            placeholder="e.g., 123 Main Street"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Address Line 2 (Optional)</label>
          <input
            type="text"
            value={formData.addressLine2}
            onChange={(e) => setFormData(prev => ({ ...prev, addressLine2: e.target.value }))}
            className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            placeholder="Apartment, suite, unit, building, floor, etc."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">City *</label>
          <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Enter city"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">State *</label>
          <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
              className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Enter state"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">ZIP Code *</label>
          <input
              type="text"
              value={formData.postalCode}
              onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
              className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Enter ZIP code"
            />
          </div>
          <div>
            <label htmlFor="add-property-country" className="block text-sm font-medium text-foreground mb-1">Country *</label>
            <select
              id="add-property-country"
              value={formData.country}
              onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
              className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <option value="">Select country</option>
              {COUNTRIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="add-property-status" className="block text-sm font-medium text-foreground mb-1">Status</label>
          <select
            id="add-property-status"
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'Active' | 'Inactive' }))}
            className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Year Built (Optional)</label>
          <input
              type="text"
              value={formData.yearBuilt}
              onChange={(e) => setFormData(prev => ({ ...prev, yearBuilt: e.target.value }))}
              className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="e.g., 2008"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-foreground mb-1">Description (Optional)</label>
          <textarea
              value={formData.structureDescription}
              onChange={(e) => setFormData(prev => ({ ...prev, structureDescription: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              rows={3}
              placeholder="Brief description of the property..."
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// Step 3: Ownership
function Step3Ownership({ 
  formData, 
  setFormData,
  addOwner,
  removeOwner,
  updateOwnerPercentage,
  setPrimaryOwner
}: { 
  formData: AddPropertyFormData; 
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>;
  addOwner: (ownerId: string, ownerName?: string) => void;
  removeOwner: (ownerId: string) => void;
  updateOwnerPercentage: (ownerId: string, field: 'ownershipPercentage' | 'disbursementPercentage', value: number) => void;
  setPrimaryOwner: (ownerId: string) => void;
}) {
  const CurrentIcon = STEPS[2].icon
  const [ownerList, setOwnerList] = useState<OwnerOption[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [showCreateInline, setShowCreateInline] = useState(false)
  const [createFirst, setCreateFirst] = useState('')
  const [createLast, setCreateLast] = useState('')
  const [createEmail, setCreateEmail] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createOwnershipPct, setCreateOwnershipPct] = useState<number>(100)
  const [createDisbursementPct, setCreateDisbursementPct] = useState<number>(100)
  const [createPrimary, setCreatePrimary] = useState<boolean>(false)
  const [creating, setCreating] = useState(false)
  // CSRF token for POSTs to secured API routes
  const [csrfToken, setCsrfToken] = useState<string | null>(null)

  // Fetch CSRF token on mount so we can include it in headers (cookie is httpOnly)
  useEffect(() => {
    let cancelled = false
    const fetchCsrf = async () => {
      try {
        const res = await fetch('/api/csrf', { credentials: 'include' })
        if (!res.ok) return
        const j = await res.json().catch(() => ({}))
        if (!cancelled && j?.token) setCsrfToken(j.token as string)
      } catch {
        // ignore; API will reject without token and surface an error, but we try early
      }
    }
    fetchCsrf()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        setErr(null)
        const res = await fetch('/api/owners')
        if (!res.ok) throw new Error('Failed to load owners')
        const data = await res.json()
        if (!cancelled) {
          setOwnerList(
            (Array.isArray(data) ? data : []).map((o: unknown) => {
              const owner = o as Record<string, unknown>
              const label = (
                owner.displayName ||
                owner.name ||
                `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() ||
                `${owner.first_name ?? ''} ${owner.last_name ?? ''}`.trim() ||
                owner.companyName ||
                owner.company_name ||
                'Unnamed Owner'
              )
              return { id: String(owner.id), name: String(label) }
            })
          )
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load owners')
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const handleSelectOwner = async (value: string) => {
    if (!value) return
    if (value === 'create-new-owner') {
      setShowCreateInline(true)
      setCreateOwnershipPct(100)
      setCreateDisbursementPct(100)
      setCreatePrimary((formData.owners?.length || 0) === 0)
      return
    }
    const selected = ownerList.find(o => o.id === value)
    addOwner(value, selected?.name)
  }


  const handleCreateOwner = async () => {
    try {
      setCreating(true)
      setErr(null)
      // Basic validation
      if (!createFirst || !createLast || !createEmail) {
        setErr('First name, last name, and email are required')
        return
      }
      const csrf = csrfToken
      const res = await fetch('/api/owners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {})
        },
        body: JSON.stringify({
          isCompany: false,
          firstName: createFirst,
          lastName: createLast,
          primaryEmail: createEmail,
          primaryPhone: createPhone || undefined
        })
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j?.error || 'Failed to create owner')
      }
      const j = await res.json()
      const newOwner = j?.owner
      if (newOwner?.id) {
        const name = (
          newOwner.displayName ||
          `${newOwner.firstName ?? ''} ${newOwner.lastName ?? ''}`.trim() ||
          `${newOwner.first_name ?? ''} ${newOwner.last_name ?? ''}`.trim() ||
          newOwner.companyName ||
          newOwner.company_name ||
          'New Owner'
        )
        // Update dropdown options
        setOwnerList(prev => [{ id: newOwner.id, name: name || newOwner.companyName || 'New Owner' }, ...prev])
        // Add to form selections using provided ownership values and primary flag
        setFormData(prev => {
          const entry = {
            id: String(newOwner.id),
            name: name || newOwner.companyName || 'New Owner',
            ownershipPercentage: Number.isFinite(createOwnershipPct) ? createOwnershipPct : 100,
            disbursementPercentage: Number.isFinite(createDisbursementPct) ? createDisbursementPct : 100,
            primary: !!createPrimary,
            status: 'new'
          }
          let owners = [...prev.owners, entry]
          if (entry.primary) {
            owners = owners.map(o => ({ ...o, primary: o.id === entry.id }))
          }
          return { ...prev, owners }
        })
        // Reset form
        setShowCreateInline(false)
        setCreateFirst(''); setCreateLast(''); setCreateEmail(''); setCreatePhone('')
        setCreateOwnershipPct(100); setCreateDisbursementPct(100); setCreatePrimary(false)
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create owner')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div>
      <div className="text-center mb-6">
        <CurrentIcon className="h-16 w-16 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Ownership</h3>
        <p className="text-muted-foreground">Select the owners related to this property</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="add-property-owner-select" className="block text-sm font-medium text-foreground mb-1">
            Add Owners *
          </label>
          <select
            id="add-property-owner-select"
            onChange={(e) => { handleSelectOwner(e.target.value); e.target.value = '' }}
            className="w-full h-10 px-3 border border-border rounded-lg bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <option value="">Choose owners to add...</option>
            <option value="create-new-owner">+ Create new owner…</option>
            {ownerList.map((owner) => (
              <option key={owner.id} value={owner.id}>{owner.name}</option>
            ))}
          </select>
        </div>

        {showCreateInline && (
          <div className="border border-border rounded-lg p-4 bg-muted/10">
            <h4 className="text-sm font-medium mb-3">Create New Owner</h4>
            {err && <p className="text-sm text-destructive mb-2">{err}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">First Name *</label>
                <input className="w-full h-9 px-2 border border-border rounded bg-background" value={createFirst} onChange={e=>setCreateFirst(e.target.value)} placeholder="e.g., John" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Last Name *</label>
                <input className="w-full h-9 px-2 border border-border rounded bg-background" value={createLast} onChange={e=>setCreateLast(e.target.value)} placeholder="e.g., Smith" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Email *</label>
                <input className="w-full h-9 px-2 border border-border rounded bg-background" value={createEmail} onChange={e=>setCreateEmail(e.target.value)} placeholder="e.g., john.smith@example.com" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-muted-foreground mb-1">Phone (Optional)</label>
                <input className="w-full h-9 px-2 border border-border rounded bg-background" value={createPhone} onChange={e=>setCreatePhone(e.target.value)} placeholder="e.g., (555) 123-4567" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Ownership %</label>
                <input type="number" min={0} max={100} className="w-full h-9 px-2 border border-border rounded bg-background" value={createOwnershipPct} onChange={e=>setCreateOwnershipPct(Number(e.target.value))} aria-label="Ownership percentage" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Disbursement %</label>
                <input type="number" min={0} max={100} className="w-full h-9 px-2 border border-border rounded bg-background" value={createDisbursementPct} onChange={e=>setCreateDisbursementPct(Number(e.target.value))} aria-label="Disbursement percentage" />
              </div>
              <div className="sm:col-span-2">
                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={createPrimary} onChange={e=>setCreatePrimary(e.target.checked)} />
                  Primary
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" onClick={handleCreateOwner} disabled={creating}>
                {creating ? 'Adding…' : 'Add Owner'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setShowCreateInline(false); setErr(null) }}>Cancel</Button>
            </div>
          </div>
        )}
        
        {formData.owners.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Selected Owners</h4>
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Owner</th>
                    <th className="text-center px-4 py-2 font-medium">Ownership %</th>
                    <th className="text-center px-4 py-2 font-medium">Disbursement %</th>
                    <th className="text-center px-4 py-2 font-medium">Primary</th>
                    <th className="text-right px-4 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.owners.map((owner) => (
                    <tr key={owner.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{owner.name || 'Unnamed Owner'}</span>
                          {String(owner.status || '').toLowerCase() === 'new' && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">New Owner</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          value={owner.ownershipPercentage}
                          onChange={(e) => updateOwnerPercentage(owner.id, 'ownershipPercentage', Number(e.target.value))}
                          className="w-24 px-2 py-1 border border-border rounded text-sm text-foreground bg-background"
                          min={0}
                          max={100}
                          step={1}
                          aria-label={`Ownership percentage for ${owner.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          value={owner.disbursementPercentage}
                          onChange={(e) => updateOwnerPercentage(owner.id, 'disbursementPercentage', Number(e.target.value))}
                          className="w-24 px-2 py-1 border border-border rounded text-sm text-foreground bg-background"
                          min={0}
                          max={100}
                          step={1}
                          aria-label={`Disbursement percentage for ${owner.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={!!owner.primary}
                          onChange={() => setPrimaryOwner(owner.id)}
                          aria-label={`Set ${owner.name} as primary owner`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => removeOwner(owner.id)} className="text-destructive hover:underline" aria-label={`Remove ${owner.name} from property`}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Ownership total validation */}
            {(() => {
              const total = formData.owners.reduce((s, o) => s + (Number(o.ownershipPercentage) || 0), 0)
              if (total !== 100) {
                return (
                  <p className="text-sm text-destructive mt-2">Ownership total is {total}%. It must equal 100% to continue.</p>
                )
              }
              return null
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

// Step 4: Bank Account
function Step4BankAccount({ 
  formData, 
  setFormData 
}: { 
  formData: AddPropertyFormData; 
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>> 
}) {
  const CurrentIcon = STEPS[4].icon
  const [accounts, setAccounts] = useState<BankAccountOption[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [createTarget, setCreateTarget] = useState<'operating' | 'trust' | null>(null)
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/bank-accounts?revealNumbers=false')
        if (!res.ok) throw new Error('Failed to load bank accounts')
        const data = await res.json()
        if (!cancelled) setAccounts((data || []).map((a: unknown) => {
          const account = a as Record<string, unknown>
          return { 
            id: String(account.id), 
            name: String(account.name), 
            account_number: account.account_number ? String(account.account_number) : null, 
            routing_number: account.routing_number ? String(account.routing_number) : null 
          }
        }))
      } catch (e) {
        console.error('Failed to load bank accounts:', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!formData.operatingBankAccountId || formData.operatingBankAccountName) return
    const selected = accounts.find(a => a.id === formData.operatingBankAccountId)
    if (selected) {
      setFormData(prev => ({ ...prev, operatingBankAccountName: selected.name }))
    }
  }, [accounts, formData.operatingBankAccountId, formData.operatingBankAccountName, setFormData])

  return (
    <div>
      <div className="text-center mb-6">
        <CurrentIcon className="h-16 w-16 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Bank Account</h3>
        <p className="text-muted-foreground">Select the operating bank account for this property</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Operating Bank Account *</label>
          <SelectWithDescription
            value={formData.operatingBankAccountId || ''}
            onChange={(value: string) => {
              if (value === 'create-new') { setCreateTarget('operating'); setShowCreate(true); return }
              if (!value) {
                setFormData({ ...formData, operatingBankAccountId: '', operatingBankAccountName: '' })
                return
              }
              const selected = accounts.find(a => a.id === value)
              setFormData({
                ...formData,
                operatingBankAccountId: value,
                operatingBankAccountName: selected?.name ?? ''
              })
            }}
            options={[
              { value: 'create-new', label: '+ Create new account…', description: 'Add a bank account' },
              ...accounts.map(a => ({ value: String(a.id), label: `${a.name}${a.account_number ? ` (...${a.account_number})` : ''}` }))
            ]}
            placeholder="Select account..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Deposit Trust Account</label>
          <SelectWithDescription
            value={formData.depositTrustAccountId || ''}
            onChange={(value: string) => {
              if (value === 'create-new') { setCreateTarget('trust'); setShowCreate(true); return }
              setFormData({ ...formData, depositTrustAccountId: value })
            }}
            options={[
              { value: 'create-new', label: '+ Create new account…', description: 'Add a bank account' },
              ...accounts.map(a => ({ value: String(a.id), label: `${a.name}${a.account_number ? ` (...${a.account_number})` : ''}` }))
            ]}
            placeholder="Select account..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Reserve Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <input
              type="number"
              value={formData.reserve}
              onChange={(e) => setFormData({ ...formData, reserve: Number(e.target.value) })}
              className="w-full h-9 pl-8 pr-3 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 text-sm"
              placeholder="e.g., 0.00"
              step="0.01"
              min="0"
            />
          </div>
        </div>
        
        {/* Selected account summary modules removed per request */}

        {/* Management & Services */}
        <div className="mt-6 border-t border-border pt-6">
          <h4 className="font-medium text-foreground mb-3">Management & Services</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Management Scope *</label>
              <SelectWithDescription
                value={formData.management_scope || ''}
                onChange={(value: string) => setFormData({ ...formData, management_scope: (value || undefined) as 'Building' | 'Unit' | undefined })}
                options={[
                  { value: 'Building', label: 'Building', description: 'Manage entire property' },
                  { value: 'Unit', label: 'Unit', description: 'Manage specific units' }
                ]}
                placeholder="Select scope..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Service Assignment *</label>
              <SelectWithDescription
                value={formData.service_assignment || ''}
                onChange={(value: string) => setFormData({ ...formData, service_assignment: (value || undefined) as 'Property Level' | 'Unit Level' | undefined })}
                options={[
                  { value: 'Property Level', label: 'Property Level' },
                  { value: 'Unit Level', label: 'Unit Level' }
                ]}
                placeholder="Select level..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Service Plan *</label>
              <SelectWithDescription
                value={formData.service_plan || ''}
                onChange={(value: string) => setFormData({ ...formData, service_plan: (value || undefined) as 'Full' | 'Basic' | 'A-la-carte' | undefined })}
                options={[
                  { value: 'Full', label: 'Full' },
                  { value: 'Basic', label: 'Basic' },
                  { value: 'A-la-carte', label: 'A-la-carte' }
                ]}
                placeholder="Select plan..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1">Active Services</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border border-border rounded-md bg-background">
                {(['Rent Collection','Maintenance','Turnovers','Compliance','Bill Pay','Condition Reports','Renewals'] as const).map((svc) => {
                  const checked = (formData.active_services || []).includes(svc)
                  return (
                    <label key={svc} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const curr = new Set(formData.active_services || [])
                          if (e.target.checked) curr.add(svc)
                          else curr.delete(svc)
                          setFormData({ ...formData, active_services: Array.from(curr) as typeof formData.active_services })
                        }}
                      />
                      <span>{svc}</span>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Select the active management services for this property.</p>
            </div>
          </div>
        </div>

        {/* Fees */}
        <div className="mt-6 border-t border-border pt-6">
          <h4 className="font-medium text-foreground mb-3">Management Fees</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Fee Assignment *</label>
              <SelectWithDescription
                value={formData.fee_assignment || ''}
                onChange={(value: string) => setFormData({ ...formData, fee_assignment: (value || undefined) as 'Building' | 'Unit' | undefined })}
                options={[
                  { value: 'Building', label: 'Building' },
                  { value: 'Unit', label: 'Unit' }
                ]}
                placeholder="Select assignment..."
              />
            </div>
            {formData.fee_assignment === 'Building' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Fee Type *</label>
                  <SelectWithDescription
                    value={formData.fee_type || ''}
                    onChange={(value: string) => setFormData({ ...formData, fee_type: (value || undefined) as 'Percentage' | 'Flat Rate' | undefined })}
                    options={[
                      { value: 'Percentage', label: 'Percentage of rent' },
                      { value: 'Flat Rate', label: 'Flat Rate' }
                    ]}
                    placeholder="Select type..."
                  />
                </div>
                {formData.fee_type === 'Percentage' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Fee Percentage *</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.fee_percentage ?? ''}
                        onChange={(e) => setFormData({ ...formData, fee_percentage: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="w-full h-9 px-3 pr-10 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 text-sm"
                        placeholder="e.g., 8"
                        step="0.01"
                        min={0}
                        max={100}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Enter 0–100 (e.g., 8 for 8%).</p>
                  </div>
                )}
                {formData.fee_type === 'Flat Rate' && (
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Management Fee *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={formData.management_fee ?? ''}
                        onChange={(e) => setFormData({ ...formData, management_fee: e.target.value === '' ? undefined : Number(e.target.value) })}
                        className="w-full h-9 pl-8 pr-3 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 text-sm"
                        placeholder="e.g., 0.00"
                        step="0.01"
                        min={0}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Billing Frequency *</label>
                  <SelectWithDescription
                    value={formData.billing_frequency || ''}
                    onChange={(value: string) => setFormData({ ...formData, billing_frequency: (value || undefined) as 'Monthly' | 'Annual' | undefined })}
                    options={[
                      { value: 'Monthly', label: 'Monthly' },
                      { value: 'Annual', label: 'Annual' }
                    ]}
                    placeholder="Select frequency..."
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateBankAccountModal
          isOpen={showCreate}
          onClose={() => { setShowCreate(false); setCreateTarget(null) }}
          onSuccess={(newAccount) => {
            const created: BankAccountOption = {
              id: String(newAccount.id),
              name: String(newAccount.name),
              account_number: newAccount.account_number ? String(newAccount.account_number) : null,
              routing_number: newAccount.routing_number ? String(newAccount.routing_number) : null
            }
            setAccounts(prev => [{ ...created }, ...prev.filter(a => a.id !== String(newAccount.id))])
            if (createTarget === 'operating') {
              setFormData(prev => ({
                ...prev,
                operatingBankAccountId: String(newAccount.id),
                operatingBankAccountName: String(newAccount.name)
              }))
            } else if (createTarget === 'trust') {
              setFormData(prev => ({ ...prev, depositTrustAccountId: String(newAccount.id) }))
            }
            setCreateTarget(null)
          }}
        />
      )}
    </div>
  )
}

// Step 5: Property Manager
function Step5PropertyManager({ 
  formData, 
  setFormData 
}: { 
  formData: AddPropertyFormData; 
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>> 
}) {
  const CurrentIcon = STEPS[5].icon
  const [staff, setStaff] = useState<StaffOption[]>([])
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/staff')
        if (!res.ok) {
          // Not fatal if staff table missing; leave list empty
          setStaff([])
          return
        }
        const data = await res.json()
        if (!cancelled) setStaff((data || []).map((s: unknown) => {
          const staff = s as Record<string, unknown>
          return { 
            id: String(staff.id), 
            displayName: String(staff.displayName || `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim() || `Staff ${staff.id}`) 
          }
        }))
      } catch (e) {
        console.error('Failed to load staff:', e)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div>
      <div className="text-center mb-6">
        <CurrentIcon className="h-16 w-16 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Property Manager</h3>
        <p className="text-muted-foreground">Assign a property manager (optional)</p>
      </div>
      
      <div className="space-y-6">
        <div>
          <label htmlFor="add-property-manager" className="block text-sm font-medium text-foreground mb-1">
            Property Manager (Optional)
          </label>
          <select
            id="add-property-manager"
            value={formData.propertyManagerId}
            onChange={(e) => setFormData({ ...formData, propertyManagerId: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
          >
            <option value="">Choose a manager...</option>
            {staff.map((m) => (
              <option key={m.id} value={m.id}>{m.displayName}</option>
            ))}
          </select>
        </div>
        
        {/* Property Summary */}
        <div className="bg-muted border border-border rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-3">Property Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Property:</span>
              <span className="font-medium">{formData.name || 'Not specified'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs">
                {formData.propertyType || 'Not selected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">{formData.status || 'Active'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Address:</span>
              <span className="font-medium">{formData.addressLine1 || 'Not specified'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Country:</span>
              <span className="font-medium">{formData.country || 'Not specified'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Year Built:</span>
              <span className="font-medium">{formData.yearBuilt || 'Not specified'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Owners:</span>
              <span className="font-medium">
                {formData.owners.map(o => o.name).join(', ') || 'None selected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Primary Owner:</span>
              <span className="font-medium">
                {formData.owners.find(o => o.primary)?.name || 'None selected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bank Account:</span>
              <span className="font-medium">
                {formData.operatingBankAccountName || formData.operatingBankAccountId || 'None selected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deposit Trust:</span>
              <span className="font-medium">
                {formData.depositTrustAccountId || 'None selected'}
          </span>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
// Step 4: Unit Details
function Step4UnitDetails({
  formData,
  setFormData
}: {
  formData: AddPropertyFormData
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>
}) {
  const CurrentIcon = STEPS[3].icon
  const addUnit = () => {
    setFormData({ ...formData, units: [...formData.units, { unitNumber: '' }] })
  }
  const updateUnit = (idx: number, patch: Partial<AddPropertyFormData['units'][number]>) => {
    const next = formData.units.map((u, i) => (i === idx ? { ...u, ...patch } : u))
    setFormData({ ...formData, units: next })
  }
  const removeUnit = (idx: number) => {
    const next = formData.units.filter((_, i) => i !== idx)
    setFormData({ ...formData, units: next.length ? next : [{ unitNumber: '' }] })
  }

  const BEDROOMS = ['Studio', '1', '2', '3', '4', '5+']
  const BATHROOMS = ['1', '1.5', '2', '2.5', '3', '3.5', '4+']

  return (
    <div>
      <div className="text-center mb-6">
        <CurrentIcon className="h-16 w-16 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Unit Details</h3>
        <p className="text-muted-foreground">Add details for each unit in this property</p>
      </div>

      <div className="space-y-4">
        {formData.units.map((u, idx) => (
          <div key={idx} className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium">Unit {idx + 1}</span>
              {formData.units.length > 1 && (
                <button onClick={() => removeUnit(idx)} className="text-destructive hover:underline text-sm" aria-label={`Remove unit ${idx + 1}`}>Remove</button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4">
              {/* Unit Number */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Unit Number *</label>
                <input value={u.unitNumber} onChange={e=>updateUnit(idx,{ unitNumber:e.target.value })} className="w-full h-9 px-3 border border-border rounded-md bg-background" placeholder="e.g., 101, A, 1" />
              </div>
              {/* Bedrooms */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Bedrooms</label>
                <div className="flex rounded-md border border-border overflow-hidden divide-x divide-border">
                  {BEDROOMS.map(b => {
                    const selected = (u.unitBedrooms || '') === b
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => updateUnit(idx, { unitBedrooms: b })}
                        className={`flex-1 py-2 text-sm text-center focus:outline-none ${selected ? 'bg-primary/10 text-primary' : 'bg-background hover:bg-muted text-foreground'}`}
                        aria-label={`Select ${b} bedrooms for unit ${idx + 1}`}
                      >
                        {b}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Bathrooms */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Bathrooms</label>
                <div className="flex rounded-md border border-border overflow-hidden divide-x divide-border">
                  {BATHROOMS.map(b => {
                    const selected = (u.unitBathrooms || '') === b
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => updateUnit(idx, { unitBathrooms: b })}
                        className={`flex-1 py-2 text-sm text-center focus:outline-none ${selected ? 'bg-primary/10 text-primary' : 'bg-background hover:bg-muted text-foreground'}`}
                        aria-label={`Select ${b} bathrooms for unit ${idx + 1}`}
                      >
                        {b}
                      </button>
                    )
                  })}
                </div>
              </div>
              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description (Optional)</label>
                <textarea value={u.description || ''} onChange={e=>updateUnit(idx,{ description: e.target.value || undefined })} rows={3} className="w-full px-3 py-2 border border-border rounded-lg bg-background" placeholder="Unit-specific details, amenities, notes..." />
              </div>
            </div>
          </div>
        ))}

        <Button type="button" variant="outline" onClick={addUnit} className="w-full">+ Add Another Unit</Button>
      </div>
    </div>
  )
}
