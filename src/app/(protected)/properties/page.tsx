'use client'

import { Building, Users } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import AddPropertyModal from '@/components/AddPropertyModal'

interface Property {
  id: string
  name: string
  addressLine1: string
  rentalSubType: string
  status: string
  createdAt: string
  updatedAt: string
}

export default function PropertiesPage() {
  const [isAddPropertyModalOpen, setIsAddPropertyModalOpen] = useState(false)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [typeFilter, setTypeFilter] = useState('All Types')
  
  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/properties')
      if (!response.ok) {
        throw new Error('Failed to fetch properties')
      }
      
      const data = await response.json()
      setProperties(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load properties')
    } finally {
      setLoading(false)
    }
  }

  const filteredProperties = properties.filter(property => {
    const matchesSearch = property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         property.addressLine1.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'All Status' || property.status === statusFilter
    const matchesType = typeFilter === 'All Types' || property.rentalSubType === typeFilter
    
    return matchesSearch && matchesStatus && matchesType
  })

  const handlePropertyCreated = () => {
    fetchProperties() // Refresh the list
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
          <div className="w-32 h-10 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
        
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Properties</h2>
              <div className="flex items-center space-x-4">
                <div className="w-64 h-10 bg-gray-200 rounded-md animate-pulse"></div>
                <div className="w-32 h-10 bg-gray-200 rounded-md animate-pulse"></div>
                <div className="w-32 h-10 bg-gray-200 rounded-md animate-pulse"></div>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse"></div>
              ))}
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
          <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
          <button 
            onClick={() => setIsAddPropertyModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          >
            <Building className="h-4 w-4 mr-2" />
            Add Property
          </button>
        </div>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading properties</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button 
                onClick={fetchProperties}
                className="mt-2 text-sm text-red-800 hover:text-red-900 underline"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Properties</h1>
        <button 
          onClick={() => setIsAddPropertyModalOpen(true)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:opacity-90 transition-colors flex items-center"
        >
          <Building className="h-4 w-4 mr-2" />
          Add Property
        </button>
      </div>
      
      <div className="bg-card rounded-lg shadow-sm border border-border">
        <div className="px-8 py-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-card-foreground">Properties</h2>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search properties..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-input"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-input"
              >
                <option>All Status</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-input"
              >
                <option>All Types</option>
                <option>CondoTownhome</option>
                <option>MultiFamily</option>
                <option>SingleFamily</option>
                <option>Industrial</option>
                <option>Office</option>
                <option>Retail</option>
                <option>ShoppingCenter</option>
                <option>Storage</option>
                <option>ParkingSpace</option>
              </select>
            </div>
          </div>
        </div>
        
        {filteredProperties.length === 0 ? (
          <div className="p-16 text-center">
            <Building className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium text-foreground">No properties found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {properties.length === 0 
                ? "Get started by creating your first property."
                : "Try adjusting your search or filter criteria."
              }
            </p>
            {properties.length === 0 && (
              <div className="mt-6">
                <button
                  onClick={() => setIsAddPropertyModalOpen(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-primary-foreground bg-primary hover:opacity-90"
                >
                  <Building className="h-4 w-4 mr-2" />
                  Add Property
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-8 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Property
                    </th>
                    <th className="px-8 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-8 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-8 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-card divide-y divide-border">
                  {filteredProperties.map((property) => (
                    <tr key={property.id} className="hover:bg-muted/50">
                      <td className="px-8 py-6 whitespace-nowrap">
                        <Link href={`/properties/${property.id}`} className="hover:text-primary">
                          <div className="text-sm font-medium text-foreground">
                            {property.name}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {property.addressLine1}
                          </div>
                        </Link>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          {property.rentalSubType}
                        </span>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            property.status === 'Active'
                              ? 'bg-success/10 text-success border border-success/20'
                              : 'bg-error/10 text-error border border-error/20'
                          }`}
                        >
                          {property.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(property.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="px-8 py-6 border-t border-border">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {filteredProperties.length} of {properties.length} properties
                </p>
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Add Property Modal */}
      <AddPropertyModal 
        isOpen={isAddPropertyModalOpen}
        onClose={() => setIsAddPropertyModalOpen(false)}
        onSuccess={handlePropertyCreated}
      />
    </div>
  )
}
