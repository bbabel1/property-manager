'use client'

import { useState } from 'react'
import { X, Save, Building2, Plus } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'

interface CreateBankAccountFormData {
  name: string
  description: string
  bank_account_type: string
  account_number: string
  routing_number: string
  country: string
}

interface CreateBankAccountModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newAccount: any) => void
}

const BANK_ACCOUNT_TYPES = [
  'Checking',
  'Savings',
  'Money Market',
  'Certificate of Deposit',
  'Business Checking',
  'Business Savings'
]

const COUNTRIES = [
  'United States',
  'Canada',
  'United Kingdom',
  'Australia',
  'Germany',
  'France',
  'Japan',
  'Mexico',
  'Brazil',
  'India'
]

export default function CreateBankAccountModal({ isOpen, onClose, onSuccess }: CreateBankAccountModalProps) {
  const [formData, setFormData] = useState<CreateBankAccountFormData>({
    name: '',
    description: '',
    bank_account_type: '',
    account_number: '',
    routing_number: '',
    country: 'United States'
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 CreateBankAccountModal: Submitting form data:', formData)
      
      const response = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to create bank account'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (parseError) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const newAccount = await response.json()
      console.log('Bank account created successfully:', newAccount)
      
      onSuccess(newAccount)
      onClose()
    } catch (error) {
      console.error('Error creating bank account:', error)
      setError(error instanceof Error ? error.message : 'Failed to create bank account. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof CreateBankAccountFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      bank_account_type: '',
      account_number: '',
      routing_number: '',
      country: 'United States'
    })
    setError(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="bg-card sm:rounded-2xl rounded-none border border-border/80 shadow-2xl w-[92vw] sm:max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="p-6 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">Create New Bank Account</DialogTitle>
        </DialogHeader>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Account Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Account Information
            </h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Chase Business Account"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional description of the account"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Type *
                </label>
                <select
                  value={formData.bank_account_type}
                  onChange={(e) => handleInputChange('bank_account_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 shadow-sm appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                  required
                >
                  <option value="" className="text-gray-500 bg-white">Select account type...</option>
                  {BANK_ACCOUNT_TYPES.map((type) => (
                    <option key={type} value={type} className="text-gray-900 bg-white">{type}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Account Number *
                  </label>
                  <input
                    type="text"
                    value={formData.account_number}
                    onChange={(e) => handleInputChange('account_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 1234567890"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Routing Number *
                  </label>
                  <input
                    type="text"
                    value={formData.routing_number}
                    onChange={(e) => handleInputChange('routing_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., 021000021"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country *
                </label>
                <select
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 shadow-sm appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                    backgroundPosition: 'right 0.5rem center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '1.5em 1.5em',
                    paddingRight: '2.5rem'
                  }}
                  required
                >
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country} className="text-gray-900 bg-white">{country}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </form>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 px-6 pb-6">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          
          <Button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Creating...' : 'Create Account'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
