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
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Properties</p>
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground">0 total units</p>
            </div>
            <Building className="h-8 w-8 text-primary" />
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Occupancy Rate</p>
              <p className="text-2xl font-bold text-foreground">0%</p>
              <p className="text-sm text-muted-foreground">0 occupied, 0 available</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Monthly Rent Roll</p>
              <p className="text-2xl font-bold text-foreground">$0</p>
              <p className="text-sm text-muted-foreground">From 0 active leases</p>
            </div>
            <DollarSign className="h-8 w-8 text-primary" />
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Open Work Orders</p>
              <p className="text-2xl font-bold text-foreground">0</p>
              <p className="text-sm text-muted-foreground">All caught up</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center mb-4">
            <FileText className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-medium text-foreground">Lease Renewals</h3>
          </div>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No lease renewals due</p>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center mb-4">
            <UserCheck className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-medium text-foreground">Property Onboarding</h3>
          </div>
          <div className="text-center py-8">
            <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No properties being onboarded</p>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center mb-4">
            <DollarSign className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-medium text-foreground">Recent Transactions</h3>
          </div>
          <div className="text-center py-8">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No recent transactions</p>
          </div>
        </div>
        
        <div className="bg-card rounded-lg border p-6">
          <div className="flex items-center mb-4">
            <Wrench className="h-5 w-5 text-primary mr-2" />
            <h3 className="text-lg font-medium text-foreground">Active Work Orders</h3>
          </div>
          <div className="text-center py-8">
            <Wrench className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No active work orders</p>
          </div>
        </div>
      </div>
    </div>
  )
}
