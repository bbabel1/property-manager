'use client'

import { Building, Users } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import AddPropertyModal from '@/components/AddPropertyModal'

export default function PropertiesPage() {
  const [isAddPropertyModalOpen, setIsAddPropertyModalOpen] = useState(false)
  
  const properties = [
    {
      id: 1,
      name: 'Sunset Apartments',
      address: '123 Main Street',
      type: 'Apartment',
      units: { total: 24, occupied: 22, available: 2 },
      owners: 2,
      status: 'Active'
    },
    {
      id: 2,
      name: 'Oak Grove Townhomes',
      address: '456 Oak Avenue',
      type: 'Townhouse',
      units: { total: 12, occupied: 11, available: 1 },
      owners: 1,
      status: 'Active'
    },
    {
      id: 3,
      name: 'Pine Valley Condos',
      address: '789 Pine Street',
      type: 'Condo',
      units: { total: 36, occupied: 34, available: 2 },
      owners: 3,
      status: 'Inactive'
    },
    {
      id: 4,
      name: 'Riverside Manor',
      address: '321 River Road',
      type: 'Single Family',
      units: { total: 8, occupied: 7, available: 1 },
      owners: 1,
      status: 'Inactive'
    }
  ]

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
      
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Properties</h2>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search properties..."
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <select className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Status</option>
                <option>Active</option>
                <option>Inactive</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Types</option>
                <option>Apartment</option>
                <option>Townhouse</option>
                <option>Condo</option>
                <option>Single Family</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Property
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Units
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owners
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {properties.map((property) => (
                <tr key={property.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/properties/${property.id}`} className="hover:text-blue-600">
                      <div className="text-sm font-medium text-gray-900">
                        {property.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {property.address}
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {property.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{property.units.total}</div>
                    <div className="text-sm text-green-600">
                      {property.units.occupied}/{property.units.available}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-sm text-gray-900">
                        {property.owners}
                      </span>
                      {Array.from({ length: property.owners }, (_, i) => (
                        <Users key={i} className="ml-1 h-4 w-4 text-gray-400" />
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        property.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {property.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Showing {properties.length} of {properties.length} properties
            </p>
            <div className="text-sm text-gray-700">
              Total Units: {properties.reduce((sum, p) => sum + p.units.total, 0)} | 
              Occupied: {properties.reduce((sum, p) => sum + p.units.occupied, 0)} | 
              Available: {properties.reduce((sum, p) => sum + p.units.available, 0)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Add Property Modal */}
      <AddPropertyModal 
        isOpen={isAddPropertyModalOpen}
        onClose={() => setIsAddPropertyModalOpen(false)}
      />
    </div>
  )
}
