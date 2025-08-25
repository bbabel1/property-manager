'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, Building2, DollarSign, Home, FileText, Users, TrendingUp, TrendingDown, BarChart3, Folder, Upload, File, Star, Wrench, Calendar, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'
import { use } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PropertySummary, PropertyFinancials, PropertyUnits, PropertyFiles, PropertyVendors } from '@/components/property'
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
      
      console.log('🔍 Property details page - fetching property with ID:', resolvedParams.id)
      
      // Force refresh by adding a timestamp to avoid caching
      const propertyData = await PropertyService.getPropertyById(resolvedParams.id)
      
      if (propertyData) {
        console.log('✅ Property details page - received property data:', {
          id: propertyData.id,
          name: propertyData.name,
          address: propertyData.address_line1
        })
        setProperty(propertyData)
      } else {
        console.log('❌ Property details page - no property data returned')
        // This should never happen now since we return null
        setError('Property not found')
      }
    } catch (err: any) {
      console.error('❌ Property details page - Error fetching property details:', err)
      console.log('🔄 Property details page - Error occurred, setting error state')
      setError('Failed to load property details')
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    console.log('🔄 Retrying property fetch...')
    fetchPropertyDetails()
  }

  // Render KPIs based on active tab
  const renderKPIs = () => {
    if (!property) return null

    switch (activeTab) {
      case 'summary':
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4 text-primary" />
                <span>Units</span>
              </div>
              <p className="text-2xl">{property.units_summary.total}</p>
              <p className="text-xs text-muted-foreground">
                {property.units_summary.occupied} occupied • {property.units_summary.available} available
              </p>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Owners</span>
              </div>
              <p className="text-2xl">{property.total_owners}</p>
              <p className="text-xs text-muted-foreground">
                Primary: {'Determined from ownerships table'}
              </p>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span>Type</span>
              </div>
              <p className="text-2xl">{property.rental_sub_type}</p>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span>Occupancy</span>
              </div>
              <p className="text-2xl">
                {property.occupancy_rate}%
              </p>
            </div>
          </div>
        )

      case 'financials':
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                <span>Monthly Revenue</span>
              </div>
              <p className="text-2xl">$45,000</p>
              <div className="flex items-center text-xs text-green-600 mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                +5.2%
              </div>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-red-600" />
                <span>Monthly Expenses</span>
              </div>
              <p className="text-2xl">$32,000</p>
              <div className="flex items-center text-xs text-red-600 mt-1">
                <TrendingDown className="w-3 h-3 mr-1" />
                +2.1%
              </div>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span>Net Income</span>
              </div>
              <p className="text-2xl">$13,000</p>
              <div className="flex items-center text-xs text-green-600 mt-1">
                <TrendingUp className="w-3 h-3 mr-1" />
                +12.8% YoY
              </div>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <span>Average Rent</span>
              </div>
              <p className="text-2xl">$1,875</p>
              <p className="text-xs text-muted-foreground mt-1">
                per unit
              </p>
            </div>
          </div>
        )

      case 'units':
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4 text-primary" />
                <span>Total Units</span>
              </div>
              <p className="text-2xl">{property.units_summary.total}</p>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-green-600" />
                <span>Occupied</span>
              </div>
              <p className="text-2xl">{property.units_summary.occupied}</p>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Home className="w-4 h-4 text-blue-600" />
                <span>Available</span>
              </div>
              <p className="text-2xl">{property.units_summary.available}</p>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span>Avg Rent</span>
              </div>
              <p className="text-2xl">$1,875</p>
            </div>
          </div>
        )

      case 'files':
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-primary" />
                <span>Total Files</span>
              </div>
              <p className="text-2xl">6</p>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Folder className="w-4 h-4 text-blue-600" />
                <span>Categories</span>
              </div>
              <p className="text-2xl">6</p>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Upload className="w-4 h-4 text-green-600" />
                <span>This Month</span>
              </div>
              <p className="text-2xl">3</p>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <File className="w-4 h-4 text-primary" />
                <span>Total Size</span>
              </div>
              <p className="text-2xl">13.4 MB</p>
            </div>
          </div>
        )

      case 'vendors':
        return (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-primary" />
                <span>Total Vendors</span>
              </div>
              <p className="text-2xl">5</p>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-yellow-600" />
                <span>Avg Rating</span>
              </div>
              <p className="text-2xl">4.7</p>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Wrench className="w-4 h-4 text-green-600" />
                <span>Categories</span>
              </div>
              <p className="text-2xl">5</p>
            </div>

            <div className="bg-card p-4 rounded-lg border">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span>This Month</span>
              </div>
              <p className="text-2xl">3</p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" asChild>
            <Link href="/properties">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Properties
            </Link>
          </Button>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading property details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" asChild>
            <Link href="/properties">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Properties
            </Link>
          </Button>
        </div>
        <div className="text-center py-12">
          <h2 className="mb-4">Failed to Load Property</h2>
          <p className="text-destructive mb-4">{error || 'Property not found'}</p>
          <div className="space-y-2">
            <Button onClick={handleRetry} variant="outline">
              Try Again
            </Button>
            <div className="text-sm text-muted-foreground">
              <p>Property ID: {resolvedParams.id}</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">

      
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" asChild>
          <Link href="/properties">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Properties
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Property Details
          </h1>
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground">{property.name} • {property.address_line1}, {property.city}, {property.state} {property.postal_code}</p>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                property.status === 'Active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {property.status}
              </span>
              {property.status === 'Active' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic KPIs based on active tab */}
      {renderKPIs()}



      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="financials" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Financials
          </TabsTrigger>
          <TabsTrigger value="units" className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            Units
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Files
          </TabsTrigger>
          <TabsTrigger value="vendors" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Vendors
          </TabsTrigger>
        </TabsList>



        <TabsContent value="summary">
          <PropertySummary 
            property={property} 
            onPropertyUpdate={fetchPropertyDetails}
          />
        </TabsContent>

        <TabsContent value="financials">
          <PropertyFinancials propertyId={resolvedParams.id} />
        </TabsContent>

        <TabsContent value="units">
          <PropertyUnits 
            propertyId={resolvedParams.id} 
            property={property}
            onUnitsChange={fetchPropertyDetails}
          />
        </TabsContent>

        <TabsContent value="files">
          <PropertyFiles propertyId={resolvedParams.id} />
        </TabsContent>

        <TabsContent value="vendors">
          <PropertyVendors propertyId={resolvedParams.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
