'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, Mail, Phone, Calendar, Search } from 'lucide-react'
import CreateOwnerModal from '@/components/CreateOwnerModal'
import EditOwnerModal from '@/components/EditOwnerModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

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
  primary_country?: string
  management_agreement_start_date?: string
  management_agreement_end_date?: string
  created_at: string
  updated_at: string
  // Total units calculated from properties
  total_units?: number
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
  const [updateOwnerError, setUpdateOwnerError] = useState<string | null>(null)

  // Fetch owners on component mount
  useEffect(() => {
    fetchOwners()
  }, [])

  const fetchOwners = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/owners')
      if (!response.ok) {
        throw new Error('Failed to fetch owners')
      }
      
      const data = await response.json()
      
      // Use the real data from the API (total_units is now calculated on the backend)
      setOwners(data)
    } catch (error) {
      console.error('Error fetching owners:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch owners')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateOwner = async (ownerData: any) => {
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

      const newOwner = await response.json()
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

  const handleEditOwner = async (ownerData: any) => {
    try {
      setIsUpdatingOwner(true)
      setUpdateOwnerError(null)
      
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

      const updatedOwner = await response.json()
      console.log('Owner updated successfully:', updatedOwner)
      
      // Update the owner in the list
      setOwners(prev => prev.map(owner => 
        owner.id === updatedOwner.id ? updatedOwner : owner
      ))
      setShowEditModal(false)
      setEditingOwner(null)
      
    } catch (error) {
      console.error('Error updating owner:', error)
      setUpdateOwnerError(error instanceof Error ? error.message : 'Failed to update owner')
    } finally {
      setIsUpdatingOwner(false)
    }
  }

  const handleEditClick = (owner: Owner) => {
    setEditingOwner(owner)
    setShowEditModal(true)
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
          <h1 className="text-2xl font-bold text-foreground">Rental Owners</h1>
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
          <h1 className="text-2xl font-bold text-foreground">Rental Owners</h1>
        </div>
        <div className="bg-card rounded-lg border p-6">
          <div className="text-center py-8">
            <div className="text-destructive mb-4">
              <Users className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Error Loading Owners</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
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
          <h1 className="text-2xl font-bold text-foreground">Rental Owners</h1>
          <p className="text-muted-foreground">Manage property owners and their contact information.</p>
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
            <h3 className="text-lg font-medium text-foreground mb-2">No Owners Yet</h3>
            <p className="text-muted-foreground mb-6">Get started by creating your first property owner.</p>
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
            <div className="grid grid-cols-5 gap-4 text-sm font-medium text-foreground">
              <div>Owner</div>
              <div>Contact</div>
              <div>Entity Type</div>
              <div className="text-center">Units</div>
              <div className="text-center">Since</div>
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
                    <div className="font-medium text-foreground">{owner.displayName}</div>
                    <div className="text-sm text-muted-foreground">
                      {owner.primary_city && owner.primary_state 
                        ? `${owner.primary_city}, ${owner.primary_state}`
                        : 'Location not specified'
                      }
                    </div>
                  </div>
                  
                  {/* Contact Column */}
                  <div>
                    {owner.primary_email && (
                      <div className="flex items-center space-x-1 mb-1">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{owner.primary_email}</span>
                      </div>
                    )}
                    {owner.primary_phone && (
                      <div className="flex items-center space-x-1">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{owner.primary_phone}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Entity Type Column */}
                  <div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      owner.is_company 
                        ? 'bg-primary/10 text-primary' 
                        : 'bg-success/10 text-success'
                    }`}>
                      {owner.is_company ? 'Company' : 'Individual'}
                    </span>
                  </div>
                  
                  {/* Units Column */}
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <div className="w-4 h-4 bg-primary rounded"></div>
                      <span className="font-medium text-foreground">{owner.total_units || 0}</span>
                    </div>
                  </div>
                  
                  {/* Since Column */}
                  <div className="text-center">
                    <div className="flex items-center justify-center space-x-1">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {owner.management_agreement_start_date 
                          ? formatDate(owner.management_agreement_start_date)
                          : 'Not specified'
                        }
                      </span>
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
