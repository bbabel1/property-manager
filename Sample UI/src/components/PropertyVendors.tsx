import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { 
  Users, 
  Search, 
  Filter,
  Plus,
  Phone,
  Mail,
  MapPin,
  Star,
  Calendar,
  DollarSign,
  Briefcase,
  Edit,
  Eye,
  Trash2
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface PropertyVendorsProps {
  propertyId: string;
  accessToken?: string;
}

interface Vendor {
  id: string;
  name: string;
  company: string;
  category: string;
  specialty: string[];
  phone: string;
  email: string;
  address: string;
  rating: number;
  totalJobs: number;
  activeJobs: number;
  lastJobDate: string;
  status: 'active' | 'inactive' | 'preferred';
  hourlyRate?: number;
  notes?: string;
}

export function PropertyVendors({ propertyId, accessToken }: PropertyVendorsProps) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Mock vendors data for demonstration
  const mockVendors: Vendor[] = [
    {
      id: '1',
      name: 'Mike Johnson',
      company: 'Johnson Plumbing Services',
      category: 'plumbing',
      specialty: ['Emergency Repairs', 'Installation', 'Maintenance'],
      phone: '(555) 123-4567',
      email: 'mike@johnsonplumbing.com',
      address: '123 Main St, City, State 12345',
      rating: 4.8,
      totalJobs: 24,
      activeJobs: 2,
      lastJobDate: '2024-01-10T00:00:00Z',
      status: 'preferred',
      hourlyRate: 85,
      notes: 'Excellent response time and quality work'
    },
    {
      id: '2',
      name: 'Sarah Chen',
      company: 'Elite Electrical Solutions',
      category: 'electrical',
      specialty: ['Wiring', 'Panel Upgrades', 'Lighting'],
      phone: '(555) 234-5678',
      email: 'sarah@eliteelectrical.com',
      address: '456 Oak Ave, City, State 12345',
      rating: 4.9,
      totalJobs: 18,
      activeJobs: 1,
      lastJobDate: '2024-01-08T00:00:00Z',
      status: 'preferred',
      hourlyRate: 95,
      notes: 'Licensed and insured, very reliable'
    },
    {
      id: '3',
      name: 'Tom Wilson',
      company: 'Wilson HVAC & Heating',
      category: 'hvac',
      specialty: ['AC Repair', 'Heating', 'Ductwork'],
      phone: '(555) 345-6789',
      email: 'tom@wilsonhvac.com',
      address: '789 Pine St, City, State 12345',
      rating: 4.5,
      totalJobs: 12,
      activeJobs: 0,
      lastJobDate: '2023-12-15T00:00:00Z',
      status: 'active',
      hourlyRate: 90
    },
    {
      id: '4',
      name: 'Maria Rodriguez',
      company: 'Rodriguez Landscaping',
      category: 'landscaping',
      specialty: ['Lawn Care', 'Tree Trimming', 'Irrigation'],
      phone: '(555) 456-7890',
      email: 'maria@rodriguezlandscaping.com',
      address: '321 Elm St, City, State 12345',
      rating: 4.7,
      totalJobs: 32,
      activeJobs: 3,
      lastJobDate: '2024-01-12T00:00:00Z',
      status: 'active',
      hourlyRate: 65
    },
    {
      id: '5',
      name: 'Dave Anderson',
      company: 'Anderson General Contracting',
      category: 'general',
      specialty: ['Repairs', 'Renovations', 'Painting'],
      phone: '(555) 567-8901',
      email: 'dave@andersoncontracting.com',
      address: '654 Maple Dr, City, State 12345',
      rating: 4.3,
      totalJobs: 8,
      activeJobs: 1,
      lastJobDate: '2023-12-20T00:00:00Z',
      status: 'active',
      hourlyRate: 75
    }
  ];

  useEffect(() => {
    // Simulate API call
    setVendors(mockVendors);
  }, [propertyId]);

  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = 
      vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vendor.specialty.some(spec => spec.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = filterCategory === "all" || vendor.category === filterCategory;
    const matchesStatus = filterStatus === "all" || vendor.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getCategoryBadge = (category: string) => {
    const categoryConfig = {
      plumbing: { label: 'Plumbing', color: 'bg-blue-100 text-blue-800' },
      electrical: { label: 'Electrical', color: 'bg-yellow-100 text-yellow-800' },
      hvac: { label: 'HVAC', color: 'bg-green-100 text-green-800' },
      landscaping: { label: 'Landscaping', color: 'bg-emerald-100 text-emerald-800' },
      general: { label: 'General', color: 'bg-gray-100 text-gray-800' },
      cleaning: { label: 'Cleaning', color: 'bg-purple-100 text-purple-800' },
      security: { label: 'Security', color: 'bg-red-100 text-red-800' }
    };
    
    return categoryConfig[category as keyof typeof categoryConfig] || categoryConfig.general;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      preferred: { label: 'Preferred', color: 'bg-green-100 text-green-800' },
      active: { label: 'Active', color: 'bg-blue-100 text-blue-800' },
      inactive: { label: 'Inactive', color: 'bg-gray-100 text-gray-800' }
    };
    
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.active;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getVendorStats = () => {
    const total = vendors.length;
    const preferred = vendors.filter(v => v.status === 'preferred').length;
    const active = vendors.filter(v => v.status === 'active').length;
    const totalActiveJobs = vendors.reduce((sum, v) => sum + v.activeJobs, 0);
    
    return { total, preferred, active, totalActiveJobs };
  };

  const stats = getVendorStats();

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < Math.floor(rating) 
            ? 'text-yellow-400 fill-current' 
            : i < rating 
              ? 'text-yellow-400 fill-current opacity-50'
              : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="space-y-6">


      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search vendors..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Categories</option>
              <option value="plumbing">Plumbing</option>
              <option value="electrical">Electrical</option>
              <option value="hvac">HVAC</option>
              <option value="landscaping">Landscaping</option>
              <option value="general">General</option>
              <option value="cleaning">Cleaning</option>
              <option value="security">Security</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Status</option>
              <option value="preferred">Preferred</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Vendor
          </Button>
        </div>
      </Card>

      {/* Vendors Table */}
      <Card>
        <div className="p-4 border-b">
          <h3 className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Vendors ({filteredVendors.length})
          </h3>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Jobs</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredVendors.map((vendor) => {
              const categoryConfig = getCategoryBadge(vendor.category);
              const statusConfig = getStatusBadge(vendor.status);
              return (
                <TableRow key={vendor.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{vendor.name}</p>
                      <p className="text-sm text-muted-foreground">{vendor.company}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {vendor.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {vendor.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={categoryConfig.color}>
                      {categoryConfig.label}
                    </Badge>
                    <div className="mt-1">
                      {vendor.specialty.slice(0, 2).map((spec, index) => (
                        <Badge key={index} variant="outline" className="text-xs mr-1">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        {renderStars(vendor.rating)}
                      </div>
                      <span className="text-sm font-medium">{vendor.rating}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p><span className="font-medium">{vendor.totalJobs}</span> total</p>
                      <p className="text-muted-foreground">
                        {vendor.activeJobs > 0 
                          ? `${vendor.activeJobs} active`
                          : 'No active jobs'
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last: {formatDate(vendor.lastJobDate)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {vendor.hourlyRate && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        <span className="font-medium">{vendor.hourlyRate}/hr</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig.color}>
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" title="View Details">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Edit">
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Remove" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {filteredVendors.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-2">
              {searchTerm || filterCategory !== "all" || filterStatus !== "all" 
                ? "No vendors match your filters" 
                : "No vendors added yet"
              }
            </p>
            {searchTerm || filterCategory !== "all" || filterStatus !== "all" ? (
              <Button 
                variant="outline" 
                onClick={() => { 
                  setSearchTerm(""); 
                  setFilterCategory("all");
                  setFilterStatus("all");
                }}
              >
                Clear Filters
              </Button>
            ) : (
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add First Vendor
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" className="h-16 flex-col">
            <Plus className="w-5 h-5 mb-2" />
            <span className="text-sm">Add Vendor</span>
          </Button>
          <Button variant="outline" className="h-16 flex-col">
            <Calendar className="w-5 h-5 mb-2" />
            <span className="text-sm">Schedule Job</span>
          </Button>
          <Button variant="outline" className="h-16 flex-col">
            <Star className="w-5 h-5 mb-2" />
            <span className="text-sm">Rate Vendor</span>
          </Button>
          <Button variant="outline" className="h-16 flex-col">
            <Briefcase className="w-5 h-5 mb-2" />
            <span className="text-sm">View All Jobs</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}