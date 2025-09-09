import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./ui/hover-card";
import { Search, Building2, MapPin, Users, Filter, ExternalLink } from "lucide-react";
import { AddPropertyDialog } from "./AddPropertyDialog";
import { mockProperties, mockOwners, mockPropertyOwners, type Property, type Owner } from "../utils/mockData";

interface PropertiesProps {
  onPropertySelect: (propertyId: string) => void;
  onNavigate?: (section: string) => void;
}

interface OwnersHoverCardProps {
  propertyId: string;
  totalOwners: number;
  onOwnerClick: (ownerId: string) => void;
}

function OwnersHoverCard({ propertyId, totalOwners, onOwnerClick }: OwnersHoverCardProps) {
  // Get owners for this property
  const propertyOwnerRelations = mockPropertyOwners.filter(po => po.property_id === propertyId);
  const propertyOwners = propertyOwnerRelations.map(po => {
    const owner = mockOwners.find(o => o.id === po.owner_id);
    return {
      ...owner,
      ownership_percentage: po.ownership_percentage,
      is_primary: po.is_primary
    };
  }).filter(Boolean) as (Owner & { ownership_percentage: number; is_primary: boolean })[];

  const handleOwnerClick = (e: React.MouseEvent, ownerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    onOwnerClick(ownerId);
  };

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="flex items-center justify-center gap-1 cursor-pointer hover:bg-muted/50 rounded p-1">
          <Users className="w-3 h-3 text-muted-foreground" />
          <span className="font-medium">{totalOwners}</span>
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80" side="top" align="center">
        <div className="space-y-3">
          <div>
            <h4 className="font-medium">Property Owners</h4>
            <p className="text-sm text-muted-foreground">{totalOwners} owner{totalOwners !== 1 ? 's' : ''}</p>
          </div>
          <div className="space-y-2">
            {propertyOwners.map((owner) => (
              <div 
                key={owner.id} 
                className="flex items-center justify-between p-2 rounded border hover:bg-muted/50 transition-colors group cursor-pointer"
                onClick={(e) => handleOwnerClick(e, owner.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {owner.first_name} {owner.last_name}
                    </span>
                    {owner.is_primary && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                        Primary
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-2">
                    <span className="text-xs font-medium text-muted-foreground">Ownership</span>
                    <span className="text-xs font-medium">{owner.ownership_percentage}%</span>
                    <span className="text-xs font-medium text-muted-foreground">Disbursement</span>
                    <span className="text-xs font-medium">{owner.ownership_percentage}%</span>
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0" />
              </div>
            ))}
          </div>
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Click on an owner to view their profile
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function Properties({ onPropertySelect, onNavigate }: PropertiesProps) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const handleOwnerClick = (ownerId: string) => {
    // Navigate to rental owners section with the specific owner
    console.log('🔗 Navigating to owner profile:', ownerId);
    if (onNavigate) {
      onNavigate('rental-owners');
    } else {
      // Fallback for direct navigation
      window.location.hash = 'rental-owners';
    }
  };

  useEffect(() => {
    // Simulate loading delay for better UX
    const timer = setTimeout(() => {
      setProperties(mockProperties);
      setFilteredProperties(mockProperties);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Filter properties based on search term, status, and type
    let filtered = properties;

    // Apply search filter
    if (searchTerm.trim() !== "") {
      filtered = filtered.filter(property =>
        property.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        property.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(property => property.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(property => property.type === typeFilter);
    }

    setFilteredProperties(filtered);
  }, [searchTerm, statusFilter, typeFilter, properties]);

  const handlePropertyClick = (propertyId: string) => {
    console.log('🏢 Property selected:', propertyId);
    onPropertySelect(propertyId);
  };

  const handlePropertyAdded = (newProperty: Property) => {
    console.log('✅ Property added:', newProperty);
    const updatedProperties = [...properties, newProperty];
    setProperties(updatedProperties);
    setFilteredProperties(updatedProperties);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="flex items-center gap-2">
            <Building2 className="w-6 h-6" />
            Properties
          </h1>
          <AddPropertyDialog onPropertyAdded={handlePropertyAdded} />
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading properties...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with colored accent */}
      <div className="bg-white border-b border-palette-silver p-6">
        <div className="border-l-4 border-l-palette-blue pl-4">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-palette-blue">
              <Building2 className="w-6 h-6 text-palette-blue" />
              Properties
            </h1>
            <AddPropertyDialog onPropertyAdded={handlePropertyAdded} />
          </div>
          <p className="text-palette-medium-gray mt-2">
            Manage and monitor all your properties in one place.
          </p>
        </div>
      </div>
      
      <div className="p-6 space-y-6">

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search properties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="Apartment">Apartment</SelectItem>
              <SelectItem value="Townhouse">Townhouse</SelectItem>
              <SelectItem value="Condo">Condo</SelectItem>
              <SelectItem value="Single Family">Single Family</SelectItem>
            </SelectContent>
          </Select>

          {(statusFilter !== "all" || typeFilter !== "all") && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setTypeFilter("all");
              }}
              className="px-3"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

        {/* Properties Table */}
        {filteredProperties.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {(searchTerm || statusFilter !== "all" || typeFilter !== "all") ? 'No properties found' : 'No properties yet'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {(searchTerm || statusFilter !== "all" || typeFilter !== "all")
              ? 'No properties match the current filters'
              : 'Get started by adding your first property'
            }
          </p>
          {!searchTerm && statusFilter === "all" && typeFilter === "all" && (
            <AddPropertyDialog onPropertyAdded={handlePropertyAdded} />
          )}
        </div>
      ) : (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-center">Units</TableHead>
                <TableHead className="text-center">Owners</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProperties.map((property) => (
                <TableRow 
                  key={property.id} 
                  className="cursor-pointer hover:bg-muted/50" 
                  onClick={() => handlePropertyClick(property.id)}
                >
                  <TableCell>
                    <div className="space-y-1">
                      <div className="font-medium">{property.name}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{property.address}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{property.type}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="space-y-1">
                      <div className="font-medium">{property.totalUnits}</div>
                      <div className="text-xs text-muted-foreground">
                        <span className="text-green-600">{property.occupiedUnits}</span>
                        {" / "}
                        <span className="text-gray-500">{property.availableUnits}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <OwnersHoverCard 
                      propertyId={property.id}
                      totalOwners={property.totalOwners}
                      onOwnerClick={handleOwnerClick}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={property.status === 'active' ? 'default' : 'outline'}
                      className={
                        property.status === 'active' 
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                          : 'border-red-600 text-red-600 hover:bg-red-50'
                      }
                    >
                      {property.status.charAt(0).toUpperCase() + property.status.slice(1)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

        {/* Summary */}
        {filteredProperties.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/30 p-3 rounded-md">
          <span>
            Showing {filteredProperties.length} of {properties.length} properties
            {(searchTerm || statusFilter !== "all" || typeFilter !== "all") && " (filtered)"}
          </span>
          <div className="flex items-center gap-4">
            <span>
              Total Units: {filteredProperties.reduce((sum, p) => sum + p.totalUnits, 0)}
            </span>
            <span>
              Occupied: {filteredProperties.reduce((sum, p) => sum + p.occupiedUnits, 0)}
            </span>
            <span>
              Available: {filteredProperties.reduce((sum, p) => sum + p.availableUnits, 0)}
            </span>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}