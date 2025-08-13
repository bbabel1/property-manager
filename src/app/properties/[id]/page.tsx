'use client'

import { ArrowLeft, FileText, DollarSign, Home, Users, MapPin, Camera, Edit, HelpCircle } from 'lucide-react'
import Link from 'next/link'

export default function PropertyDetailsPage({ params }: { params: { id: string } }) {
  // Mock data - in a real app, this would come from your Prisma/Supabase database
  const property = {
    id: params.id,
    name: 'Sunset Apartments',
    address: '123 Main Street',
    city: 'Los Angeles',
    state: 'CA',
    postalCode: '90210',
    type: 'Apartment',
    units: { total: 24, occupied: 22, available: 2 },
    owners: 2,
    primaryOwner: 'John Smith',
    occupancy: 92,
    borough: 'Manhattan',
    neighborhood: 'Downtown',
    longitude: '-118.2437',
    latitude: '34.0522',
    locationVerified: true,
    cashBalance: 3061.80,
    securityDeposits: 875.00,
    propertyReserve: 200.00,
    available: 2576.80,
    operatingAccount: 'Trust account 4321'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center space-x-4">
          <Link href="/properties" className="flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Properties
          </Link>
        </div>
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <FileText className="h-6 w-6 mr-2" />
            Property Details
          </h1>
          <p className="text-gray-600 mt-1">
            {property.name} • {property.address}, {property.city}, {property.state} {property.postalCode}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {/* Units Card */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Units</p>
                <p className="text-3xl font-bold text-gray-900">{property.units.total}</p>
                <p className="text-sm text-gray-500">{property.units.occupied} occupied • {property.units.available} available</p>
              </div>
              <Home className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          {/* Owners Card */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Owners</p>
                <p className="text-3xl font-bold text-gray-900">{property.owners}</p>
                <p className="text-sm text-gray-500">Primary: {property.primaryOwner}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          {/* Type Card */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Type</p>
                <p className="text-3xl font-bold text-gray-900">{property.type}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          {/* Occupancy Card */}
          <div className="bg-white rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Occupancy</p>
                <p className="text-3xl font-bold text-gray-900">{property.occupancy}%</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-gray-100 rounded-lg p-1 mb-6">
          <div className="flex space-x-1">
            <button className="flex items-center px-4 py-2 bg-white rounded-md shadow-sm border-b-2 border-blue-600">
              <FileText className="h-4 w-4 mr-2" />
              Summary
            </button>
            <button className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900">
              <DollarSign className="h-4 w-4 mr-2" />
              Financials
            </button>
            <button className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900">
              <Home className="h-4 w-4 mr-2" />
              Units
            </button>
            <button className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900">
              <FileText className="h-4 w-4 mr-2" />
              Files
            </button>
            <button className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900">
              <Users className="h-4 w-4 mr-2" />
              Vendors
            </button>
          </div>
        </div>

        {/* Main Content - Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Property Details */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Property Details</h2>
                  <button className="text-blue-600 hover:text-blue-700 flex items-center">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-6">
                {/* Property Image */}
                <div className="relative">
                  <div className="w-full h-48 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-2">
                        <Home className="h-8 w-8 text-blue-600" />
                      </div>
                      <p className="text-sm text-gray-600">Property Image</p>
                    </div>
                  </div>
                  <button className="absolute bottom-4 left-4 bg-white px-3 py-1 rounded-md text-sm flex items-center shadow-sm">
                    <Camera className="h-4 w-4 mr-1" />
                    Replace photo
                  </button>
                </div>

                {/* Address */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">ADDRESS</p>
                  <p className="text-gray-900 mb-2">
                    {property.address}<br />
                    {property.city}, {property.state} {property.postalCode}
                  </p>
                  <button className="text-blue-600 hover:text-blue-700 text-sm flex items-center">
                    <MapPin className="h-4 w-4 mr-1" />
                    Map it
                  </button>
                </div>

                {/* Property Manager */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">PROPERTY MANAGER</p>
                  <p className="text-gray-900">No manager assigned</p>
                </div>

                {/* Property Type */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">PROPERTY TYPE</p>
                  <p className="text-gray-900 font-semibold">{property.type}</p>
                </div>

                {/* Rental Owners */}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">RENTAL OWNERS</p>
                  <p className="text-gray-900">No ownership information available</p>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Location</h2>
                  <button className="text-blue-600 hover:text-blue-700 flex items-center">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">BOROUGH</p>
                  <p className="text-gray-900 font-semibold">{property.borough}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">NEIGHBORHOOD</p>
                  <p className="text-gray-900 font-semibold">{property.neighborhood}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">LONGITUDE</p>
                  <p className="text-gray-900 font-semibold">{property.longitude}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">LATITUDE</p>
                  <p className="text-gray-900 font-semibold">{property.latitude}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">LOCATION VERIFIED</p>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Verified
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Financial Summary */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Cash balance:</span>
                  <span className="font-semibold">${property.cashBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pl-4">
                  <span className="text-gray-600">Security deposits and early payments:</span>
                  <span className="font-semibold">${property.securityDeposits.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pl-4">
                  <span className="text-gray-600">Property reserve:</span>
                  <span className="font-semibold">${property.propertyReserve.toFixed(2)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-900 font-semibold">Available:</span>
                    <span className="text-xl font-bold text-gray-900">${property.available.toFixed(2)}</span>
                  </div>
                </div>
                <button className="text-blue-600 hover:text-blue-700 text-sm">
                  View income statement
                </button>
              </div>
            </div>

            {/* Banking Details */}
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Banking details</h2>
                  <button className="text-blue-600 hover:text-blue-700 flex items-center">
                    <Edit className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">OPERATING ACCOUNT</p>
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 mr-2 text-gray-400" />
                    <span className="text-gray-900">{property.operatingAccount}</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">DEPOSIT TRUST ACCOUNT</p>
                  <button className="text-blue-600 hover:text-blue-700 text-sm">Setup</button>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">PROPERTY RESERVE</p>
                  <span className="text-gray-900 font-semibold">${property.propertyReserve.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help Button */}
      <div className="fixed bottom-6 right-6">
        <button className="w-12 h-12 bg-gray-900 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-gray-800 transition-colors">
          <HelpCircle className="h-6 w-6" />
        </button>
      </div>
    </div>
  )
}
