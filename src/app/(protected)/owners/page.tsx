'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Mail, Phone, Calendar } from 'lucide-react'
import CreateOwnerModal, { type OwnerCreatePayload } from '@/components/CreateOwnerModal'
import EditOwnerModal, { type OwnerModalData } from '@/components/EditOwnerModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Database } from '@/types/database'
import { Body, Heading, Label } from '@/ui/typography'

type Country = Database['public']['Enums']['countries']

interface Owner {
  id: string
  contact_id: number
  displayName: string
  is_company: boolean
  first_name?: string
  last_name?: string
  company_name?: string
  primary_email?: string
  primary_phone?: string
  primary_address_line_1?: string
  primary_city?: string
  primary_state?: string
  primary_postal_code?: string
  primary_country?: Country | null
  management_agreement_start_date?: string
  management_agreement_end_date?: string
  created_at: string
  updated_at: string
  // Total units calculated from properties
  total_units?: number
  etf_account_type?: 'Checking' | 'Saving' | null
}

export default function OwnersPage() {
  const router = useRouter()
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isCreatingOwner, setIsCreatingOwner] = useState(false)
  const [createOwnerError, setCreateOwnerError] = useState<string | null>(null)
  
  // Edit state
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null)
  const [isUpdatingOwner, setIsUpdatingOwner] = useState(false)

  // Fetch owners on component mount
  const fetchOwners = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/owners')
      if (!response.ok) {
        throw new Error('Failed to fetch owners')
      }
      
      const data = (await response.json()) as Owner[]
      
      // Use the real data from the API (total_units is now calculated on the backend)
      setOwners(data)
    } catch (error) {
      console.error('Error fetching owners:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch owners')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchOwners()
  }, [fetchOwners])

  const handleCreateOwner = async (ownerData: OwnerCreatePayload) => {
    try {
      setIsCreatingOwner(true)
      setCreateOwnerError(null)
      
      console.log('Creating owner with data:', ownerData)
      
      const response = await fetch('/api/owners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ownerData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create owner')
      }

      const newOwner = (await response.json()) as Owner
      console.log('Owner created successfully:', newOwner)
      
      // Add the new owner to the list
      setOwners(prev => [...prev, newOwner])
      setShowCreateModal(false)
      
    } catch (error) {
      console.error('Error creating owner:', error)
      setCreateOwnerError(error instanceof Error ? error.message : 'Failed to create owner')
    } finally {
      setIsCreatingOwner(false)
    }
  }

  const handleEditOwner = async (ownerData: OwnerModalData) => {
    try {
      setIsUpdatingOwner(true)
      
      console.log('Updating owner with data:', ownerData)
      
      const response = await fetch(`/api/owners/${ownerData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ownerData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update owner')
      }

      const updatedOwner = (await response.json()) as Owner
      console.log('Owner updated successfully:', updatedOwner)
      
      // Update the owner in the list
      setOwners(prev => prev.map(owner => 
        owner.id === updatedOwner.id ? updatedOwner : owner
      ))
      setShowEditModal(false)
      setEditingOwner(null)
      
    } catch (error) {
      console.error('Error updating owner:', error)
      setError(error instanceof Error ? error.message : 'Failed to update owner')
    } finally {
      setIsUpdatingOwner(false)
    }
  }

  const handleOwnerClick = (owner: Owner) => {
    router.push(`/owners/${owner.id}`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Heading as="h1" size="h3">
            Rental Owners
          </Heading>
        </div>
        <div className="bg-card rounded-lg border p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-4 bg-muted rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Heading as="h1" size="h3">
            Rental Owners
          </Heading>
        </div>
        <div className="bg-card rounded-lg border p-6">
          <div className="text-center py-8">
            <div className="text-destructive mb-4">
              <Users className="h-12 w-12 mx-auto" />
            </div>
            <Heading as="h3" size="h5" className="mb-2">
              Error Loading Owners
            </Heading>
            <Body tone="muted" size="sm" className="mb-4">
              {error}
            </Body>
            <Button onClick={fetchOwners}>
              Try Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading as="h1" size="h3">
            Rental Owners
          </Heading>
          <Body tone="muted" size="sm">
            Manage property owners and their contact information.
          </Body>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          New Owner
        </Button>
      </div>
      
      {owners.length === 0 ? (
        <div className="bg-card rounded-lg border p-6">
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <Heading as="h3" size="h5" className="mb-2">
              No Owners Yet
            </Heading>
            <Body tone="muted" size="sm" className="mb-6">
              Get started by creating your first property owner.
            </Body>
            <Button onClick={() => setShowCreateModal(true)} className="mx-auto flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Create First Owner
            </Button>
          </div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Owners ({owners.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
          
          {/* Table Header */}
          <div className="px-6 py-3 bg-muted border-b border-border">
            <div className="grid grid-cols-5 gap-4">
              <Label as="div" size="sm">
                Owner
              </Label>
              <Label as="div" size="sm">
                Contact
              </Label>
              <Label as="div" size="sm">
                Entity Type
              </Label>
              <Label as="div" size="sm" className="text-center">
                Units
              </Label>
              <Label as="div" size="sm" className="text-center">
                Since
              </Label>
            </div>
          </div>
          
          {/* Table Body */}
          <div className="divide-y divide-border">
            {owners.map((owner) => (
              <div 
                key={owner.id} 
                className="px-6 py-4 hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => handleOwnerClick(owner)}
              >
                <div className="grid grid-cols-5 gap-4 items-center">
                  {/* Owner Column */}
                  <div>
                    <Label as="div" size="sm">
                      {owner.displayName}
                    </Label>
                    <Body as="div" size="sm" tone="muted">
                      {owner.primary_city && owner.primary_state 
                        ? `${owner.primary_city}, ${owner.primary_state}`
                        : 'Location not specified'
                      }
                    </Body>
                  </div>
                  
                  {/* Contact Column */}
                  <div>
                    {owner.primary_email && (
                      <div className="flex items-center space-x-1 mb-1">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <Body as="span" size="sm">
                          {owner.primary_email}
                        </Body>
                      </div>
                    )}
                    {owner.primary_phone && (
                      <div className="flex items-center space-x-1">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <Body as="span" size="sm" tone="muted">
                          {owner.primary_phone}
                        </Body>
                      </div>
                    )}
                  </div>
                  
                  {/* Entity Type Column */}
                  <div>
                    <Label as="span" size="xs" className={`inline-flex items-center px-2.5 py-0.5 rounded-full ${
                      owner.is_company 
                        ? 'bg-primary/10 text-primary' 
                        : 'bg-success/10 text-success'
                    }`}>
                      {owner.is_company ? 'Company' : 'Individual'}
                    </Label>
                  </div>
                  
                  {/* Units Column */}
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <div className="w-4 h-4 bg-primary rounded"></div>
                      <Label as="span" size="sm">
                        {owner.total_units || 0}
                      </Label>
                    </div>
                  </div>
                  
                  {/* Since Column */}
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <Body as="span" size="sm" tone="muted">
                        {owner.management_agreement_start_date 
                          ? formatDate(owner.management_agreement_start_date)
                          : 'Not specified'
                        }
                      </Body>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </CardContent>
        </Card>
      )}

      {/* Create Owner Modal */}
      <CreateOwnerModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setCreateOwnerError(null)
        }}
        onCreateOwner={handleCreateOwner}
        isLoading={isCreatingOwner}
        error={createOwnerError}
      />
      
      <EditOwnerModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingOwner(null)
        }}
        onUpdateOwner={handleEditOwner}
        ownerData={editingOwner}
        isUpdating={isUpdatingOwner}
      />
    </div>
  )
}
