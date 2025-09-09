import { useState, useEffect } from "react";
import { Building2, Search, MapPin, Bed, Bath, DollarSign, Ruler, User, Calendar } from "lucide-react";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { 
  mockUnits, 
  mockProperties, 
  mockLeases, 
  mockLeaseTenants, 
  mockTenants,
  type Unit, 
  type Property, 
  type Lease,
  type Tenant
} from "../utils/mockData";

interface UnitsProps {
  onUnitSelect?: (unitId: string, propertyId: string) => void;
}

export function Units({ onUnitSelect }: UnitsProps) {
  const [units, setUnits] = useState<Unit[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [filteredUnits, setFilteredUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [bedroomFilter, setBedroomFilter] = useState<string>("all");

  useEffect(() => {
    // Simulate loading delay for better UX
    const timer = setTimeout(() => {
      setUnits(mockUnits);
      setProperties(mockProperties);
      setLeases(mockLeases);
      setTenants(mockTenants);
      setFilteredUnits(mockUnits);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Filter units based on search term, property, status, and bedrooms
    let filtered = units;

    // Apply search filter
    if (searchTerm.trim() !== "") {
      filtered = filtered.filter(unit => {
        const property = properties.find(p => p.id === unit.property_id);
        return (
          unit.unit_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          property?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          property?.address.toLowerCase().includes(searchTerm.toLowerCase())
        );
      });
    }

    // Apply property filter
    if (propertyFilter !== "all") {
      filtered = filtered.filter(unit => unit.property_id === propertyFilter);
    }

    // Apply status filter (occupied/vacant)
    if (statusFilter !== "all") {
      const unitIds = filtered.map(u => u.id);
      const activeLeases = leases.filter(lease => 
        lease.status === 'active' && unitIds.includes(lease.unit_id)
      );
      const occupiedUnitIds = activeLeases.map(lease => lease.unit_id);
      
      if (statusFilter === "occupied") {
        filtered = filtered.filter(unit => occupiedUnitIds.includes(unit.id));
      } else if (statusFilter === "vacant") {
        filtered = filtered.filter(unit => !occupiedUnitIds.includes(unit.id));
      }
    }

    // Apply bedroom filter
    if (bedroomFilter !== "all") {
      filtered = filtered.filter(unit => unit.bedrooms.toString() === bedroomFilter);
    }

    setFilteredUnits(filtered);
  }, [searchTerm, propertyFilter, statusFilter, bedroomFilter, units, properties, leases]);

  const getPropertyById = (id: string): Property | undefined => {
    return properties.find(property => property.id === id);
  };

  const getUnitStatus = (unitId: string): { status: 'occupied' | 'vacant', tenant?: Tenant, lease?: Lease } => {
    const activeLease = leases.find(lease => 
      lease.unit_id === unitId && lease.status === 'active'
    );
    
    if (activeLease) {
      const leaseTenant = mockLeaseTenants.find(lt => 
        lt.lease_id === activeLease.id && lt.role === 'primary'
      );
      const tenant = leaseTenant ? tenants.find(t => t.id === leaseTenant.tenant_id) : undefined;
      
      return { status: 'occupied', tenant, lease: activeLease };
    }
    
    return { status: 'vacant' };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatSquareFeet = (sqft?: number) => {
    if (!sqft) return 'N/A';
    return `${sqft.toLocaleString()} sq ft`;
  };

  // Calculate summary stats
  const totalUnits = filteredUnits.length;
  const occupiedCount = filteredUnits.filter(unit => getUnitStatus(unit.id).status === 'occupied').length;
  const vacantCount = totalUnits - occupiedCount;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedCount / totalUnits) * 100) : 0;
  const totalMarketRent = filteredUnits.reduce((sum, unit) => sum + unit.market_rent, 0);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Units
          </h1>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading units...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2">
          <Building2 className="w-6 h-6" />
          Units
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Total Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUnits}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Occupied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{occupiedCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Vacant</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{vacantCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Occupancy Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupancyRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search units or properties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Property" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Properties</SelectItem>
              {properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="occupied">Occupied</SelectItem>
              <SelectItem value="vacant">Vacant</SelectItem>
            </SelectContent>
          </Select>

          <Select value={bedroomFilter} onValueChange={setBedroomFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Bedrooms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Bedrooms</SelectItem>
              <SelectItem value="1">1 Bedroom</SelectItem>
              <SelectItem value="2">2 Bedrooms</SelectItem>
              <SelectItem value="3">3 Bedrooms</SelectItem>
              <SelectItem value="4">4+ Bedrooms</SelectItem>
            </SelectContent>
          </Select>

          {(propertyFilter !== "all" || statusFilter !== "all" || bedroomFilter !== "all") && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setPropertyFilter("all");
                setStatusFilter("all");
                setBedroomFilter("all");
              }}
              className="px-3"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Units Table */}
      {filteredUnits.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {(searchTerm || propertyFilter !== "all" || statusFilter !== "all" || bedroomFilter !== "all") ? 'No units found' : 'No units yet'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {(searchTerm || propertyFilter !== "all" || statusFilter !== "all" || bedroomFilter !== "all")
              ? 'No units match the current filters'
              : 'Units will appear here once properties are added'
            }
          </p>
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Property</TableHead>
                <TableHead className="text-center">Layout</TableHead>
                <TableHead className="text-center">Size</TableHead>
                <TableHead className="text-center">Market Rent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tenant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUnits.map((unit) => {
                const property = getPropertyById(unit.property_id);
                const unitStatus = getUnitStatus(unit.id);
                
                return (
                  <TableRow 
                    key={unit.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => onUnitSelect?.(unit.id, unit.property_id)}
                  >
                    <TableCell>
                      <div className="font-medium">{unit.unit_number}</div>
                    </TableCell>
                    
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{property?.name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{property?.address}</span>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex items-center gap-1">
                          <Bed className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{unit.bedrooms}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Bath className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm">{unit.bathrooms}</span>
                        </div>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Ruler className="w-3 h-3 text-muted-foreground" />
                        <span className="text-sm">{formatSquareFeet(unit.square_feet)}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <DollarSign className="w-3 h-3 text-muted-foreground" />
                        <span className="font-medium">{formatCurrency(unit.market_rent)}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <Badge 
                        variant={unitStatus.status === 'occupied' ? 'default' : 'outline'}
                        className={
                          unitStatus.status === 'occupied' 
                            ? 'bg-palette-teal text-white' 
                            : 'border-palette-medium-gray text-palette-medium-gray'
                        }
                      >
                        {unitStatus.status.charAt(0).toUpperCase() + unitStatus.status.slice(1)}
                      </Badge>
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
        </div>
      )}

      {/* Summary */}
      {filteredUnits.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
          <span>
            Showing {filteredUnits.length} of {units.length} units
            {(searchTerm || propertyFilter !== "all" || statusFilter !== "all" || bedroomFilter !== "all") && " (filtered)"}
          </span>
          <div className="flex items-center gap-4">
            <span>
              Total Market Rent: {formatCurrency(totalMarketRent)}
            </span>
            <span>
              Occupancy: {occupancyRate}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}