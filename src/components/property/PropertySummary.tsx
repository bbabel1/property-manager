'use client'

import { useState, useEffect } from 'react'
import { Building2, MapPin, Camera, CheckCircle, XCircle, Home, Users, DollarSign, Banknote } from 'lucide-react'
import EditLink from '@/components/ui/EditLink'
import { Button } from '../ui/button'
import type { BankAccountSummary } from '@/components/forms/types'

import { type PropertyWithDetails } from '@/lib/property-service'
import PropertyNotes from '@/property/PropertyNotes'
import EditPropertyModal from '../EditPropertyModal'
import BankingDetailsModal from '../BankingDetailsModal'

interface PropertySummaryProps {
  property: PropertyWithDetails
  onPropertyUpdate?: () => void
}

export function PropertySummary({ property, onPropertyUpdate }: PropertySummaryProps) {
  const [showEditModal, setShowEditModal] = useState(false)
  const [showBankingModal, setShowBankingModal] = useState(false)
  const [bankAccounts, setBankAccounts] = useState<BankAccountSummary[]>([])
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
        
        const bankAccountsData = (await response.json()) as BankAccountSummary[]
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
          <div className="bg-card rounded-lg border border-border">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Property Details</h2>
                <EditLink onClick={() => setShowEditModal(true)} />
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                {/* Column 1: Property Image */}
                <div className="md:col-span-2 space-y-4">
                  <div className="relative">
                    <div className="w-full h-64 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center overflow-hidden">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
                          <Home className="h-10 w-10 text-blue-600" />
                        </div>
                        <p className="text-sm text-muted-foreground">Property Image</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="absolute bottom-4 left-4 bg-card border-border text-primary hover:bg-muted"
                    >
                      <Camera className="h-4 w-4 mr-1" />
                      Replace photo
                    </Button>
                  </div>
                </div>

                {/* Column 2: Property Details */}
                <div className="md:col-span-3 space-y-6">
                  {/* Address */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">ADDRESS</p>
                    <p className="text-foreground mb-3 text-lg">
                      {property.address_line1}<br />
                      {property.city}, {property.state} {property.postal_code}
                    </p>
                    <Button variant="ghost" size="sm" className="p-0 h-auto text-primary hover:text-primary">
                      <MapPin className="h-4 w-4 mr-1" />
                      Map it
                    </Button>
                  </div>

                  {/* Property Manager */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                      PROPERTY MANAGER
                    </p>
                    <p className="text-foreground">No manager assigned</p>
                  </div>

                  {/* Property Type */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">PROPERTY TYPE</p>
                    <p className="text-foreground font-semibold">{(property as any).property_type || 'None'}</p>
                  </div>

                  {/* Status */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">STATUS</p>
                    <p className={`font-semibold ${property.status === 'Active' ? 'text-emerald-600' : 'text-red-600'}`}>{property.status || 'Unknown'}</p>
                  </div>

                  {/* Rental Owners */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">RENTAL OWNERS</p>
                    {property.owners && property.owners.length > 0 ? (
                      <div className="space-y-2">
                        {property.owners.map((owner, index) => (
                          <div key={owner.id} className="border-l-2 border-blue-500 pl-3">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-foreground">
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

          {/* Location Card */}
          <div className="bg-card rounded-lg border border-border">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Location</h2>
                <EditLink />
              </div>
            </div>
            <div className="p-6">
              <div className="text-center text-muted-foreground py-8">
                <MapPin className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                <p>Location information will appear here</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Financial Summary */}
          <div className="bg-card rounded-lg border border-border p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-foreground">Cash balance:</span>
                <span className="font-semibold text-foreground">$3,061.80</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span className="pl-4">- Security deposits and early payments:</span>
                <span>$875.00</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span className="pl-4">- Property reserve:</span>
                <span>${property.reserve?.toFixed(2) || '200.00'}</span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-foreground">Available:</span>
                  <span className="text-xl font-bold text-foreground">$2,576.80</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="p-0 h-auto text-primary hover:text-primary">
                View income statement
              </Button>
            </div>
          </div>

          {/* Banking Details */}
          <div className="bg-card rounded-lg border border-border">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Banking details</h2>
                <EditLink onClick={() => setShowBankingModal(true)} />
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">OPERATING ACCOUNT</p>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center mr-3">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {isLoadingBankAccounts ? (
                    <span className="text-muted-foreground">Loading...</span>
                  ) : getOperatingBankAccount() ? (
                    <div>
                      <div className="font-medium text-foreground">{getOperatingBankAccount()?.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {getOperatingBankAccount()?.account_number ? 
                          `****${getOperatingBankAccount()?.account_number?.slice(-4) || ''}` : 
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
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  DEPOSIT TRUST ACCOUNT
                </p>
                <div className="flex items-center">
                    <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center mr-3">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {isLoadingBankAccounts ? (
                    <span className="text-muted-foreground">Loading...</span>
                  ) : getDepositTrustBankAccount() ? (
                    <div>
                      <div className="font-medium text-foreground">{getDepositTrustBankAccount()?.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {getDepositTrustBankAccount()?.account_number ? 
                          `****${getDepositTrustBankAccount()?.account_number?.slice(-4) || ''}` : 
                          'No account number'
                        }
                      </div>
                    </div>
                  ) : (
                    <Button variant="ghost" size="sm" className="p-0 h-auto text-primary hover:text-primary">
                      Setup
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">PROPERTY RESERVE</p>
                <span className="font-semibold text-foreground">${property.reserve?.toFixed(2) || '200.00'}</span>
              </div>
            </div>
          </div>
          {/* Notes */}
          <PropertyNotes propertyId={property.id} />
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
