'use client'

import { useState } from 'react'
import { X, Building, MapPin, Users, DollarSign, UserCheck } from 'lucide-react'

interface AddPropertyFormData {
  // Step 1: Property Type
  rentalSubType: string
  
  // Step 2: Property Details
  name: string
  addressLine1: string
  city: string
  state: string
  postalCode: string
  country: string
  yearBuilt?: string
  structureDescription?: string
  
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

export default function AddPropertyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<AddPropertyFormData>({
    rentalSubType: '',
    name: '',
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    yearBuilt: '',
    structureDescription: '',
    owners: [],
    operatingBankAccountId: '',
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
      // Reset form
      setFormData({
        rentalSubType: '',
        name: '',
        addressLine1: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        yearBuilt: '',
        structureDescription: '',
        owners: [],
        operatingBankAccountId: '',
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add New Property</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                  currentStep >= step.id 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'border-gray-300 text-gray-500'
                }`}>
                  {currentStep > step.id ? (
                    <span className="text-sm">✓</span>
                  ) : (
                    <span className="text-sm">{step.id}</span>
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`w-16 h-0.5 mx-2 ${
                    currentStep > step.id ? 'bg-blue-600' : 'bg-gray-300'
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
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className={`px-4 py-2 rounded-md ${
              currentStep === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Previous
          </button>
          
          <button
            onClick={handleNext}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            {currentStep === 5 ? 'Create Property' : 'Next'}
          </button>
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
      <CurrentIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Property Type</h3>
      <p className="text-gray-600 mb-6">What type of property are you adding?</p>
      
      <div className="grid grid-cols-3 gap-4">
        {PROPERTY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setFormData({ ...formData, rentalSubType: type })}
            className={`p-4 border-2 rounded-lg text-center hover:border-blue-300 transition-colors ${
              formData.rentalSubType === type
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200'
            }`}
          >
            <Building className="h-8 w-8 text-gray-600 mx-auto mb-2" />
            <div className="text-sm font-medium">{type}</div>
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
        <CurrentIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Property Details</h3>
        <p className="text-gray-600">Enter the property address and basic information</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Property Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter property name"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Street Address *
          </label>
          <input
            type="text"
            value={formData.addressLine1}
            onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter street address"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City *
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter city"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State *
            </label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter state"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ZIP Code *
            </label>
            <input
              type="text"
              value={formData.postalCode}
              onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter ZIP code"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country *
            </label>
            <select
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((country) => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Year Built (Optional)
          </label>
          <input
            type="text"
            value={formData.yearBuilt}
            onChange={(e) => setFormData({ ...formData, yearBuilt: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter year built"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (Optional)
          </label>
          <textarea
            value={formData.structureDescription}
            onChange={(e) => setFormData({ ...formData, structureDescription: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <CurrentIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Ownership</h3>
        <p className="text-gray-600">Select the owners related to this property</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Add Owners *
          </label>
          <select
            onChange={(e) => {
              if (e.target.value) {
                addOwner(e.target.value)
                e.target.value = ''
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose owners to add...</option>
            {MOCK_OWNERS.map((owner) => (
              <option key={owner.id} value={owner.id}>{owner.name}</option>
            ))}
          </select>
        </div>
        
        {formData.owners.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Selected Owners</h4>
            <div className="space-y-3">
              {formData.owners.map((owner) => (
                <div key={owner.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium">{owner.name}</span>
                    <button
                      onClick={() => removeOwner(owner.id)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Ownership %</label>
                      <input
                        type="number"
                        value={owner.ownershipPercentage}
                        onChange={(e) => updateOwnerPercentage(owner.id, 'ownershipPercentage', Number(e.target.value))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Disbursement %</label>
                      <input
                        type="number"
                        value={owner.disbursementPercentage}
                        onChange={(e) => updateOwnerPercentage(owner.id, 'disbursementPercentage', Number(e.target.value))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
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
                    <span className="text-sm text-gray-700">Primary</span>
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

  return (
    <div>
      <div className="text-center mb-6">
        <CurrentIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Bank Account</h3>
        <p className="text-gray-600">Select the operating bank account for this property</p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Operating Bank Account (Optional)
          </label>
          <select
            value={formData.operatingBankAccountId}
            onChange={(e) => setFormData({ ...formData, operatingBankAccountId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a bank account...</option>
            {MOCK_BANK_ACCOUNTS.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} (...{account.accountNumber})
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Reserve Amount (Optional)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-500">$</span>
            <input
              type="number"
              value={formData.reserve}
              onChange={(e) => setFormData({ ...formData, reserve: Number(e.target.value) })}
              className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Minimum amount to maintain in the account</p>
        </div>
        
        {selectedBankAccount && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">{selectedBankAccount.name}</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>Account ending in {selectedBankAccount.accountNumber}</p>
              <p>Routing: ...{selectedBankAccount.routingNumber}</p>
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
        <CurrentIcon className="h-16 w-16 text-blue-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Property Manager</h3>
        <p className="text-gray-600">Assign a property manager (optional)</p>
      </div>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Property Manager (Optional)
          </label>
          <select
            value={formData.propertyManagerId}
            onChange={(e) => setFormData({ ...formData, propertyManagerId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Choose a manager...</option>
            {MOCK_PROPERTY_MANAGERS.map((manager) => (
              <option key={manager.id} value={manager.id}>{manager.name}</option>
            ))}
          </select>
        </div>
        
        {/* Property Summary */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Property Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Property:</span>
              <span className="font-medium">{formData.name || 'Not specified'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Type:</span>
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                {formData.rentalSubType || 'Not selected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Address:</span>
              <span className="font-medium">{formData.addressLine1 || 'Not specified'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Country:</span>
              <span className="font-medium">{formData.country || 'Not specified'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Year Built:</span>
              <span className="font-medium">{formData.yearBuilt || 'Not specified'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Owners:</span>
              <span className="font-medium">
                {formData.owners.map(o => o.name).join(', ') || 'None selected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Primary Owner:</span>
              <span className="font-medium">
                {formData.owners.find(o => o.primary)?.name || 'None selected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Bank Account:</span>
              <span className="font-medium">
                {MOCK_BANK_ACCOUNTS.find(b => b.id === formData.operatingBankAccountId)?.name || 'None selected'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
