import { Bed, Bath, Calendar, User } from 'lucide-react'

export default function UnitsPage() {
  const units = [
    {
      id: 1,
      unitNumber: '101',
      property: 'Sunset Apartments',
      address: '123 Main Street',
      layout: { beds: 1, baths: 1 },
      sqft: 650,
      marketRent: 2200,
      status: 'Occupied',
      tenant: 'Emily Davis',
      leaseEnd: '2024-12-30'
    },
    {
      id: 2,
      unitNumber: '102',
      property: 'Sunset Apartments',
      address: '123 Main Street',
      layout: { beds: 1, baths: 1 },
      sqft: 650,
      marketRent: 2200,
      status: 'Occupied',
      tenant: 'James Miller',
      leaseEnd: '2024-11-15'
    },
    {
      id: 3,
      unitNumber: '201',
      property: 'Sunset Apartments',
      address: '123 Main Street',
      layout: { beds: 2, baths: 2 },
      sqft: 900,
      marketRent: 2800,
      status: 'Vacant',
      tenant: null,
      leaseEnd: null
    },
    {
      id: 4,
      unitNumber: '202',
      property: 'Sunset Apartments',
      address: '123 Main Street',
      layout: { beds: 2, baths: 2 },
      sqft: 900,
      marketRent: 2800,
      status: 'Vacant',
      tenant: null,
      leaseEnd: null
    },
    {
      id: 5,
      unitNumber: 'A1',
      property: 'Oak Grove Townhomes',
      address: '456 Oak Avenue',
      layout: { beds: 3, baths: 2.5 },
      sqft: 1200,
      marketRent: 4200,
      status: 'Occupied',
      tenant: 'Ashley Taylor',
      leaseEnd: '2024-12-31'
    },
    {
      id: 6,
      unitNumber: 'A2',
      property: 'Oak Grove Townhomes',
      address: '456 Oak Avenue',
      layout: { beds: 3, baths: 2.5 },
      sqft: 1200,
      marketRent: 4200,
      status: 'Vacant',
      tenant: null,
      leaseEnd: null
    },
    {
      id: 7,
      unitNumber: 'B1',
      property: 'Oak Grove Townhomes',
      address: '456 Oak Avenue',
      layout: { beds: 2, baths: 2 },
      sqft: 1000,
      marketRent: 3800,
      status: 'Vacant',
      tenant: null,
      leaseEnd: null
    },
    {
      id: 8,
      unitNumber: '301',
      property: 'Pine Valley Condos',
      address: '789 Pine Street',
      layout: { beds: 2, baths: 2 },
      sqft: 1100,
      marketRent: 3200,
      status: 'Occupied',
      tenant: 'Robert Anderson',
      leaseEnd: '2024-10-31'
    },
    {
      id: 9,
      unitNumber: '302',
      property: 'Pine Valley Condos',
      address: '789 Pine Street',
      layout: { beds: 2, baths: 2 },
      sqft: 1100,
      marketRent: 3200,
      status: 'Vacant',
      tenant: null,
      leaseEnd: null
    }
  ]

  const stats = {
    totalUnits: units.length,
    occupiedUnits: units.filter(u => u.status === 'Occupied').length,
    vacantUnits: units.filter(u => u.status === 'Vacant').length,
    occupancyRate: Math.round((units.filter(u => u.status === 'Occupied').length / units.length) * 100)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Units</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
          <User className="h-4 w-4 mr-2" />
          Add Unit
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Units</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUnits}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Occupied</p>
              <p className="text-2xl font-bold text-green-600">{stats.occupiedUnits}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Vacant</p>
              <p className="text-2xl font-bold text-orange-600">{stats.vacantUnits}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Occupancy Rate</p>
              <p className="text-2xl font-bold text-gray-900">{stats.occupancyRate}%</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Units</h2>
            <div className="flex items-center space-x-4">
              <input
                type="text"
                placeholder="Search units or properties..."
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Properties</option>
                <option>Sunset Apartments</option>
                <option>Oak Grove Townhomes</option>
                <option>Pine Valley Condos</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Status</option>
                <option>Occupied</option>
                <option>Vacant</option>
              </select>
              <select className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option>All Bedrooms</option>
                <option>1 Bedroom</option>
                <option>2 Bedrooms</option>
                <option>3 Bedrooms</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Property
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Layout
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Market Rent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tenant
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {units.map((unit) => (
                <tr key={unit.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {unit.unitNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {unit.property}
                    </div>
                    <div className="text-sm text-gray-500">
                      {unit.address}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Bed className="h-4 w-4 mr-1" />
                      {unit.layout.beds} bed
                      <Bath className="h-4 w-4 ml-2 mr-1" />
                      {unit.layout.baths} bath
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {unit.sqft.toLocaleString()} sq ft
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      ${unit.marketRent.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        unit.status === 'Occupied'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {unit.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {unit.tenant ? (
                      <div className="flex items-center text-sm text-gray-900">
                        <User className="h-4 w-4 mr-1" />
                        {unit.tenant}
                        {unit.leaseEnd && (
                          <>
                            <span className="mx-2">Until</span>
                            <Calendar className="h-4 w-4 mr-1" />
                            {new Date(unit.leaseEnd).toLocaleDateString()}
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
