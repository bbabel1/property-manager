'use client'

import { useState, useEffect } from 'react'
import { Building2, MapPin, Camera, Edit, CheckCircle, XCircle, Home, Users, DollarSign } from 'lucide-react'
import { Button } from '../ui/button'

import { type PropertyWithDetails } from '@/lib/property-service'
import EditPropertyModal from '../EditPropertyModal'
import BankingDetailsModal from '../BankingDetailsModal'

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

interface PropertySummaryProps {
  property: PropertyWithDetails
  onPropertyUpdate?: () => void
}

export function PropertySummary({ property, onPropertyUpdate }: PropertySummaryProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [showBankingModal, setShowBankingModal] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([])
  const [isLoadingBankAccounts, setIsLoadingBankAccounts] = useState(false)

  const handleEditSuccess = () => {
    console.log('Property updated successfully')
    // Call the callback to refresh the property data
    if (onPropertyUpdate) {
      onPropertyUpdate()
    }
  }

  const handleBankingEditSuccess = () => {
    console.log('Banking details updated successfully')
    // Call the callback to refresh the property data
    if (onPropertyUpdate) {
      onPropertyUpdate()
    }
  }

  // Fetch bank accounts when component mounts
  useEffect(() => {
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
      } finally {
        setIsLoadingBankAccounts(false)
      }
    }

    fetchBankAccounts()
  }, [])

  // Helper functions to get bank account information
  const getOperatingBankAccount = () => {
    if (!property.operating_bank_account_id) return null
    return bankAccounts.find(account => account.id === property.operating_bank_account_id)
  }

  const getDepositTrustBankAccount = () => {
    if (!property.deposit_trust_account_id) return null
    return bankAccounts.find(account => account.id === property.deposit_trust_account_id)
  }

  return (
    <div className="space-y-6">
      {/* Main Content - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Property Details */}
          <div className="bg-card rounded-lg border">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Property Details</h2>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowEditModal(true)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {/* Column 1: Property Image */}
                <div className="md:col-span-2 space-y-4">
                  <div className="relative">
                    <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2">
                          <Home className="h-8 w-8 text-primary" />
                        </div>
                        <p className="text-sm text-muted-foreground">Property Image</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="absolute bottom-4 left-4 bg-background"
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Replace photo
                    </Button>
                  </div>
                </div>

                {/* Column 2: Property Details */}
                <div className="md:col-span-3 space-y-4">
                  {/* Address */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">ADDRESS</p>
                    <p className="mb-2">
                      {property.address_line1}<br />
                      {property.city}, {property.state} {property.postal_code}
                    </p>
                    <Button variant="ghost" size="sm" className="p-0 h-auto">
                      <MapPin className="h-4 w-4 mr-1" />
                      Map it
                    </Button>
                  </div>

                  {/* Property Manager */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                      PROPERTY MANAGER
                    </p>
                    <p>No manager assigned</p>
                  </div>

                  {/* Property Type */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">PROPERTY TYPE</p>
                    <p className="font-semibold">{property.rental_sub_type}</p>
                  </div>



                  {/* Rental Owners */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">RENTAL OWNERS</p>
                    {property.owners && property.owners.length > 0 ? (
                      <div className="space-y-2">
                        {property.owners.map((owner, index) => (
                          <div key={owner.id} className="border-l-2 border-primary pl-3">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">
                                {owner.is_company ? owner.company_name : `${owner.first_name} ${owner.last_name}`}
                                {owner.primary && (
                                  <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                    Primary
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              <span className="mr-4">Ownership: {owner.ownership_percentage || 0}%</span>
                              <span>Disbursement: {owner.disbursement_percentage || 0}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No ownership information available</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>


        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <div className="bg-card rounded-lg border p-6">
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Property reserve:</span>
                <span className="font-semibold">${property.reserve?.toFixed(2) || '0.00'}</span>
              </div>
              <div className="flex justify-between pl-4">
                <span className="text-muted-foreground">
                  Year built:
                </span>
                <span className="font-semibold">{property.year_built || 'N/A'}</span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold">Total units:</span>
                  <span className="text-xl font-bold">{property.units_summary.total}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="p-0 h-auto">
                View income statement
              </Button>
            </div>
          </div>

          {/* Banking Details */}
          <div className="bg-card rounded-lg border">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Banking details</h2>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowBankingModal(true)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">OPERATING ACCOUNT</p>
                <div className="flex items-center">
                  <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  {isLoadingBankAccounts ? (
                    <span className="text-muted-foreground">Loading...</span>
                  ) : getOperatingBankAccount() ? (
                    <div>
                      <div className="font-medium">{getOperatingBankAccount()?.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {getOperatingBankAccount()?.account_number ? 
                          `****${getOperatingBankAccount()?.account_number.slice(-4)}` : 
                          'No account number'
                        }
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Not configured</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  DEPOSIT TRUST ACCOUNT
                </p>
                <div className="flex items-center">
                  <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  {isLoadingBankAccounts ? (
                    <span className="text-muted-foreground">Loading...</span>
                  ) : getDepositTrustBankAccount() ? (
                    <div>
                      <div className="font-medium">{getDepositTrustBankAccount()?.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {getDepositTrustBankAccount()?.account_number ? 
                          `****${getDepositTrustBankAccount()?.account_number.slice(-4)}` : 
                          'No account number'
                        }
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Not configured</span>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">PROPERTY RESERVE</p>
                <span className="font-semibold">${property.reserve?.toFixed(2) || '0.00'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Property Modal */}
      <EditPropertyModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSuccess={handleEditSuccess}
        property={property}
      />

      {/* Banking Details Modal */}
      <BankingDetailsModal
        isOpen={showBankingModal}
        onClose={() => setShowBankingModal(false)}
        onSuccess={handleBankingEditSuccess}
        property={property}
      />
    </div>
  )
}
