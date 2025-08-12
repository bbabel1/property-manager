import { Plus, Building, TrendingUp, DollarSign, AlertTriangle, Users, Calendar, Wrench, FileText, UserCheck, Clock, CheckCircle } from 'lucide-react'

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
              <p className="text-sm text-gray-500">From 74 active leases</p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
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
          <div className="flex items-center mb-4">
            <FileText className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Lease Renewals</h3>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">0</p>
              <p className="text-sm text-gray-600">Critical (≤30 days)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">0</p>
              <p className="text-sm text-gray-600">Upcoming (30-60 days)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">0</p>
              <p className="text-sm text-gray-600">Future (60-90 days)</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <UserCheck className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Property Onboarding</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">2</p>
              <p className="text-sm text-gray-600">In Progress</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-600">1</p>
              <p className="text-sm text-gray-600">Pending Approval</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">3</p>
              <p className="text-sm text-gray-600">Overdue</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Maple Heights Complex</p>
                <p className="text-xs text-gray-500">Documentation • Sarah Johnson</p>
              </div>
              <div className="flex items-center">
                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '60%' }}></div>
                </div>
                <span className="text-xs text-gray-600">60%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Riverside Apartments</p>
                <p className="text-xs text-gray-500">Inspection • Michael Brown</p>
              </div>
              <div className="flex items-center">
                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '30%' }}></div>
                </div>
                <span className="text-xs text-gray-600">30%</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Downtown Lofts</p>
                <p className="text-xs text-gray-500">Legal Review • Lisa Wilson</p>
              </div>
              <div className="flex items-center">
                <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                </div>
                <span className="text-xs text-gray-600">85%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Recent Transactions</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Electric Bill - Oak Grove Townhomes</p>
                <p className="text-xs text-gray-500">Oak Grove Townhomes • 8/4/2024</p>
              </div>
              <span className="text-sm font-medium text-red-600">-$180</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Plumbing Repair - Kitchen Sink</p>
                <p className="text-xs text-gray-500">Sunset Apartments • 8/2/2024</p>
              </div>
              <span className="text-sm font-medium text-red-600">-$125</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Rent Payment - Unit 101</p>
                <p className="text-xs text-gray-500">Sunset Apartments • 7/31/2024</p>
              </div>
              <span className="text-sm font-medium text-green-600">+$2,200</span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Rent Payment - Unit 102</p>
                <p className="text-xs text-gray-500">Sunset Apartments • 7/31/2024</p>
              </div>
              <span className="text-sm font-medium text-green-600">+$2,200</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center mb-4">
            <Wrench className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Active Work Orders</h3>
          </div>
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
      

    </div>
  )
}
