import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { 
  Building2, 
  Search, 
  Filter, 
  Plus,
  Bed,
  Bath,
  Square,
  DollarSign,
  Users,
  Calendar,
  User
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { 
  getUnitsByPropertyId, 
  mockLeases, 
  mockLeaseTenants, 
  mockTenants,
  type Lease,
  type Tenant 
} from "../utils/mockData";

interface PropertyUnitsProps {
  propertyId: string;
  accessToken?: string;
  onUnitSelect?: (unitId: string, propertyId: string) => void;
}

export function PropertyUnits({ propertyId, onUnitSelect }: PropertyUnitsProps) {
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    if (propertyId) {
      fetchUnits();
    }
  }, [propertyId]);

  // Get tenant information for a unit (similar to Units component)
  const getUnitStatus = (unitId: string): { status: 'occupied' | 'available', tenant?: Tenant, lease?: Lease } => {
    const activeLease = mockLeases.find(lease => 
      lease.unit_id === unitId && lease.status === 'active'
    );
    
    if (activeLease) {
      const leaseTenant = mockLeaseTenants.find(lt => 
        lt.lease_id === activeLease.id && lt.role === 'primary'
      );
      const tenant = leaseTenant ? mockTenants.find(t => t.id === leaseTenant.tenant_id) : undefined;
      
      return { status: 'occupied', tenant, lease: activeLease };
    }
    
    return { status: 'available' };
  };

  const fetchUnits = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Simulate loading delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get units from mock data
      const mockUnits = getUnitsByPropertyId(propertyId);
      
      // Convert mock units to display format with proper status
      const unitsData = mockUnits.map(unit => {
        const unitStatus = getUnitStatus(unit.id);
        return {
          id: unit.id,
          property_id: unit.property_id,
          name: unit.unit_number,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          square_feet: unit.square_feet,
          rent: unit.market_rent,
          status: unitStatus.status === 'occupied' ? 'occupied' : 'available',
          createdAt: unit.created_at,
          source: 'mock'
        };
      });
      
      setUnits(unitsData);
    } catch (err: any) {
      console.error('Error loading units:', err);
      setError(err.message || 'Failed to load units');
      setUnits([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredUnits = units.filter(unit => {
    const matchesSearch = unit.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === "all" || unit.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      occupied: { label: 'Occupied', variant: 'default' as const, color: 'bg-palette-teal text-white' },
      available: { label: 'Available', variant: 'secondary' as const, color: 'bg-green-100 text-green-800' },
      maintenance: { label: 'Maintenance', variant: 'outline' as const, color: 'bg-yellow-100 text-yellow-800' },
      reserved: { label: 'Reserved', variant: 'outline' as const, color: 'bg-purple-100 text-purple-800' }
    };
    
    return statusConfig[status as keyof typeof statusConfig] || statusConfig.available;
  };

  const getUnitStats = () => {
    const total = units.length;
    const occupied = units.filter(u => u.status === 'occupied').length;
    const available = units.filter(u => u.status === 'available').length;
    const maintenance = units.filter(u => u.status === 'maintenance').length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    
    return { total, occupied, available, maintenance, occupancyRate };
  };

  const stats = getUnitStats();

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading units...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Search and Filters */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search units..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Status</option>
              <option value="occupied">Occupied</option>
              <option value="available">Available</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>

          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Add Unit
          </Button>
        </div>
      </Card>

      {/* Units Table */}
      <Card>
        <div className="p-4 border-b">
          <h3 className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Units ({filteredUnits.length})
          </h3>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Layout</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Rent</TableHead>
              <TableHead>Tenant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUnits.map((unit) => {
              const statusConfig = getStatusBadge(unit.status);
              const unitStatus = getUnitStatus(unit.id);
              
              return (
                <TableRow 
                  key={unit.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onUnitSelect?.(unit.id, propertyId)}
                >
                  <TableCell>
                    <div className="font-medium">Unit {unit.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig.color}>
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      {unit.bedrooms && (
                        <div className="flex items-center gap-1">
                          <Bed className="w-4 h-4" />
                          <span className="text-sm">{unit.bedrooms}</span>
                        </div>
                      )}
                      {unit.bathrooms && (
                        <div className="flex items-center gap-1">
                          <Bath className="w-4 h-4" />
                          <span className="text-sm">{unit.bathrooms}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Square className="w-4 h-4" />
                      <span className="text-sm">
                        {unit.square_feet ? `${unit.square_feet.toLocaleString()} sq ft` : 'N/A'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 font-medium">
                      <DollarSign className="w-4 h-4" />
                      <span>{formatCurrency(unit.rent)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {unitStatus.status === 'occupied' && unitStatus.tenant ? (
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {unitStatus.tenant.first_name} {unitStatus.tenant.last_name}
                          </div>
                          {unitStatus.lease && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span>Until {new Date(unitStatus.lease.end_date).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {filteredUnits.length === 0 && (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">
              {searchTerm || filterStatus !== "all" ? "No units match your filters" : "No units found"}
            </p>
            {(searchTerm || filterStatus !== "all") && (
              <Button 
                variant="outline" 
                onClick={() => { setSearchTerm(""); setFilterStatus("all"); }}
                className="mt-2"
              >
                Clear Filters
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}