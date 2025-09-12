'use client'

import { useState, useEffect } from 'react'
import { X, Save, DollarSign, Building2, Plus } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { type PropertyWithDetails } from '@/lib/property-service'
import CreateBankAccountModal from './CreateBankAccountModal'
import { Dropdown } from './ui/Dropdown';

interface BankAccount {
  id: string
  name: string
  description?: string
  bank_account_type?: string
  account_number?: string
  routing_number?: string
  country?: string
  created_at?: string
  updated_at?: string
}

interface BankingDetailsFormData {
  reserve: number
  operating_bank_account_id: string
  deposit_trust_account_id: string
}

interface BankingDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  property: PropertyWithDetails
}

export default function BankingDetailsModal({ isOpen, onClose, onSuccess, property }: BankingDetailsModalProps) {
  const [formData, setFormData] = useState<BankingDetailsFormData>({
    reserve: 0,
    operating_bank_account_id: '',
    deposit_trust_account_id: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [isLoadingBankAccounts, setIsLoadingBankAccounts] = useState(false)
  const [showCreateBankAccountModal, setShowCreateBankAccountModal] = useState(false)
  const [selectedAccountType, setSelectedAccountType] = useState<'operating' | 'trust' | null>(null)

  // Fetch bank accounts when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchBankAccounts()
    }
  }, [isOpen])

  // Initialize form data when property changes
  useEffect(() => {
    if (isOpen && property) {
      setFormData({
        reserve: property.reserve || 0,
        operating_bank_account_id: property.operating_bank_account_id || '',
        deposit_trust_account_id: property.deposit_trust_account_id || ''
      })
      setError(null)
    }
  }, [isOpen, property])

  const fetchBankAccounts = async () => {
    try {
      setIsLoadingBankAccounts(true)
      const response = await fetch('/api/bank-accounts')
      
      if (!response.ok) {
        throw new Error('Failed to fetch bank accounts')
      }
      
      const bankAccountsData = await response.json()
      setBankAccounts(bankAccountsData)
    } catch (error) {
      console.error('Error fetching bank accounts:', error)
      setError('Failed to fetch bank accounts')
    } finally {
      setIsLoadingBankAccounts(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 BankingDetailsModal: Submitting form data:', formData)
      
      const response = await fetch(`/api/properties/${property.id}/banking`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update banking details')
      }

      const result = await response.json()
      console.log('Banking details updated successfully:', result)
      
      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error updating banking details:', error)
      setError(error instanceof Error ? error.message : 'Failed to update banking details. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (field: keyof BankingDetailsFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleBankAccountChange = (field: 'operating_bank_account_id' | 'deposit_trust_account_id', value: string) => {
    if (value === 'create-new-account') {
      setSelectedAccountType(field === 'operating_bank_account_id' ? 'operating' : 'trust')
      setShowCreateBankAccountModal(true)
    } else {
      handleInputChange(field, value)
    }
  }

  const handleCreateBankAccountSuccess = (newAccount: BankAccount) => {
    // Add the new account to the list
    setBankAccounts(prev => [...prev, newAccount])
    
    // Auto-select the new account for the appropriate field
    if (selectedAccountType === 'operating') {
      handleInputChange('operating_bank_account_id', newAccount.id)
    } else if (selectedAccountType === 'trust') {
      handleInputChange('deposit_trust_account_id', newAccount.id)
    }
    
    setSelectedAccountType(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="bg-card sm:rounded-2xl rounded-none border border-border/80 shadow-2xl w-[92vw] sm:max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="p-6 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">Edit Banking Details</DialogTitle>
        </DialogHeader>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Banking Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Banking Information
            </h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Property Reserve ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    value={formData.reserve}
                    onChange={(e) => handleInputChange('reserve', parseFloat(e.target.value) || 0)}
                    className="w-full h-9 pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="e.g., 50000.00"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Operating Bank Account
                </label>
                <Dropdown
                  value={formData.operating_bank_account_id}
                  onChange={value => handleBankAccountChange('operating_bank_account_id', value)}
                  options={[
                    ...bankAccounts.map(account => ({
                      value: account.id,
                      label: `${account.name} - ${account.account_number ? `****${account.account_number.slice(-4)}` : 'No account number'}`
                    })),
                    { value: 'create-new-account', label: '✓ Create New Bank Account' }
                  ]}
                  placeholder="Select a bank account..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deposit Trust Account
                </label>
                <Dropdown
                  value={formData.deposit_trust_account_id}
                  onChange={value => handleBankAccountChange('deposit_trust_account_id', value)}
                  options={[
                    ...bankAccounts.map(account => ({
                      value: account.id,
                      label: `${account.name} - ${account.account_number ? `****${account.account_number.slice(-4)}` : 'No account number'}`
                    })),
                    { value: 'create-new-account', label: '✓ Create New Bank Account' }
                  ]}
                  placeholder="Select a bank account..."
                />
              </div>
            </div>
          </div>
        </form>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 px-6 pb-6">
          <Button
            variant="outline"
            onClick={onClose}
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
            {isLoading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </DialogContent>
      {/* Create Bank Account Modal */}
      <CreateBankAccountModal
        isOpen={showCreateBankAccountModal}
        onClose={() => {
          setShowCreateBankAccountModal(false)
          setSelectedAccountType(null)
        }}
        onSuccess={handleCreateBankAccountSuccess}
      />
    </Dialog>
  )
}
