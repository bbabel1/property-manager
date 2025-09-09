import { useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Input } from "./ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { 
  Search, 
  Plus, 
  MoreVertical, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Edit, 
  Eye, 
  FileText,
  Trash2,
  Users
} from "lucide-react";

// Mock data for owners - comprehensive dataset
const mockOwners = [
  {
    id: "owner-1",
    first_name: "Robert",
    last_name: "Johnson",
    email: "robert.johnson@email.com",
    phone: "(555) 123-4567",
    address: "123 Oak Street",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
    entity_type: "Individual",
    tax_id: "123-45-6789",
    properties: [
      { id: "prop-1", name: "Sunset Apartments", address: "456 Sunset Blvd", ownership_percentage: 100 },
      { id: "prop-2", name: "Marina Plaza", address: "789 Marina Dr", ownership_percentage: 75 }
    ],
    total_properties: 2,
    total_units: 24,
    monthly_income: 18500,
    created_at: "2023-01-15"
  },
  {
    id: "owner-2",
    first_name: "Sarah",
    last_name: "Chen",
    email: "sarah.chen@email.com",
    phone: "(555) 987-6543",
    address: "789 Pine Avenue",
    city: "Oakland",
    state: "CA",
    zip: "94607",
    entity_type: "Individual",
    tax_id: "987-65-4321",
    properties: [
      { id: "prop-3", name: "Downtown Lofts", address: "321 Main St", ownership_percentage: 100 },
      { id: "prop-4", name: "Hillside Condos", address: "654 Hill Ave", ownership_percentage: 50 }
    ],
    total_properties: 2,
    total_units: 18,
    monthly_income: 14200,
    created_at: "2023-02-20"
  },
  {
    id: "owner-3",
    first_name: "Michael",
    last_name: "Davis",
    email: "michael.davis@email.com",
    phone: "(555) 456-7890",
    address: "456 Elm Street",
    city: "Berkeley",
    state: "CA",
    zip: "94704",
    entity_type: "LLC",
    tax_id: "12-3456789",
    properties: [
      { id: "prop-5", name: "University Heights", address: "987 College Ave", ownership_percentage: 100 }
    ],
    total_properties: 1,
    total_units: 12,
    monthly_income: 9600,
    created_at: "2023-03-10"
  },
  {
    id: "owner-4",
    first_name: "Jennifer",
    last_name: "Rodriguez",
    email: "jennifer.rodriguez@email.com",
    phone: "(555) 321-9876",
    address: "321 Maple Drive",
    city: "San Jose",
    state: "CA",
    zip: "95112",
    entity_type: "Individual",
    tax_id: "456-78-9123",
    properties: [
      { id: "prop-2", name: "Marina Plaza", address: "789 Marina Dr", ownership_percentage: 25 },
      { id: "prop-4", name: "Hillside Condos", address: "654 Hill Ave", ownership_percentage: 50 },
      { id: "prop-6", name: "Tech Center Apartments", address: "159 Innovation Way", ownership_percentage: 100 }
    ],
    total_properties: 3,
    total_units: 32,
    monthly_income: 22800,
    created_at: "2023-04-05"
  },
  {
    id: "owner-5",
    first_name: "David",
    last_name: "Thompson",
    email: "david.thompson@email.com",
    phone: "(555) 654-3210",
    address: "654 Cedar Lane",
    city: "Palo Alto",
    state: "CA",
    zip: "94301",
    entity_type: "Trust",
    tax_id: "98-7654321",
    properties: [
      { id: "prop-7", name: "Executive Suites", address: "753 Executive Dr", ownership_percentage: 100 }
    ],
    total_properties: 1,
    total_units: 8,
    monthly_income: 12400,
    created_at: "2023-05-12"
  },
  {
    id: "owner-6",
    first_name: "Lisa",
    last_name: "Wong",
    email: "lisa.wong@email.com",
    phone: "(555) 789-0123",
    address: "789 Redwood Ave",
    city: "Redwood City",
    state: "CA",
    zip: "94063",
    entity_type: "Corporation",
    tax_id: "77-1234567",
    properties: [
      { id: "prop-8", name: "Silicon Valley Towers", address: "321 Tech Blvd", ownership_percentage: 60 },
      { id: "prop-9", name: "Bay Area Commons", address: "456 Innovation Dr", ownership_percentage: 100 }
    ],
    total_properties: 2,
    total_units: 45,
    monthly_income: 35200,
    created_at: "2023-06-01"
  }
];

interface OwnersProps {
  onOwnerSelect?: (ownerId: string) => void;
}

export function Owners({ onOwnerSelect }: OwnersProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOwner, setSelectedOwner] = useState<any>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getEntityTypeBadge = (entityType: string) => {
    switch (entityType) {
      case 'Individual':
        return 'bg-blue-100 text-blue-800';
      case 'LLC':
        return 'bg-green-100 text-green-800';
      case 'Trust':
        return 'bg-purple-100 text-purple-800';
      case 'Corporation':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Filter owners based on search term
  const filteredOwners = mockOwners.filter(owner =>
    `${owner.first_name} ${owner.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    owner.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    owner.entity_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewOwner = (owner: any) => {
    if (onOwnerSelect) {
      onOwnerSelect(owner.id);
    } else {
      setSelectedOwner(owner);
      setIsViewDialogOpen(true);
    }
  };

  const totalProperties = mockOwners.reduce((sum, owner) => sum + owner.total_properties, 0);
  const totalUnits = mockOwners.reduce((sum, owner) => sum + owner.total_units, 0);
  const totalMonthlyIncome = mockOwners.reduce((sum, owner) => sum + owner.monthly_income, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2">
            <Users className="w-6 h-6" />
            Owners
          </h1>
          <p className="text-muted-foreground">Manage property owners and their ownership details</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Owner
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Owners</p>
                <p className="font-medium">{mockOwners.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Properties</p>
                <p className="font-medium">{totalProperties}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-purple-600 rounded"></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Units</p>
                <p className="font-medium">{totalUnits}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-teal-600 rounded"></div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Income</p>
                <p className="font-medium">{formatCurrency(totalMonthlyIncome)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Owner Directory</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search owners..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Owner</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Entity Type</TableHead>
                <TableHead>Properties</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Since</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOwners.map((owner) => (
                <TableRow key={owner.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{owner.first_name} {owner.last_name}</p>
                      <p className="text-sm text-muted-foreground">{owner.city}, {owner.state}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm">
                        <Mail className="w-3 h-3" />
                        {owner.email}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {owner.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getEntityTypeBadge(owner.entity_type)}>
                      {owner.entity_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      {owner.total_properties}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-purple-600 rounded"></div>
                      {owner.total_units}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(owner.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleViewOwner(owner)}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Owner
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <FileText className="w-4 h-4 mr-2" />
                          View Documents
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Building2 className="w-4 h-4 mr-2" />
                          View Properties
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Owner
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredOwners.length === 0 && (
            <div className="text-center py-8">
              <Users className="mx-auto w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="mb-2">No owners found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 'No owners match your search criteria.' : 'Get started by adding your first owner.'}
              </p>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Owner
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Owner Details Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Owner Details</DialogTitle>
          </DialogHeader>
          {selectedOwner && (
            <div className="space-y-6">
              {/* Basic Information */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <p className="font-medium">{selectedOwner.first_name} {selectedOwner.last_name}</p>
                </div>
                <div>
                  <Label>Entity Type</Label>
                  <Badge className={getEntityTypeBadge(selectedOwner.entity_type)}>
                    {selectedOwner.entity_type}
                  </Badge>
                </div>
                <div>
                  <Label>Email</Label>
                  <p className="font-medium">{selectedOwner.email}</p>
                </div>
                <div>
                  <Label>Phone</Label>
                  <p className="font-medium">{selectedOwner.phone}</p>
                </div>
                <div className="col-span-2">
                  <Label>Address</Label>
                  <p className="font-medium">
                    {selectedOwner.address}, {selectedOwner.city}, {selectedOwner.state} {selectedOwner.zip}
                  </p>
                </div>
                <div>
                  <Label>Tax ID</Label>
                  <p className="font-medium">{selectedOwner.tax_id}</p>
                </div>
                <div>
                  <Label>Owner Since</Label>
                  <p className="font-medium">{formatDate(selectedOwner.created_at)}</p>
                </div>
              </div>

              {/* Portfolio Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Properties</p>
                  <p className="font-medium">{selectedOwner.total_properties}</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Units</p>
                  <p className="font-medium">{selectedOwner.total_units}</p>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Monthly Income</p>
                  <p className="font-medium text-green-600">{formatCurrency(selectedOwner.monthly_income)}</p>
                </div>
              </div>

              {/* Properties Owned */}
              <div>
                <Label className="mb-3 block">Properties Owned</Label>
                <div className="space-y-2">
                  {selectedOwner.properties.map((property: any) => (
                    <div key={property.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{property.name}</p>
                          <p className="text-sm text-muted-foreground">{property.address}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{property.ownership_percentage}%</p>
                          <p className="text-sm text-muted-foreground">Ownership</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}