import { Plus, Building, TrendingUp, DollarSign, AlertTriangle, Users, Calendar, Wrench } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
          <Plus className="h-4 w-4 mr-2" />
          Add Property
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Properties</p>
              <p className="text-2xl font-bold text-gray-900">4</p>
              <p className="text-sm text-gray-500">80 total units</p>
            </div>
            <Building className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Occupancy Rate</p>
              <p className="text-2xl font-bold text-gray-900">93%</p>
              <p className="text-sm text-gray-500">74 occupied, 6 available</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Rent Roll</p>
              <p className="text-2xl font-bold text-gray-900">$17,000</p>
              <p className="text-sm text-gray-500">74 active leases</p>
            </div>
            <DollarSign className="h-8 w-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Open Work Orders</p>
              <p className="text-2xl font-bold text-gray-900">4</p>
              <p className="text-sm text-gray-500">Requires attention</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Transactions</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Rent Payment - Unit 101</p>
                <p className="text-xs text-gray-500">Sunset Apartments • 7/31/2024</p>
              </div>
              <span className="text-sm font-medium text-green-600">+$2,200</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Electric Bill - Oak Grove</p>
                <p className="text-xs text-gray-500">Oak Grove Townhomes • 8/4/2024</p>
              </div>
              <span className="text-sm font-medium text-red-600">-$180</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Rent Payment - Unit 102</p>
                <p className="text-xs text-gray-500">Sunset Apartments • 7/31/2024</p>
              </div>
              <span className="text-sm font-medium text-green-600">+$2,200</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Rent Payment - Unit A1</p>
                <p className="text-xs text-gray-500">Oak Grove Townhomes • 7/31/2024</p>
              </div>
              <span className="text-sm font-medium text-green-600">+$4,200</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Active Work Orders</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">AC unit not cooling properly</p>
                <p className="text-xs text-gray-500">urgent • 8/9/2024</p>
              </div>
              <button className="text-sm text-blue-600 hover:underline">open</button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Bathroom door handle loose</p>
                <p className="text-xs text-gray-500">low • 8/7/2024</p>
              </div>
              <button className="text-sm text-blue-600 hover:underline">open</button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Paint touch-up in master bedroom</p>
                <p className="text-xs text-gray-500">low • 8/6/2024</p>
              </div>
              <button className="text-sm text-blue-600 hover:underline">open</button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Building className="h-8 w-8 text-blue-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">View Properties</span>
          </button>
          <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Users className="h-8 w-8 text-green-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">Manage Tenants</span>
          </button>
          <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Calendar className="h-8 w-8 text-purple-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">Rent Tracking</span>
          </button>
          <button className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Wrench className="h-8 w-8 text-orange-600 mb-2" />
            <span className="text-sm font-medium text-gray-900">Maintenance</span>
          </button>
        </div>
      </div>
    </div>
  )
}
