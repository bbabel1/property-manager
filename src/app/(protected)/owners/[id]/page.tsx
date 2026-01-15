'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  Copy,
  DollarSign,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  User,
  Users
} from 'lucide-react'
import EditLink from '@/components/ui/EditLink'
import EditOwnerModal, { type OwnerModalData } from '@/components/EditOwnerModal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  primary_address_line_2?: string
  primary_city?: string
  primary_state?: string
  primary_postal_code?: string
  primary_country?: Country | null
  management_agreement_start_date?: string
  management_agreement_end_date?: string
  created_at: string
  updated_at: string
  total_units?: number
  // Additional fields for details page
  alt_email?: string
  alt_phone?: string
  date_of_birth?: string
  comment?: string
  tax_payer_id?: string
  tax_payer_type?: string
  tax_payer_name?: string
  tax_address_line1?: string
  tax_address_line2?: string
  tax_city?: string
  tax_state?: string
  tax_postal_code?: string
  tax_country?: Country | null
  // ETF Account Information
  etf_account_type?: 'Checking' | 'Saving' | null
  etf_account_number?: number | null
  etf_routing_number?: number | null
  // Status and preferences
  status?: 'active' | 'inactive'
  preferred_contact_method?: 'email' | 'phone' | 'text'
  email_opt_in?: boolean
  text_opt_in?: boolean
  referral_source?: string
  loyalty_tier?: 'bronze' | 'silver' | 'gold' | 'platinum'
  client_since?: string
  last_contact_date?: string
  notes?: string
}

interface Property {
  id: string
  name: string
  address_line1: string
  city: string
  state: string
  postal_code: string
  total_units: number
  status: string
  ownership_percentage: number
  disbursement_percentage: number
  primary: boolean
}

const maskLastFour = (value?: string | number | null) => {
  if (value === null || value === undefined) return null
  const digits = String(value).replace(/\D+/g, '')
  if (!digits) return null
  const lastFour = digits.slice(-4)
  return `••••${lastFour}`
}

// Helper function to convert Owner to OwnerModalData
function ownerToModalData(owner: Owner): OwnerModalData {
  return {
    id: owner.id,
    contact_id: owner.contact_id,
    management_agreement_start_date: owner.management_agreement_start_date,
    management_agreement_end_date: owner.management_agreement_end_date,
    comment: owner.comment,
    etf_account_type: owner.etf_account_type,
    etf_account_number: owner.etf_account_number,
    etf_routing_number: owner.etf_routing_number,
    created_at: owner.created_at,
    updated_at: owner.updated_at
  }
}

export default function OwnerDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const ownerId = params.id as string

  const [owner, setOwner] = useState<Owner | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("overview")
  
  // Edit state
  const [showEditModal, setShowEditModal] = useState(false)
  const [isUpdatingOwner, setIsUpdatingOwner] = useState(false)
  const fetchOwnerProperties = useCallback(async () => {
    try {
      const response = await fetch(`/api/owners/${ownerId}/properties`)
      if (response.ok) {
        const data = (await response.json()) as Property[]
        setProperties(data)
      }
    } catch (fetchError) {
      console.error('Error fetching owner properties:', fetchError)
      // Don't set error here as it's not critical for the main page
    }
  }, [ownerId])

  const fetchOwnerDetails = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/owners/${ownerId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch owner details')
      }
      
      const data = (await response.json()) as Owner
      setOwner(data)
      
      await fetchOwnerProperties()
    } catch (fetchError) {
      console.error('Error fetching owner details:', fetchError)
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch owner details')
    } finally {
      setLoading(false)
    }
  }, [fetchOwnerProperties, ownerId])

  const handleEditOwner = async (ownerData: OwnerModalData) => {
    try {
      setIsUpdatingOwner(true)
      
      const response = await fetch(`/api/owners/${ownerId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ownerData),
      })
      
      if (!response.ok) {
        throw new Error('Failed to update owner')
      }
      
      const updatedOwner = (await response.json()) as Owner
      setOwner(updatedOwner)
      setShowEditModal(false)
    } catch (error) {
      console.error('Error updating owner:', error)
    } finally {
      setIsUpdatingOwner(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  useEffect(() => {
    if (ownerId) {
      fetchOwnerDetails()
    }
  }, [fetchOwnerDetails, ownerId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <Body tone="muted" size="sm">
              Loading owner details...
            </Body>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <Label as="span" size="sm" tone="muted">
                Back to Owners
              </Label>
            </button>
          </div>
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <Heading as="h2" size="h4" className="mb-2">
              Failed to Load Owner
            </Heading>
            <Body tone="muted" size="sm" className="mb-6">
              {error}
            </Body>
            <button
              onClick={fetchOwnerDetails}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!owner) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => router.back()}
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <Label as="span" size="sm" tone="muted">
                Back to Owners
              </Label>
            </button>
          </div>
          <div className="text-center py-12">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <Heading as="h2" size="h4" className="mb-2">
              Owner Not Found
            </Heading>
            <Body tone="muted" size="sm">
              The requested owner could not be found.
            </Body>
          </div>
        </div>
      </div>
    )
  }

  const totalUnits = properties.reduce((sum, property) => sum + property.total_units, 0)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="px-8 py-6">
          {/* Breadcrumb */}
          <Body as="div" size="sm" tone="muted" className="flex items-center gap-2 mb-6">
            <Link href="/owners" className="hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span>Owners</span>
            <span>/</span>
            <Label as="span" size="sm">
              {owner.displayName}
            </Label>
          </Body>

          {/* Owner Profile */}
          <div className="flex items-start gap-6 mb-8">
            {/* Avatar */}
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
              <Heading as="span" size="h4" className="text-primary-foreground">
                {owner.displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
              </Heading>
            </div>
            
            {/* Owner Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Heading as="h1" size="h3">
                  {owner.displayName}
                </Heading>
                <Label as="span" size="sm" className="px-3 py-1 bg-success/10 text-success rounded-full">
                  Active
                </Label>
              </div>
              
              {/* Owner Details Line */}
              <div className="flex items-center gap-4 text-muted-foreground">
                <Label as="span" size="sm" className="px-3 py-1 bg-primary/10 text-primary rounded-full">
                  Individual
                </Label>
                <Body as="span" size="sm" tone="muted">
                  {properties.length} Properties • {totalUnits} Units
                </Body>
                <Body as="span" size="sm" tone="muted">
                  Last contact {formatDate(owner.updated_at)}
                </Body>
              </div>
            </div>

            {/* Edit Button */}
            <EditLink onClick={() => setShowEditModal(true)} />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border px-8 py-2">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-muted border border-border rounded-full p-1 h-auto w-full justify-start gap-1">
            <TabsTrigger
              value="overview"
              className="flex items-center gap-2 px-4 py-2 rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all duration-200"
            >
              <Users className="w-4 h-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger
              value="financials"
              className="flex items-center gap-2 px-4 py-2 rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all duration-200"
            >
              <DollarSign className="w-4 h-4" />
              Financials
            </TabsTrigger>
            <TabsTrigger
              value="properties"
              className="flex items-center gap-2 px-4 py-2 rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all duration-200"
            >
              <Building2 className="w-4 h-4" />
              Properties ({properties.length})
            </TabsTrigger>
            <TabsTrigger
              value="communications"
              className="flex items-center gap-2 px-4 py-2 rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all duration-200"
            >
              <MessageSquare className="w-4 h-4" />
              Communications
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="flex items-center gap-2 px-4 py-2 rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all duration-200"
            >
              <FileText className="w-4 h-4" />
              Files
            </TabsTrigger>
            <TabsTrigger
              value="notes"
              className="flex items-center gap-2 px-4 py-2 rounded-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-border data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground transition-all duration-200"
            >
              <MessageSquare className="w-4 h-4" />
              Notes
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Main Content */}
      <div className="px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="overview" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              {/* Left Column - Main Content */}
              <div className="lg:col-span-3 space-y-6">
                {/* Rental owner information */}
                <div className="bg-card rounded-lg border p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Heading as="h2" size="h5">
                      Rental owner information
                    </Heading>
                    <EditLink aria-label="Edit rental owner information" />
                  </div>
                  
                  {/* 3-Column Layout for Contact Info */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    {/* Email Column */}
                    <div>
                      <Label as="h3" size="xs" className="border-b border-border pb-2 mb-3 tracking-wide">
                        EMAIL:
                      </Label>
                      <div className="space-y-2">
                        {owner.primary_email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <Body as="span" size="sm">
                              {owner.primary_email}
                            </Body>
                            <button 
                              onClick={() => copyToClipboard(owner.primary_email!)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Copy email to clipboard"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {owner.alt_email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <Body as="span" size="sm">
                              {owner.alt_email}
                            </Body>
                            <button 
                              onClick={() => copyToClipboard(owner.alt_email!)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Copy alternate email to clipboard"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {owner.email_opt_in && (
                          <div className="mt-2">
                            <Label as="span" size="xs" className="px-2 py-1 bg-success/10 text-success rounded">
                              Opted In
                            </Label>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Phone Column */}
                    <div>
                      <Label as="h3" size="xs" className="border-b border-border pb-2 mb-3 tracking-wide">
                        PHONE:
                      </Label>
                      <div className="space-y-2">
                        {owner.primary_phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <Body as="span" size="sm">
                              {owner.primary_phone}
                            </Body>
                          </div>
                        )}
                        {!owner.text_opt_in && (
                          <div className="mt-2">
                            <Label as="span" size="xs" className="px-2 py-1 bg-muted text-muted-foreground rounded">
                              Text Messaging Disabled
                            </Label>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Address Column */}
                    <div>
                      <Label as="h3" size="xs" className="border-b border-border pb-2 mb-3 tracking-wide">
                        ADDRESS:
                      </Label>
                      <div className="space-y-1">
                        {owner.primary_address_line_1 ? (
                          <>
                            <Body as="div" size="sm">
                              {owner.primary_address_line_1}
                            </Body>
                            {owner.primary_address_line_2 && (
                              <Body as="div" size="sm">
                                {owner.primary_address_line_2}
                              </Body>
                            )}
                            <Body as="div" size="sm">
                              {owner.primary_city}, {owner.primary_state} {owner.primary_postal_code}
                            </Body>
                          </>
                        ) : (
                          <Body as="span" size="sm" tone="muted">
                            No address
                          </Body>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Full-width rows for Date of Birth and Comments */}
                  <div className="space-y-4">
                    <div>
                      <Label as="h3" size="xs" className="border-b border-border pb-2 mb-3 tracking-wide">
                        DATE OF BIRTH:
                      </Label>
                      <Body as="div" size="sm">
                        {owner.date_of_birth ? formatDate(owner.date_of_birth) : (
                          <Body as="span" size="sm" tone="muted">
                            Not provided
                          </Body>
                        )}
                      </Body>
                    </div>

                    <div>
                      <Label as="h3" size="xs" className="border-b border-border pb-2 mb-3 tracking-wide">
                        COMMENTS:
                      </Label>
                      <Body as="div" size="sm">
                        {owner.comment || <Body as="span" size="sm" tone="muted">No comments</Body>}
                      </Body>
                    </div>
                  </div>
                </div>

                {/* Management Agreement */}
                <div className="bg-card rounded-lg border p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Heading as="h2" size="h5">
                      Management Agreement
                    </Heading>
                    <EditLink aria-label="Edit management agreement" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label as="span" size="sm" tone="muted">
                        Start Date
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Body as="span" size="sm">
                          {owner.management_agreement_start_date ? (
                            formatDate(owner.management_agreement_start_date)
                          ) : (
                            <Body as="span" size="sm" tone="muted">
                              Not set
                            </Body>
                          )}
                        </Body>
                      </div>
                    </div>
                    
                    <div>
                      <Label as="span" size="sm" tone="muted">
                        End Date
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <Body as="span" size="sm">
                          {owner.management_agreement_end_date ? (
                            formatDate(owner.management_agreement_end_date)
                          ) : (
                            <Body as="span" size="sm" tone="muted">
                              Not set
                            </Body>
                          )}
                        </Body>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banking Information */}
                <div className="bg-card rounded-lg border p-6">
                  <div className="flex items-center gap-2 mb-6">
                    <Heading as="h2" size="h5">
                      Banking Information
                    </Heading>
                    <div className="flex items-center gap-2">
                      <Label as="span" size="xs" className="px-2 py-1 bg-success/10 text-success rounded">
                        EFT Enabled
                      </Label>
                      <EditLink aria-label="Edit banking information" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <Label as="span" size="sm" tone="muted">
                        Account Type
                      </Label>
                      <Body as="div" size="sm" className="mt-1">
                        {owner.etf_account_type || (
                          <Body as="span" size="sm" tone="muted">
                            Not set
                          </Body>
                        )}
                      </Body>
                    </div>
                    
                    <div>
                      <Label as="span" size="sm" tone="muted">
                        Account Number
                      </Label>
                      <Body as="div" size="sm" className="mt-1">
                        {maskLastFour(owner.etf_account_number) ?? (
                          <Body as="span" size="sm" tone="muted">
                            Not set
                          </Body>
                        )}
                      </Body>
                    </div>
                    
                    <div>
                      <Label as="span" size="sm" tone="muted">
                        Routing Number
                      </Label>
                      <Body as="div" size="sm" className="mt-1">
                        {maskLastFour(owner.etf_routing_number) ?? (
                          <Body as="span" size="sm" tone="muted">
                            Not set
                          </Body>
                        )}
                      </Body>
                    </div>
                  </div>
                </div>

                {/* Tax Profile */}
                <div className="bg-card rounded-lg border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <Heading as="h2" size="h5">
                      Tax Profile
                    </Heading>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <Label as="button" size="sm" className="text-destructive hover:underline transition-colors">
                        Required - Complete Now
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Recent Activity */}
              <div className="lg:col-span-1">
                <div className="bg-card rounded-lg border shadow-sm p-6">
                  <Heading as="h3" size="h5" className="mb-6">
                    Recent Activity
                  </Heading>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <div className="p-2 rounded-full bg-primary/10">
                        Edit
                      </div>
                      <div className="flex-1">
                        <Label as="div" size="sm">
                          Owner information updated
                        </Label>
                        <Body as="div" size="xs" tone="muted">
                          {formatDate(owner.updated_at)}
                        </Body>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <div className="p-2 rounded-full bg-success/10">
                        <Building2 className="h-4 w-4 text-success" />
                      </div>
                      <div className="flex-1">
                        <Label as="div" size="sm">
                          Property added
                        </Label>
                        <Body as="div" size="xs" tone="muted">
                          2 days ago
                        </Body>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                      <div className="p-2 rounded-full bg-warning/10">
                        <DollarSign className="h-4 w-4 text-warning" />
                      </div>
                      <div className="flex-1">
                        <Label as="div" size="sm">
                          Monthly statement generated
                        </Label>
                        <Body as="div" size="xs" tone="muted">
                          1 week ago
                        </Body>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Owner Modal */}
      <EditOwnerModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onUpdateOwner={handleEditOwner}
        ownerData={owner ? ownerToModalData(owner) : null}
        isUpdating={isUpdatingOwner}
      />
    </div>
  )
}
