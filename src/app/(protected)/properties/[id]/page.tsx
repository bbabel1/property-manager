'use client'

import { useState, useEffect, use } from 'react'
import { ArrowLeft, Building2, DollarSign, Home, FileText, Users, TrendingUp, Edit, Building, Bed, Bath } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PropertyService, type PropertyWithDetails } from '@/lib/property-service'

export default function PropertyDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [activeTab, setActiveTab] = useState("summary")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [property, setProperty] = useState<PropertyWithDetails | null>(null)

  useEffect(() => {
    if (resolvedParams.id) {
      fetchPropertyDetails()
    }
  }, [resolvedParams.id])

  const fetchPropertyDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const propertyData = await PropertyService.getPropertyById(resolvedParams.id)
      
      if (propertyData) {
        setProperty(propertyData)
      } else {
        setError('Property not found')
      }
    } catch (err: any) {
      console.error('Error fetching property details:', err)
      setError(err.message || 'Failed to load property details')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading property details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="text-destructive mb-4">
              <Building2 className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Error Loading Property</h3>
            <p className="text-muted-foreground mb-4">{error || 'Property not found'}</p>
            <Link href="/properties">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Properties
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Link href="/properties">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Properties
            </Button>
          </Link>
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${String(property.status).toLowerCase() === 'active' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
            {property.status || '—'}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-6 w-6" />
          {property.name || 'Property'}
        </h1>
        <p className="text-muted-foreground">
          {[ (property as any).property_type || '—', (property as any).management_scope || '—', (property as any).service_plan || '—' ].join(' | ')}
        </p>
      </div>

      {/* Metrics KPIs removed as requested */}

      {/* Navigation Tabs */}
      <div className="border-b border-border">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "summary"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            }`}
          >
            <Building2 className="h-4 w-4" />
            Summary
          </button>
          <button
            onClick={() => setActiveTab("financials")}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "financials"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            }`}
          >
            <DollarSign className="h-4 w-4" />
            Financials
          </button>
          <button
            onClick={() => setActiveTab("units")}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "units"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            }`}
          >
            <Home className="h-4 w-4" />
            Units
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "files"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            }`}
          >
            <FileText className="h-4 w-4" />
            Files
          </button>
          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "contacts"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            Contacts
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "tasks"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            }`}
          >
            <TrendingUp className="h-4 w-4 rotate-90" />
            Tasks
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Property Details (2/3 width) */}
          <Card className="lg:col-span-2">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle>Property Details</CardTitle>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-8 items-start">
                {/* Column 1: Property Image */}
                <div className="relative md:col-span-2">
                  <div className="w-full h-56 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                    <Building2 className="h-14 w-14 text-muted-foreground" />
                  </div>
                  <div className="pt-1.5">
                    <Button variant="link" size="sm" className="p-0 h-auto text-primary">
                      Replace photo
                    </Button>
                  </div>
                </div>

                {/* Column 2: Property Information */}
                <div className="space-y-5 md:col-span-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ADDRESS</label>
                    <div className="mt-1">
                      <p className="text-sm font-medium text-foreground leading-tight">{property.address_line1}</p>
                      {property.address_line2 ? (
                        <p className="text-sm font-medium text-foreground leading-tight">{property.address_line2}</p>
                      ) : null}
                      <p className="text-sm text-muted-foreground leading-tight">{property.city}, {property.state} {property.postal_code}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">PROPERTY MANAGER</label>
                    <p className="text-sm text-foreground mt-1 leading-tight">{property.property_manager_name || 'No manager assigned'}</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">PROPERTY TYPE</label>
                    <p className="text-sm text-foreground mt-1 leading-tight">{(property as any).property_type || 'None'}</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">RENTAL OWNERS</label>
                    <div className="mt-2 space-y-1.5">
                      {property.owners && property.owners.length > 0 ? (
                        <>
                          {/* Header row for Ownership/Disbursement labels */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground pb-1.5 border-b border-border">
                            <span className="sr-only md:not-sr-only">Name</span>
                            <div className="grid grid-cols-2 gap-8 min-w-[140px] text-right">
                              <span className="block">Ownership</span>
                              <span className="block">Disbursement</span>
                            </div>
                          </div>
                          {property.owners.map((o, idx) => {
                          const name = o.company_name || `${o.first_name ?? ''} ${o.last_name ?? ''}`.trim() || 'Unnamed Owner'
                          const ownPct = typeof (o as any).ownership_percentage === 'number' ? (o as any).ownership_percentage : undefined
                          const disbPct = typeof (o as any).disbursement_percentage === 'number' ? (o as any).disbursement_percentage : undefined
                          const isPrimary = Boolean((o as any).primary)
                          return (
                            <div key={idx} className="flex items-center justify-between py-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="text-sm text-foreground truncate leading-tight">{name}</p>
                                {isPrimary && (
                                  <Badge variant="secondary" className="text-xs">Primary</Badge>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-8 text-sm text-foreground whitespace-nowrap text-right min-w-[140px]">
                                <span className="font-medium">{ownPct != null ? `${ownPct}%` : '—'}</span>
                                <span className="font-medium">{disbPct != null ? `${disbPct}%` : '—'}</span>
                              </div>
                            </div>
                          )
                          })}
                          {/* Totals row */}
                          <div className="flex items-center justify-between pt-2 mt-1 border-t border-border">
                            <span className="text-sm font-medium text-foreground">Total</span>
                            <div className="grid grid-cols-2 gap-8 text-sm text-right min-w-[140px]">
                              <span className="font-bold">
                                {(() => {
                                  const t = property.owners.reduce((a, o) => a + ((o as any).ownership_percentage || 0), 0);
                                  return `${t}%`;
                                })()}
                              </span>
                              <span className="font-bold">
                                {(() => {
                                  const t = property.owners.reduce((a, o) => a + ((o as any).disbursement_percentage || 0), 0);
                                  return `${t}%`;
                                })()}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-foreground">No ownership information available</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right rail: Financials stacked */}
          <div className="space-y-6">
            {/* Cash Balance */}
            <Card>
              <CardHeader>
                <CardTitle>Cash balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">Cash balance:</span>
                  <span className="text-lg font-bold text-foreground">{formatCurrency(3061.80)}</span>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex justify-between">
                    <span>- Security deposits and early payments:</span>
                    <span>{formatCurrency(875.00)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>- Property reserve:</span>
                    <span>{formatCurrency(200.00)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-sm font-medium text-foreground">Available:</span>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(2576.80)}</span>
                </div>
                <Button variant="link" size="sm" className="p-0 h-auto text-primary mt-2">
                  View income statement
                </Button>
              </CardContent>
            </Card>

            {/* Banking details */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Banking details</CardTitle>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Operating Account</span>
                    <span className="text-sm text-muted-foreground">
                      {property.operating_account ? (
                        <Link className="text-primary hover:underline" href={`/bank-accounts/${property.operating_account.id}`}>
                          {`${property.operating_account.name}${property.operating_account.last4 ? ' ••••' + property.operating_account.last4 : ''}`}
                        </Link>
                      ) : (
                        'Setup'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Deposit Trust Account</span>
                    <span className="text-sm text-muted-foreground">
                      {property.deposit_trust_account ? (
                        <Link className="text-primary hover:underline" href={`/bank-accounts/${property.deposit_trust_account.id}`}>
                          {`${property.deposit_trust_account.name}${property.deposit_trust_account.last4 ? ' ••••' + property.deposit_trust_account.last4 : ''}`}
                        </Link>
                      ) : (
                        'Setup'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Property Reserve</span>
                    <span className="text-sm text-foreground">{formatCurrency(property.reserve || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Management Services */}
            <Card className="bg-primary/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Management Services</CardTitle>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assignment Level</div>
                    <div className="text-sm text-foreground mt-1">{(property as any).management_scope || '—'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Service Plan</div>
                    <div className="text-sm text-foreground mt-1">{(property as any).service_plan || '—'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Services</div>
                    <div className="text-sm text-foreground mt-1">{Array.isArray((property as any).active_services) && (property as any).active_services.length
                      ? (property as any).active_services.join(', ')
                      : '—'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Management Fee</div>
                    <div className="text-sm text-foreground mt-1">
                      {(() => {
                        const feeType = (property as any).fee_type as string | undefined
                        const pct = (property as any).fee_percentage as number | undefined
                        const mgmtFee = (property as any).management_fee as number | undefined
                        if (feeType === 'Percentage' && pct != null) return `${pct}% of Gross Rent`
                        if (feeType === 'Flat Rate' && mgmtFee != null) return formatCurrency(mgmtFee)
                        return '—'
                      })()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Location Card (hidden on Units tab) */}
      {activeTab !== "units" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Location</CardTitle>
              <Button variant="outline" size="sm">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Borough</label>
                <p className="text-sm text-foreground mt-1">{property.borough || '—'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Neighborhood</label>
                <p className="text-sm text-foreground mt-1">{property.neighborhood || '—'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Longitude</label>
                <p className="text-sm text-foreground mt-1">{property.longitude ?? '—'}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Latitude</label>
                <p className="text-sm text-foreground mt-1">{property.latitude ?? '—'}</p>
              </div>
            </div>
            <div className="mt-4">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location Verified</label>
              <p className={`text-sm mt-1 ${property.location_verified ? 'text-success' : 'text-muted-foreground'}`}>
                {property.location_verified ? 'Verified' : 'Not verified'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Tab Content Placeholders */}
      {activeTab === "financials" && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Financials content coming soon...</p>
          </CardContent>
        </Card>
      )}

      {activeTab === "units" && (
        <Card>
          <CardContent className="p-0">
            {(!property.units || property.units.length === 0) ? (
              <div className="text-center py-12">
                <Building className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No units found</h3>
                <p className="text-muted-foreground">Add units to this property to start managing rentals and leases.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Unit</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Layout</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Market Rent</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-card divide-y divide-border">
                    {property.units.map((unit: any) => (
                      <tr key={unit.id} className="hover:bg-muted/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">{unit.unit_number || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-foreground">{unit.address_line1 || '-'}</div>
                          <div className="text-sm text-muted-foreground">{[unit.city, unit.state].filter(Boolean).join(', ')}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-foreground">
                            <Bed className="h-4 w-4 mr-1" />
                            {unit.unit_bedrooms ?? '-'} bed
                            <Bath className="h-4 w-4 ml-2 mr-1" />
                            {unit.unit_bathrooms ?? '-'} bath
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{unit.unit_size ?? '-'} sq ft</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{unit.market_rent != null ? `$${Number(unit.market_rent).toLocaleString()}` : '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {unit.status ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${unit.status === 'Occupied' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>
                              {unit.status}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link href={`/units/${unit.id}`}>
                            <Button variant="outline" size="sm">View</Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "files" && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Files content coming soon...</p>
          </CardContent>
        </Card>
      )}

      {activeTab === "contacts" && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Contacts content coming soon...</p>
          </CardContent>
        </Card>
      )}

      {activeTab === "tasks" && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Tasks content coming soon...</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
