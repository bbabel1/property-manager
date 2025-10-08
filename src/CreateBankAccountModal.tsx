'use client'

import React, { useState } from 'react'
import { X, Save, Building2 } from 'lucide-react'
import { Button } from './ui/button'
import type { BankAccountSummary, CreateBankAccountFormValues } from '@/components/forms/types'

type CreateBankAccountModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newAccount: BankAccountSummary) => void
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

const INITIAL_FORM: CreateBankAccountFormValues = {
  name: '',
  description: '',
  bank_account_type: '',
  account_number: '',
  routing_number: '',
  country: 'United States'
}

export default function CreateBankAccountModal({ isOpen, onClose, onSuccess }: CreateBankAccountModalProps) {
  const [formData, setFormData] = useState<CreateBankAccountFormValues>(() => ({ ...INITIAL_FORM }))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [syncToBuildium, setSyncToBuildium] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 CreateBankAccountModal: Submitting form data:', formData)
      
      const url = syncToBuildium ? '/api/bank-accounts?syncToBuildium=true' : '/api/bank-accounts'
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        if (response.status === 409) {
          // Duplicate — try to reuse the existing account
          try {
            const conflict = await response.json().catch(() => ({}))
            const existingId: string | undefined = conflict?.existing?.id
            if (existingId) {
              // Fetch the list and find the existing account to pass to onSuccess
              const listRes = await fetch('/api/bank-accounts')
              if (listRes.ok) {
                const list = (await listRes.json()) as BankAccountSummary[]
                const existing = list.find(a => a.id === existingId)
                if (existing) {
                  onSuccess(existing)
                  onClose()
                  return
                }
              }
              throw new Error(conflict?.error || 'Bank account already exists')
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Bank account already exists'
            throw new Error(msg)
          }
        }
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

      const raw = await response.json()
      const newAccount = (raw && raw.success && raw.data) ? (raw.data as BankAccountSummary) : (raw as BankAccountSummary)
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

  const handleInputChange = <K extends keyof CreateBankAccountFormValues>(field: K, value: CreateBankAccountFormValues[K]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleClose = () => {
    setFormData(() => ({ ...INITIAL_FORM }))
    setSyncToBuildium(false)
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Bank Account</h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            title="Close"
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form Content */}
        <form id="create-bank-account-form" onSubmit={handleSubmit} className="p-6 space-y-6">
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
                <label htmlFor="bankAccountType" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Type *
                </label>
                <select
                  id="bankAccountType"
                  value={formData.bank_account_type}
                  onChange={(e) => handleInputChange('bank_account_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 shadow-sm appearance-none custom-select-arrow"
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
                <label htmlFor="bankCountry" className="block text-sm font-medium text-gray-700 mb-1">
                  Country *
                </label>
                <select
                  id="bankCountry"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 shadow-sm appearance-none custom-select-arrow"
                  required
                >
                  {COUNTRIES.map((country) => (
                    <option key={country} value={country} className="text-gray-900 bg-white">{country}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="syncToBuildium"
                type="checkbox"
                checked={syncToBuildium}
                onChange={(e) => setSyncToBuildium(e.target.checked)}
                className="h-4 w-4 border-gray-300 rounded"
              />
              <label htmlFor="syncToBuildium" className="text-sm text-gray-700 select-none">
                Create this bank account in Buildium
              </label>
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
            type="submit"
            form="create-bank-account-form"
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Creating...' : 'Create Account'}
          </Button>
        </div>
      </div>
    </div>
  )
}
