'use client'

import { useState } from 'react'
import { X, Building, MapPin, Users, DollarSign, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dropdown } from '@/components/ui/Dropdown'

interface AddPropertyFormData {
  // Step 1: Property Type
  rentalSubType: string
  
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
  
  // Step 3: Ownership
  owners: Array<{
    id: string
    name: string
    ownershipPercentage: number
    disbursementPercentage: number
    primary: boolean
  }>
  
  // Step 4: Bank Account
  operatingBankAccountId?: string
  depositTrustAccountId?: string
  reserve?: number
  
  // Step 5: Property Manager
  propertyManagerId?: string
}

const STEPS = [
  { id: 1, title: 'Property Type', icon: Building },
  { id: 2, title: 'Property Details', icon: MapPin },
  { id: 3, title: 'Ownership', icon: Users },
  { id: 4, title: 'Bank Account', icon: DollarSign },
  { id: 5, title: 'Property Manager', icon: UserCheck }
]

const PROPERTY_TYPES = [
  'CondoTownhome',
  'MultiFamily', 
  'SingleFamily',
  'Industrial',
  'Office',
  'Retail',
  'ShoppingCenter',
  'Storage',
  'ParkingSpace'
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

// Mock data - in a real app, this would come from your database
const MOCK_OWNERS = [
  { id: '1', name: 'John Smith' },
  { id: '2', name: 'Jane Doe' },
  { id: '3', name: 'ABC Properties LLC' }
]

const MOCK_BANK_ACCOUNTS = [
  { id: '1', name: 'Sunset Apartments Operating', accountNumber: '5678', routingNumber: '1234' },
  { id: '2', name: 'Main Operating Account', accountNumber: '9012', routingNumber: '5678' }
]

const MOCK_PROPERTY_MANAGERS = [
  { id: '1', name: 'Sarah Johnson' },
  { id: '2', name: 'Mike Wilson' },
  { id: '3', name: 'Lisa Chen' }
]

export default function AddPropertyModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess?: () => void }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<AddPropertyFormData>({
    rentalSubType: '',
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
    owners: [],
    operatingBankAccountId: '',
    depositTrustAccountId: '',
    reserve: 0,
    propertyManagerId: ''
  })

  const handleNext = () => {
    if (currentStep < 5) {
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
      // Submit the form data to your API
      const response = await fetch('/api/properties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create property')
      }

      const result = await response.json()
      console.log('Property created successfully:', result)
      
      onClose()
      if (onSuccess) onSuccess()
      // Reset form
      setFormData({
        rentalSubType: '',
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
        owners: [],
        operatingBankAccountId: '',
        depositTrustAccountId: '',
        reserve: 0,
        propertyManagerId: ''
      })
      setCurrentStep(1)
      
      // Optionally refresh the page or show success message
      window.location.reload()
    } catch (error) {
      console.error('Error creating property:', error)
      alert('Failed to create property. Please try again.')
    }
  }

  const addOwner = (ownerId: string) => {
    const owner = MOCK_OWNERS.find(o => o.id === ownerId)
    if (owner && !formData.owners.find(o => o.id === ownerId)) {
      setFormData(prev => ({
        ...prev,
        owners: [...prev.owners, {
          id: owner.id,
          name: owner.name,
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
    setFormData(prev => ({
      ...prev,
      owners: prev.owners.map(o => ({
        ...o,
        primary: o.id === ownerId
      }))
    }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-card rounded-lg border shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Add New Property</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

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
        <div className="p-6">
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
            <Step4BankAccount 
              formData={formData} 
              setFormData={setFormData} 
            />
          )}
          
          {currentStep === 5 && (
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

          <Button type="button" onClick={handleNext}>
            {currentStep === 5 ? 'Create Property' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Step 1: Property Type
function Step1PropertyType({ 
  formData, 
  setFormData 
}: { 
  formData: AddPropertyFormData; 
  setFormData: (data: AddPropertyFormData) => void 
}) {
  const CurrentIcon = STEPS[0].icon

  return (
    <div className="text-center">
      <CurrentIcon className="h-16 w-16 text-primary mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-foreground mb-2">Property Type</h3>
      <p className="text-muted-foreground mb-6">What type of property are you adding?</p>
      
      <div className="grid grid-cols-3 gap-4">
        {PROPERTY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setFormData({ ...formData, rentalSubType: type })}
            className={`p-4 border-2 rounded-lg text-center transition-colors hover:border-primary/40 ${
              formData.rentalSubType === type
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card'
            }`}
          >
            <Building
              className={`h-8 w-8 mx-auto mb-2 ${
                formData.rentalSubType === type ? 'text-primary' : 'text-muted-foreground'
              }`}
            />
            <div
              className={`text-sm font-medium ${
                formData.rentalSubType === type ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {type}
            </div>
          </button>
        ))}
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
  setFormData: (data: AddPropertyFormData) => void 
}) {
  const CurrentIcon = STEPS[1].icon

  return (
    <div>
      <div className="text-center mb-6">
        <CurrentIcon className="h-16 w-16 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Property Details</h3>
        <p className="text-muted-foreground">Enter the property address and basic information</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Property Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
            placeholder="Enter property name"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Street Address *
          </label>
          <input
            type="text"
            value={formData.addressLine1}
            onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
            placeholder="Enter street address"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Address Line 2 (Optional)
          </label>
          <input
            type="text"
            value={formData.addressLine2}
            onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
            placeholder="Apartment, suite, unit, building, floor, etc."
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              City *
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
              placeholder="Enter city"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              State *
            </label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
              placeholder="Enter state"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              ZIP Code *
            </label>
            <input
              type="text"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
              placeholder="Enter ZIP code"
            />
          </div>
        
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Country *</label>
          <Dropdown
            value={formData.country}
            onChange={(value: string) => setFormData({ ...formData, country: value })}
            options={COUNTRIES.map(country => ({ value: country, label: country }))}
            placeholder="Select country"
          />
          </div>
        
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Status</label>
          <Dropdown
            value={formData.status}
            onChange={(value: string) => setFormData({ ...formData, status: value as 'Active' | 'Inactive' })}
            options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]}
            placeholder="Select status"
          />
        </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Year Built (Optional)
          </label>
          <input
            type="text"
            value={formData.yearBuilt}
            onChange={(e) => setFormData({ ...formData, yearBuilt: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
            placeholder="Enter year built"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Description (Optional)
          </label>
          <textarea
            value={formData.structureDescription}
            onChange={(e) => setFormData({ ...formData, structureDescription: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
            rows={3}
            placeholder="Brief description of the property..."
          />
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
  setFormData: (data: AddPropertyFormData) => void;
  addOwner: (ownerId: string) => void;
  removeOwner: (ownerId: string) => void;
  updateOwnerPercentage: (ownerId: string, field: 'ownershipPercentage' | 'disbursementPercentage', value: number) => void;
  setPrimaryOwner: (ownerId: string) => void;
}) {
  const CurrentIcon = STEPS[2].icon

  return (
    <div>
      <div className="text-center mb-6">
        <CurrentIcon className="h-16 w-16 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Ownership</h3>
        <p className="text-muted-foreground">Select the owners related to this property</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Add Owners *
          </label>
          <select
            onChange={(e) => {
              if (e.target.value) {
                addOwner(e.target.value)
                e.target.value = ''
              }
            }}
            className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
          >
            <option value="">Choose owners to add...</option>
            {MOCK_OWNERS.map((owner) => (
              <option key={owner.id} value={owner.id}>{owner.name}</option>
            ))}
          </select>
        </div>
        
        {formData.owners.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Selected Owners</h4>
            <div className="space-y-3">
              {formData.owners.map((owner) => (
                <div key={owner.id} className="border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium">{owner.name}</span>
                    <button
                      onClick={() => removeOwner(owner.id)}
                      className="text-destructive hover:underline text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Ownership %</label>
                      <input
                        type="number"
                        value={owner.ownershipPercentage}
                        onChange={(e) => updateOwnerPercentage(owner.id, 'ownershipPercentage', Number(e.target.value))}
                        className="w-full px-2 py-1 border border-input rounded text-sm bg-background text-foreground"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Disbursement %</label>
                      <input
                        type="number"
                        value={owner.disbursementPercentage}
                        onChange={(e) => updateOwnerPercentage(owner.id, 'disbursementPercentage', Number(e.target.value))}
                        className="w-full px-2 py-1 border border-input rounded text-sm bg-background text-foreground"
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={owner.primary}
                      onChange={() => setPrimaryOwner(owner.id)}
                      className="mr-2"
                    />
                    <span className="text-sm text-muted-foreground">Primary</span>
                  </label>
                </div>
              ))}
            </div>
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
  setFormData: (data: AddPropertyFormData) => void 
}) {
  const CurrentIcon = STEPS[3].icon
  const selectedBankAccount = MOCK_BANK_ACCOUNTS.find(b => b.id === formData.operatingBankAccountId)
  const selectedTrustAccount = MOCK_BANK_ACCOUNTS.find(b => b.id === formData.depositTrustAccountId)

  return (
    <div>
      <div className="text-center mb-6">
        <CurrentIcon className="h-16 w-16 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Bank Account</h3>
        <p className="text-muted-foreground">Select the operating bank account for this property</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Operating Bank Account (Optional)</label>
          <Dropdown
            value={formData.operatingBankAccountId || ''}
            onChange={(value: string) => setFormData({ ...formData, operatingBankAccountId: value })}
            options={[{ value: '', label: 'Select a bank account...' }, ...MOCK_BANK_ACCOUNTS.map(a => ({ value: a.id, label: `${a.name} (...${a.accountNumber})` }))]}
            placeholder="Select a bank account..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Deposit Trust Account (Optional)</label>
          <Dropdown
            value={formData.depositTrustAccountId || ''}
            onChange={(value: string) => setFormData({ ...formData, depositTrustAccountId: value })}
            options={[{ value: '', label: 'Select a bank account...' }, ...MOCK_BANK_ACCOUNTS.map(a => ({ value: a.id, label: `${a.name} (...${a.accountNumber})` }))]}
            placeholder="Select a bank account..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Reserve Amount (Optional)</label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-muted-foreground">$</span>
            <input
              type="number"
              value={formData.reserve}
              onChange={(e) => setFormData({ ...formData, reserve: Number(e.target.value) })}
              className="w-full pl-8 pr-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">Minimum amount to maintain in the account</p>
        </div>
        
        {selectedBankAccount && (
          <div className="bg-muted border border-border rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-2">{selectedBankAccount.name}</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Account ending in {selectedBankAccount.accountNumber}</p>
              <p>Routing: ...{selectedBankAccount.routingNumber}</p>
            </div>
          </div>
        )}

        {selectedTrustAccount && (
          <div className="bg-muted border border-border rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-2">{selectedTrustAccount.name} (Deposit Trust)</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Account ending in {selectedTrustAccount.accountNumber}</p>
              <p>Routing: ...{selectedTrustAccount.routingNumber}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Step 5: Property Manager
function Step5PropertyManager({ 
  formData, 
  setFormData 
}: { 
  formData: AddPropertyFormData; 
  setFormData: (data: AddPropertyFormData) => void 
}) {
  const CurrentIcon = STEPS[4].icon

  return (
    <div>
      <div className="text-center mb-6">
        <CurrentIcon className="h-16 w-16 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-foreground mb-2">Property Manager</h3>
        <p className="text-muted-foreground">Assign a property manager (optional)</p>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Property Manager (Optional)
          </label>
          <select
            value={formData.propertyManagerId}
            onChange={(e) => setFormData({ ...formData, propertyManagerId: e.target.value })}
            className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary bg-background text-foreground"
          >
            <option value="">Choose a manager...</option>
            {MOCK_PROPERTY_MANAGERS.map((manager) => (
              <option key={manager.id} value={manager.id}>{manager.name}</option>
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
                {formData.rentalSubType || 'Not selected'}
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
                {MOCK_BANK_ACCOUNTS.find(b => b.id === formData.operatingBankAccountId)?.name || 'None selected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deposit Trust:</span>
              <span className="font-medium">
                {MOCK_BANK_ACCOUNTS.find(b => b.id === formData.depositTrustAccountId)?.name || 'None selected'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
