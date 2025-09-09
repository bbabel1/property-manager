import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Plus, Search, Phone, Mail, Calendar, Users, AlertCircle, RefreshCw, Database } from "lucide-react";
import { projectId } from '../utils/supabase/info';

interface Tenant {
  id: string;
  name: string;
  email: string;
  phone: string;
  property: string;
  unit: string;
  rent: number;
  leaseStart: string;
  leaseEnd: string;
  status: string;
  paymentStatus: string;
  source?: string;
}

interface Property {
  id: string;
  name: string;
}

interface TenantsProps {
  accessToken?: string;
}

export function Tenants({ accessToken }: TenantsProps) {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataAvailable, setDataAvailable] = useState(false);
  const [error, setError] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    property: "",
    unit: "",
    rent: ""
  });

  useEffect(() => {
    if (accessToken) {
      fetchTenants();
      fetchProperties();
    } else {
      setTenants([]);
      setProperties([]);
      setDataAvailable(false);
      setLoading(false);
      setError('Authentication required');
      setLastUpdated(new Date().toLocaleString());
    }
  }, [accessToken]);

  const fetchTenants = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    setError('');
    
    try {
      console.log('📋 Fetching tenants from Supabase (real data only)...');
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/tenants`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Tenants response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Tenants data received:', data);
        
        const tenantsList = data.tenants || [];
        setTenants(tenantsList);
        setDataAvailable(tenantsList.length > 0);
        setError('');
        
        console.log(`📊 Found ${tenantsList.length} tenants in database`);
      } else {
        const errorText = await response.text();
        console.log('❌ Tenants endpoint failed:', errorText);
        setTenants([]);
        setDataAvailable(false);
        setError(`Backend error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.log('❌ Network error fetching tenants:', error);
      setTenants([]);
      setDataAvailable(false);
      setError(`Network error: ${error}`);
    } finally {
      setLoading(false);
      setLastUpdated(new Date().toLocaleString());
    }
  };

  const fetchProperties = async () => {
    if (!accessToken) return;
    
    try {
      console.log('🏠 Fetching properties for tenant form...');
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/properties`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const propertiesList = (data.properties || []).map((prop: any) => ({
          id: prop.id,
          name: prop.name || `${prop.address}` || 'Property'
        }));
        setProperties(propertiesList);
        console.log(`✅ Found ${propertiesList.length} properties for tenant form`);
      } else {
        console.log('⚠️ Properties endpoint not available for tenant form');
        setProperties([]);
      }
    } catch (error) {
      console.log('⚠️ Could not fetch properties for tenant form:', error);
      setProperties([]);
    }
  };

  const handleAddTenant = async () => {
    if (!accessToken || !formData.name || !formData.email || !formData.property || !formData.rent) {
      alert('Please fill in all required fields');
      return;
    }

    setCreating(true);
    try {
      console.log('Creating new tenant (real data only):', formData);
      
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/tenants`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Tenant created successfully:', data);
        
        // Add to local state if we got the tenant back
        if (data.tenant) {
          setTenants(prev => [...prev, data.tenant]);
          setDataAvailable(true);
        }
        
        // Reset form and close dialog
        setFormData({ name: "", email: "", phone: "", property: "", unit: "", rent: "" });
        setIsAddDialogOpen(false);
        
        // Refresh the list
        await fetchTenants();
      } else {
        const errorText = await response.text();
        console.error('❌ Failed to create tenant:', errorText);
        alert(`Failed to create tenant: ${errorText}`);
      }
    } catch (error) {
      console.error('❌ Error creating tenant:', error);
      alert(`Network error creating tenant: ${error}`);
    } finally {
      setCreating(false);
    }
  };

  const getDataSourceBadge = () => {
    if (loading) {
      return (
        <Badge variant="outline">
          <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
          Loading...
        </Badge>
      );
    }
    
    if (error) {
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Backend Error
        </Badge>
      );
    }
    
    if (dataAvailable) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-200">
          <Database className="w-3 h-3 mr-1" />
          Live Supabase Data
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary" className="bg-gray-100 text-gray-800 hover:bg-gray-200">
        <AlertCircle className="w-3 h-3 mr-1" />
        No Data
      </Badge>
    );
  };

  const filteredTenants = tenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.property.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!accessToken) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1>Tenants</h1>
          <p className="text-muted-foreground">Please sign in to manage tenants</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1>Tenants</h1>
            {getDataSourceBadge()}
          </div>
          <p className="text-muted-foreground">Manage tenant information and leases</p>
          
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Backend Not Available</AlertTitle>
              <AlertDescription>
                Cannot connect to Supabase. Error: {error}
              </AlertDescription>
            </Alert>
          )}
          
          {!loading && !error && !dataAvailable && (
            <div className="mt-2 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800 font-medium mb-2">
                🎉 Ready to Add Tenants!
              </p>
              <p className="text-xs text-blue-700">
                Your database is connected. Add your first tenant to get started.
              </p>
            </div>
          )}
          
          {!loading && dataAvailable && (
            <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                ✅ Showing real tenant data from your Supabase database.
              </p>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTenants}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!!error || creating}>
                {creating ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                {creating ? 'Creating...' : 'Add Tenant'}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New Tenant</DialogTitle>
                <DialogDescription>
                  Enter the tenant's information and lease details.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="tenant-name" className="text-right">
                    Name *
                  </Label>
                  <Input 
                    id="tenant-name" 
                    className="col-span-3" 
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Full name"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="tenant-email" className="text-right">
                    Email *
                  </Label>
                  <Input 
                    id="tenant-email" 
                    type="email" 
                    className="col-span-3" 
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="tenant-phone" className="text-right">
                    Phone
                  </Label>
                  <Input 
                    id="tenant-phone" 
                    className="col-span-3" 
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="property" className="text-right">
                    Property *
                  </Label>
                  <Select value={formData.property} onValueChange={(value) => setFormData(prev => ({ ...prev, property: value }))}>
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.length === 0 ? (
                        <SelectItem value="" disabled>
                          No properties available - Add a property first
                        </SelectItem>
                      ) : (
                        properties.map((property) => (
                          <SelectItem key={property.id} value={property.name}>
                            {property.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="unit" className="text-right">
                    Unit
                  </Label>
                  <Input 
                    id="unit" 
                    className="col-span-3" 
                    value={formData.unit}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                    placeholder="Unit number or name"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="rent" className="text-right">
                    Rent * ($)
                  </Label>
                  <Input 
                    id="rent" 
                    type="number" 
                    className="col-span-3" 
                    value={formData.rent}
                    onChange={(e) => setFormData(prev => ({ ...prev, rent: e.target.value }))}
                    placeholder="Monthly rent amount"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setIsAddDialogOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddTenant}
                  disabled={
                    !formData.name || 
                    !formData.email || 
                    !formData.property || 
                    !formData.rent ||
                    creating
                  }
                >
                  {creating ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {creating ? 'Creating...' : 'Add Tenant'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tenants..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredTenants.length} tenant{filteredTenants.length !== 1 ? 's' : ''}
        </div>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center p-8">
          <RefreshCw className="w-6 h-6 animate-spin mr-2" />
          <p>Loading tenants from Supabase...</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Tenants</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTenants.length === 0 ? (
              <div className="text-center p-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {error ? 'Backend Error' : 
                   searchTerm ? 'No tenants found' : 'No tenants in database'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {error 
                    ? 'Cannot connect to Supabase. Please check your backend configuration.'
                    : searchTerm
                    ? "No tenants match your search criteria."
                    : "Your database is empty. Add your first tenant to get started."}
                </p>
                {!error && !searchTerm && (
                  <Button onClick={() => setIsAddDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add First Tenant
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Rent</TableHead>
                    <TableHead>Lease End</TableHead>
                    <TableHead>Payment Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTenants.map((tenant) => (
                    <TableRow key={tenant.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{tenant.name}</div>
                          <div className="flex items-center text-sm text-muted-foreground mt-1">
                            <Mail className="w-3 h-3 mr-1" />
                            {tenant.email}
                          </div>
                          {tenant.phone && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Phone className="w-3 h-3 mr-1" />
                              {tenant.phone}
                            </div>
                          )}
                          {tenant.source === 'database' && (
                            <div className="text-xs text-muted-foreground mt-1">
                              ID: {tenant.id.substring(0, 8)}...
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{tenant.property}</TableCell>
                      <TableCell>{tenant.unit || '-'}</TableCell>
                      <TableCell>${tenant.rent.toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(tenant.leaseEnd).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={tenant.paymentStatus === "Current" ? "default" : "destructive"}>
                          {tenant.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">View</Button>
                          <Button variant="outline" size="sm">Edit</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}