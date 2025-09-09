import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Search, Plus, Mail, Phone, MapPin, Edit2, Database, AlertCircle, Users, Building, Home, Percent, Crown, X, User, Contact } from "lucide-react";
import { projectId } from "../utils/supabase/info";
import type { 
  RentalOwnersSearchResponse, 
  RentalOwnerDisplay,
  RentalOwnerCreateRequest,
  RentalOwnerUpdateRequest,
  RentalOwnerCreateResponse,
  RentalOwnerUpdateResponse
} from "../utils/supabase/types";

interface RentalOwnersProps {
  // No longer requiring access token
}

// Enhanced interface for owners with property relationships via ownership table
interface RentalOwnerWithProperties extends RentalOwnerDisplay {
  properties?: Array<{
    id: string;
    name: string;
    address: string | null;
    ownership_percent: number;
    disbursement_percent: number;
    is_primary: boolean;
  }>;
  totalProperties?: number;
  primaryProperty?: string | null;
}

export function RentalOwners({}: RentalOwnersProps) {
  const [owners, setOwners] = useState<RentalOwnerWithProperties[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<RentalOwnerWithProperties | null>(null);
  const [managingProperties, setManagingProperties] = useState<RentalOwnerWithProperties | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [propertyLoading, setPropertyLoading] = useState(false);
  const [apiResponse, setApiResponse] = useState<RentalOwnersSearchResponse | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    isCompany: false,
    email: "",
    phone: "",
    address: "",
  });

  // Property management form state
  const [propertyForm, setPropertyForm] = useState({
    propertyId: "",
    ownershipPercent: 0,
    disbursementPercent: 0,
    isPrimary: false
  });

  const fetchRentalOwners = async (search = "") => {
    setLoading(true);
    try {
      console.log("🔍 Fetching rental owners with normalized ownership relationships:", search);
      
      const searchParams = search ? `?q=${encodeURIComponent(search)}` : '';
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/rental-owners/search${searchParams}`,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("📋 Response status:", response.status);

      if (response.ok) {
        const data: RentalOwnersSearchResponse = await response.json();
        console.log("✅ API Response received (normalized ownership):", data);
        setApiResponse(data);
        setOwners(data.owners || []);
        
        if (data.owners && data.owners.length > 0) {
          console.log("📋 Sample owner with property relationships:", {
            id: data.owners[0].id,
            fullName: data.owners[0].fullName,
            totalProperties: (data.owners[0] as RentalOwnerWithProperties).totalProperties || 0,
            primaryProperty: (data.owners[0] as RentalOwnerWithProperties).primaryProperty,
            queryUsed: data.owners[0].queryUsed
          });
        }
      } else {
        const errorText = await response.text();
        console.error("❌ API Error:", response.status, errorText);
        setOwners([]);
        setApiResponse({
          owners: [],
          count: 0,
          source: 'error',
          queryUsed: 'fetch_error',
          contactsAvailable: false,
          error: `HTTP ${response.status}`,
          details: errorText
        });
      }
    } catch (error: any) {
      console.error("❌ Network error fetching rental owners:", error);
      setOwners([]);
      setApiResponse({
        owners: [],
        count: 0,
        source: 'error',
        queryUsed: 'network_error',
        contactsAvailable: false,
        error: 'Network error',
        details: error?.message || 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRentalOwners(searchTerm);
  };

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();

    setCreateLoading(true);
    try {
      console.log("💾 Creating rental owner (no property arrays):", formData);
      
      const createRequest: RentalOwnerCreateRequest = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        companyName: formData.companyName,
        isCompany: formData.isCompany,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
      };
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/rental-owners`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(createRequest),
        }
      );

      if (response.ok) {
        const data: RentalOwnerCreateResponse = await response.json();
        console.log("✅ Rental owner created (normalized approach):", data);
        
        setOwners(prev => [data.owner, ...prev]);
        setIsCreateDialogOpen(false);
        setFormData({
          firstName: "",
          lastName: "",
          companyName: "",
          isCompany: false,
          email: "",
          phone: "",
          address: "",
        });
        
        // Refresh the list to get updated data
        fetchRentalOwners(searchTerm);
      } else {
        const errorData = await response.json();
        console.error("❌ Create error:", errorData);
        alert(`Failed to create rental owner: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error("❌ Create rental owner error:", error);
      alert(`Error creating rental owner: ${error.message}`);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleUpdateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOwner) return;

    setUpdateLoading(true);
    try {
      console.log("💾 Updating rental owner (contact info only):", editingOwner.id, formData);
      
      const updateRequest: RentalOwnerUpdateRequest = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        companyName: formData.companyName,
        isCompany: formData.isCompany,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
      };
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/rental-owners/${editingOwner.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateRequest),
        }
      );

      if (response.ok) {
        const data: RentalOwnerUpdateResponse = await response.json();
        console.log("✅ Rental owner updated (contact only):", data);
        
        setOwners(prev => prev.map(owner => 
          owner.id === editingOwner.id ? { ...owner, ...data.owner } : owner
        ));
        setEditingOwner(null);
        setFormData({
          firstName: "",
          lastName: "",
          companyName: "",
          isCompany: false,
          email: "",
          phone: "",
          address: "",
        });
        
        // Refresh the list to get updated data
        fetchRentalOwners(searchTerm);
      } else {
        const errorData = await response.json();
        console.error("❌ Update error:", errorData);
        alert(`Failed to update rental owner: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error("❌ Update rental owner error:", error);
      alert(`Error updating rental owner: ${error.message}`);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleAddPropertyOwnership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingProperties) return;

    setPropertyLoading(true);
    try {
      console.log("🏠 Adding property ownership (normalized table):", propertyForm);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/rental-owners/${managingProperties.id}/properties`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(propertyForm),
        }
      );

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Property ownership added:", data);
        
        setPropertyForm({
          propertyId: "",
          ownershipPercent: 0,
          disbursementPercent: 0,
          isPrimary: false
        });
        
        // Refresh the owner's data to show new property relationship
        fetchRentalOwners(searchTerm);
        alert('Property ownership relationship added successfully!');
      } else {
        const errorData = await response.json();
        console.error("❌ Add property ownership error:", errorData);
        alert(`Failed to add property ownership: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error("❌ Add property ownership error:", error);
      alert(`Error adding property ownership: ${error.message}`);
    } finally {
      setPropertyLoading(false);
    }
  };

  const handleRemovePropertyOwnership = async (propertyId: string) => {
    if (!managingProperties) return;

    if (!confirm('Are you sure you want to remove this property ownership relationship?')) {
      return;
    }

    setPropertyLoading(true);
    try {
      console.log("🏠 Removing property ownership (normalized table):", propertyId);
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/rental-owners/${managingProperties.id}/properties/${propertyId}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        console.log("✅ Property ownership removed");
        
        // Refresh the owner's data to remove the property relationship
        fetchRentalOwners(searchTerm);
        alert('Property ownership relationship removed successfully!');
      } else {
        const errorData = await response.json();
        console.error("❌ Remove property ownership error:", errorData);
        alert(`Failed to remove property ownership: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error("❌ Remove property ownership error:", error);
      alert(`Error removing property ownership: ${error.message}`);
    } finally {
      setPropertyLoading(false);
    }
  };

  const startEdit = (owner: RentalOwnerWithProperties) => {
    setEditingOwner(owner);
    setFormData({
      firstName: owner.firstName,
      lastName: owner.lastName,
      companyName: owner.companyName,
      isCompany: owner.isCompany,
      email: owner.email,
      phone: owner.phone,
      address: owner.address,
    });
  };

  const startPropertyManagement = (owner: RentalOwnerWithProperties) => {
    setManagingProperties(owner);
    setPropertyForm({
      propertyId: "",
      ownershipPercent: 0,
      disbursementPercent: 0,
      isPrimary: false
    });
  };

  useEffect(() => {
    fetchRentalOwners();
  }, []);

  // No authentication check needed - direct access to rental owners

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1>Rental Owners</h1>
          <p className="text-muted-foreground">
            Manage rental property owners and their relationships via normalized ownership table
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Owner
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Rental Owner</DialogTitle>
              <DialogDescription>
                Create a new rental owner. Property relationships will be managed separately via the ownership table.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateOwner} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="create-firstName">First Name *</Label>
                  <Input
                    id="create-firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="create-lastName">Last Name *</Label>
                  <Input
                    id="create-lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Enter last name"
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="create-email">Email</Label>
                <Input
                  id="create-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email address"
                />
              </div>
              
              <div>
                <Label htmlFor="create-phone">Phone</Label>
                <Input
                  id="create-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Enter phone number"
                />
              </div>
              
              <div>
                <Label htmlFor="create-address">Address</Label>
                <Textarea
                  id="create-address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Enter address"
                  rows={3}
                />
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={createLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createLoading}>
                  {createLoading ? "Creating..." : "Create Owner"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" disabled={loading}>
              <Search className="w-4 h-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* API Response Status */}
      {apiResponse && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              Normalized Ownership Model Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">Query Used:</span>
                <Badge variant="secondary" className="ml-2">
                  {apiResponse.queryUsed}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Source:</span>
                <Badge variant={apiResponse.source === 'database' ? 'default' : 'destructive'} className="ml-2">
                  {apiResponse.source}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Contacts Available:</span>
                <Badge variant={apiResponse.contactsAvailable ? 'default' : 'secondary'} className="ml-2">
                  {apiResponse.contactsAvailable ? 'Yes' : 'No'}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Count:</span>
                <Badge variant="outline" className="ml-2">
                  {apiResponse.count}
                </Badge>
              </div>
            </div>
            
            {apiResponse.note && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-sm text-blue-700">{apiResponse.note}</p>
              </div>
            )}
            
            {apiResponse.error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-700 font-medium">{apiResponse.error}</p>
                    {apiResponse.details && (
                      <p className="text-xs text-red-600 mt-1">{apiResponse.details}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rental Owners Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Rental Owners ({owners.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p>Loading rental owners...</p>
            </div>
          ) : owners.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No rental owners found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? 
                  "No owners match your search criteria. Try a different search term." :
                  "Get started by adding your first rental owner."
                }
              </p>
              {!searchTerm && (
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Owner
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead>Properties</TableHead>
                    <TableHead>Contact Status</TableHead>
                    <TableHead>Data Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {owners.map((owner) => (
                    <TableRow key={owner.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">
                              {owner.fullName || `${owner.firstName} ${owner.lastName}`.trim() || 'Unnamed Owner'}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ID: {owner.id.substring(0, 8)}...
                          </div>
                          {owner.contactId && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Contact className="w-3 h-3" />
                              <span>Contact: {owner.contactId.substring(0, 8)}...</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          {owner.email && (
                            <div className="flex items-center gap-1 text-sm">
                              <Mail className="w-3 h-3 text-muted-foreground" />
                              <span className="truncate max-w-[160px]">{owner.email}</span>
                            </div>
                          )}
                          {owner.phone && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="w-3 h-3 text-muted-foreground" />
                              <span>{owner.phone}</span>
                            </div>
                          )}
                          {owner.address && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span className="truncate max-w-[160px]">{owner.address}</span>
                            </div>
                          )}
                          {!owner.email && !owner.phone && !owner.address && (
                            <span className="text-sm text-muted-foreground">No contact info</span>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Building className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{owner.totalProperties || 0}</span>
                          </div>
                          {owner.primaryProperty && (
                            <div className="flex items-center gap-1 text-xs">
                              <Crown className="w-3 h-3 text-yellow-500" />
                              <span className="truncate max-w-[120px]">{owner.primaryProperty}</span>
                            </div>
                          )}
                          {owner.properties && owner.properties.length > 0 && (
                            <div className="space-y-1">
                              {owner.properties.slice(0, 2).map((property) => (
                                <div key={property.id} className="flex items-center justify-between text-xs">
                                  <span className="flex items-center gap-1 truncate max-w-[100px]">
                                    {property.is_primary && <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />}
                                    {property.name}
                                  </span>
                                  <span className="text-muted-foreground flex-shrink-0">
                                    {property.ownership_percent}%
                                  </span>
                                </div>
                              ))}
                              {owner.properties.length > 2 && (
                                <div className="text-xs text-muted-foreground">
                                  +{owner.properties.length - 2} more...
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant={owner.contactsAvailable ? 'default' : 'secondary'} className="text-xs">
                            {owner.contactsAvailable ? 'Available' : 'Missing'}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {owner.queryUsed?.replace(/_/g, ' ')}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-xs">
                            {owner.source}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            Query: {owner.queryUsed?.split('_').slice(-2).join(' ')}
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEdit(owner)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startPropertyManagement(owner)}
                          >
                            <Home className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingOwner} onOpenChange={(open) => !open && setEditingOwner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Rental Owner</DialogTitle>
            <DialogDescription>
              Update contact information for {editingOwner?.fullName}. Property relationships are managed separately.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateOwner} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-firstName">First Name *</Label>
                <Input
                  id="edit-firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="Enter first name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit-lastName">Last Name *</Label>
                <Input
                  id="edit-lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Enter last name"
                  required
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="Enter email address"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Enter phone number"
              />
            </div>
            
            <div>
              <Label htmlFor="edit-address">Address</Label>
              <Textarea
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Enter address"
                rows={3}
              />
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setEditingOwner(null)}
                disabled={updateLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateLoading}>
                {updateLoading ? "Updating..." : "Update Owner"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Property Management Dialog */}
      <Dialog open={!!managingProperties} onOpenChange={(open) => !open && setManagingProperties(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Property Ownership</DialogTitle>
            <DialogDescription>
              Manage property relationships for {managingProperties?.fullName} using the normalized ownership table
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="current" className="w-full">
            <TabsList>
              <TabsTrigger value="current">Current Properties</TabsTrigger>
              <TabsTrigger value="add">Add Property</TabsTrigger>
            </TabsList>
            
            <TabsContent value="current" className="space-y-4">
              <h4 className="font-medium">Current Property Relationships</h4>
              
              {managingProperties?.properties && managingProperties.properties.length > 0 ? (
                <div className="space-y-3">
                  {managingProperties.properties.map((property) => (
                    <div key={property.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {property.is_primary && <Crown className="w-4 h-4 text-yellow-500" />}
                          <span className="font-medium">{property.name}</span>
                          {property.is_primary && (
                            <Badge variant="secondary" className="text-xs">Primary</Badge>
                          )}
                        </div>
                        {property.address && (
                          <p className="text-sm text-muted-foreground mt-1">{property.address}</p>
                        )}
                        <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Ownership: {property.ownership_percent}%</span>
                          <span>Disbursement: {property.disbursement_percent}%</span>
                        </div>
                      </div>
                      
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemovePropertyOwnership(property.id)}
                        disabled={propertyLoading}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No property relationships found</p>
                  <p className="text-sm">Add property relationships using the "Add Property" tab</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="add" className="space-y-4">
              <form onSubmit={handleAddPropertyOwnership} className="space-y-4">
                <div>
                  <Label htmlFor="property-id">Property ID *</Label>
                  <Input
                    id="property-id"
                    value={propertyForm.propertyId}
                    onChange={(e) => setPropertyForm(prev => ({ ...prev, propertyId: e.target.value }))}
                    placeholder="Enter property ID"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the UUID of the property from the properties table
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ownership-percent">Ownership Percent *</Label>
                    <Input
                      id="ownership-percent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={propertyForm.ownershipPercent}
                      onChange={(e) => setPropertyForm(prev => ({ ...prev, ownershipPercent: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="disbursement-percent">Disbursement Percent *</Label>
                    <Input
                      id="disbursement-percent"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={propertyForm.disbursementPercent}
                      onChange={(e) => setPropertyForm(prev => ({ ...prev, disbursementPercent: parseFloat(e.target.value) || 0 }))}
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is-primary"
                    checked={propertyForm.isPrimary}
                    onChange={(e) => setPropertyForm(prev => ({ ...prev, isPrimary: e.target.checked }))}
                  />
                  <Label htmlFor="is-primary">Set as primary owner for this property</Label>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button type="submit" disabled={propertyLoading}>
                    {propertyLoading ? "Adding..." : "Add Ownership"}
                  </Button>
                </div>
              </form>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}