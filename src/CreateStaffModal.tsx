'use client'

import React, { useState } from 'react'
import { X, Save, Users } from 'lucide-react'
import { Button } from './ui/button'
import type { CreateStaffFormValues, StaffSummary } from '@/components/forms/types'
import { normalizeStaffRole } from '@/lib/staff-role'

type CreateStaffModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newStaff: StaffSummary) => void
}

const STAFF_ROLES = ['Property Manager', 'Bookkeeper']

const INITIAL_FORM: CreateStaffFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'Property Manager'
}

export default function CreateStaffModal({ isOpen, onClose, onSuccess }: CreateStaffModalProps) {
  const [formData, setFormData] = useState<CreateStaffFormValues>(() => ({ ...INITIAL_FORM }))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      console.log('🔍 CreateStaffModal: Submitting form data:', formData)
      
      const normalizedRole = normalizeStaffRole(formData.role)
      if (!normalizedRole) {
        throw new Error('Please select a valid staff role')
      }

      const payload = { ...formData, role: normalizedRole }

      const response = await fetch('/api/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        let errorMessage = 'Failed to create staff member'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (parseError) {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const newStaff = (await response.json()) as StaffSummary
      console.log('Staff member created successfully:', newStaff)
      
      onSuccess(newStaff)
      onClose()
    } catch (error) {
      console.error('Error creating staff member:', error)
      setError(error instanceof Error ? error.message : 'Failed to create staff member. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = <K extends keyof CreateStaffFormValues>(field: K, value: CreateStaffFormValues[K]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleClose = () => {
    setFormData(() => ({ ...INITIAL_FORM }))
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Create New Staff Member</h2>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close create staff modal"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form Content */}
        <form id="create-staff-modal-form" onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Staff Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Staff Information
            </h4>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., John"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Smith"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., john.smith@company.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., (555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 shadow-sm appearance-none custom-select-arrow"
                  aria-label="Staff role"
                  required
                >
                  {STAFF_ROLES.map((role) => (
                    <option key={role} value={role} className="text-gray-900 bg-white">
                      {role}
                    </option>
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
            type="submit"
            form="create-staff-modal-form"
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Creating...' : 'Create Staff Member'}
          </Button>
        </div>
      </div>
    </div>
  )
}
