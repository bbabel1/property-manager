'use client'

import React, { useState } from 'react'
import { Save, Users } from 'lucide-react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import type { CreateStaffFormValues, StaffSummary } from '@/components/forms/types'
import { normalizeStaffRole } from '@/lib/staff-role'
import { getAvailableUIStaffRoles } from '@/lib/enums/staff-roles'

type CreateStaffModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (newStaff: StaffSummary) => void
}

const STAFF_ROLES = getAvailableUIStaffRoles()

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
        } catch {
          // If response is not JSON, use status text
          errorMessage = response.statusText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const newStaff = (await response.json()) as StaffSummary
      
      onSuccess(newStaff)
      onClose()
    } catch (caughtError: unknown) {
      console.error('Error creating staff member:', caughtError)
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create staff member. Please try again.')
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="bg-card sm:rounded-2xl rounded-none border border-border/80 shadow-2xl w-[92vw] sm:max-w-md md:max-w-lg max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="p-6 border-b border-border">
          <DialogTitle className="text-xl font-semibold text-foreground">Create New Staff Member</DialogTitle>
        </DialogHeader>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Staff Information */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Staff Information
            </h4>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="staff-first-name" className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    id="staff-first-name"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., John"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="staff-last-name" className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    id="staff-last-name"
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
                <label htmlFor="staff-email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  id="staff-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., john.smith@company.com"
                />
              </div>

              <div>
                <label htmlFor="staff-phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  id="staff-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., (555) 123-4567"
                />
              </div>

              <div>
                <label htmlFor="staff-role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  id="staff-role"
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-gray-900 shadow-sm appearance-none"
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
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
            <Button
              variant="outline"
              type="button"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            
            <Button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isLoading ? 'Creating...' : 'Create Staff Member'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
