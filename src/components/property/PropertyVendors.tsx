import { Users, Phone, Mail, MapPin, Star, Plus, Search, Filter, Building, Wrench, Shield, Truck, Calendar } from 'lucide-react'
import { Button } from '../ui/button'

interface PropertyVendorsProps {
  propertyId: string
}

export function PropertyVendors({ propertyId }: PropertyVendorsProps) {
  // TODO: Implement real vendor management with database integration
  const vendors: any[] = []

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Plumbing':
        return <Wrench className="w-4 h-4 text-blue-600" />
      case 'Electrical':
        return <Building className="w-4 h-4 text-yellow-600" />
      case 'Landscaping':
        return <Truck className="w-4 h-4 text-green-600" />
      case 'Locksmith':
        return <Shield className="w-4 h-4 text-purple-600" />
      case 'Cleaning':
        return <Users className="w-4 h-4 text-teal-600" />
      default:
        return <Users className="w-4 h-4 text-gray-600" />
    }
  }

  const categories = ['All', 'Plumbing', 'Electrical', 'Landscaping', 'Locksmith', 'Cleaning', 'HVAC', 'Roofing']

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search vendors..."
              className="pl-10 pr-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Vendor
        </Button>
      </div>

      {/* Empty State */}
      {vendors.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No vendors added</h3>
          <p className="text-muted-foreground mb-6">Add contractors, service providers, and other vendors to manage property maintenance.</p>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Vendor
          </Button>
        </div>
      )}

      {/* Vendors Grid */}
      {vendors.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendors.map((vendor) => (
            <div key={vendor.id} className="bg-card rounded-lg border border-border p-6 transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  {getCategoryIcon(vendor.category)}
                  <span className="text-sm font-medium text-muted-foreground">{vendor.category}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                  <span className="text-sm font-medium">{vendor.rating}</span>
                  <span className="text-xs text-muted-foreground">({vendor.reviews})</span>
                </div>
              </div>
              
              <h3 className="font-semibold text-lg mb-2">{vendor.name}</h3>
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{vendor.contact}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{vendor.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{vendor.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate">{vendor.address}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Last used: {new Date(vendor.lastUsed).toLocaleDateString()}</span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  vendor.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {vendor.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
