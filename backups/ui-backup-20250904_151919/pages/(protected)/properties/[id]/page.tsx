'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Building2, DollarSign, Home, FileText, Users, TrendingUp, MapPin, Edit, Building, UserCheck } from 'lucide-react'
import Link from 'next/link'
import { use } from 'react'
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/properties">
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Properties
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-6 w-6" />
              Property Details
            </h1>
            <p className="text-muted-foreground">
              {property.name} • {property.address_line1}, {property.city}, {property.state} {property.postal_code}
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Units</p>
                <p className="text-2xl font-bold text-foreground">24</p>
                <p className="text-sm text-muted-foreground">22 occupied • 2 available</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Owners</p>
                <p className="text-2xl font-bold text-foreground">2</p>
                <p className="text-sm text-muted-foreground">John Smith</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Property Type</p>
                <p className="text-2xl font-bold text-foreground">Apartment</p>
                <p className="text-sm text-muted-foreground">Property classification</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Occupancy Rate</p>
                <p className="text-2xl font-bold text-foreground">92%</p>
                <p className="text-sm text-muted-foreground">Current occupancy</p>
              </div>
              <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
            onClick={() => setActiveTab("vendors")}
            className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "vendors"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            }`}
          >
            <Users className="h-4 w-4" />
            Vendors
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "summary" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Property Details */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Property Details</CardTitle>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Property Image */}
              <div className="relative">
                <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
                  <Building2 className="h-16 w-16 text-muted-foreground" />
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="absolute bottom-4 left-1/2 transform -translate-x-1/2"
                >
                  Replace photo
                </Button>
              </div>

              {/* Property Information */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ADDRESS</label>
                  <div className="mt-1">
                    <p className="text-sm font-medium text-foreground">{property.address_line1}</p>
                    <p className="text-sm text-muted-foreground">{property.city}, {property.state} {property.postal_code}</p>
                    <Button variant="link" size="sm" className="p-0 h-auto text-primary">
                      <MapPin className="h-3 w-3 mr-1" />
                      Map it
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">PROPERTY MANAGER</label>
                  <p className="text-sm text-muted-foreground mt-1">No manager assigned</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">PROPERTY TYPE</label>
                  <p className="text-sm text-foreground mt-1">{property.rental_sub_type || 'Apartment'}</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">RENTAL OWNERS</label>
                  <p className="text-sm text-muted-foreground mt-1">No ownership information available</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Financials */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Financials</CardTitle>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Cash Balance */}
              <div>
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
              </div>

              {/* Banking Details */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-foreground">Banking details</h4>
                  <Button variant="outline" size="sm">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Operating Account</span>
                    <span className="text-sm text-muted-foreground">Trust account 4321</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Deposit Trust Account</span>
                    <Button variant="link" size="sm" className="p-0 h-auto text-primary">
                      Setup
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">Property Reserve</span>
                    <span className="text-sm text-foreground">{formatCurrency(200.00)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Location Card */}
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
              <p className="text-sm text-foreground mt-1">Manhattan</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Neighborhood</label>
              <p className="text-sm text-foreground mt-1">Downtown</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Longitude</label>
              <p className="text-sm text-foreground mt-1">-118.2437</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Latitude</label>
              <p className="text-sm text-foreground mt-1">34.0522</p>
            </div>
          </div>
          <div className="mt-4">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Location Verified</label>
            <p className="text-sm text-success mt-1">Verified</p>
          </div>
        </CardContent>
      </Card>

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
          <CardContent className="p-6">
            <p className="text-muted-foreground">Units content coming soon...</p>
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

      {activeTab === "vendors" && (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Vendors content coming soon...</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}