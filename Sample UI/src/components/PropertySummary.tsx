import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Building2, MapPin, Calendar, Users, DollarSign, Edit, Phone, Mail, Camera, Eye, CreditCard, PiggyBank, Banknote, X } from "lucide-react";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { PropertyManagerSearch } from "./PropertyManagerSearch";
import type { Property } from "../utils/mockData";

interface PropertyManager {
  id: string;
  staffId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title: string;
  status: string;
  fullName: string;
}

interface PropertySummaryProps {
  property: Property;
}

export function PropertySummary({ property }: PropertySummaryProps) {
  const [editMode, setEditMode] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [bankingEditDialogOpen, setBankingEditDialogOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [selectedPropertyManager, setSelectedPropertyManager] = useState<PropertyManager | null>(null);
  
  // Form state for editing
  const [editForm, setEditForm] = useState({
    streetAddress: "",
    city: "",
    state: "",
    zip: "",
    country: "United States",
    rentalOwners: [] as Array<{ name: string; percentage: number }>
  });

  // Banking form state
  const [bankingForm, setBankingForm] = useState({
    operatingAccount: "",
    depositTrustAccount: "",
    propertyReserveAmount: 0
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Initialize form data when property changes
  useEffect(() => {
    if (property) {
      // Parse the address from the mock data format
      const streetAddress = property.address || "";
      const city = property.city || "";
      const state = property.state || "";
      const zip = property.zip || "";
      
      setEditForm({
        streetAddress,
        city,
        state,
        zip,
        country: "United States",
        rentalOwners: []
      });

      // No property manager in mock data, so set to null
      setSelectedPropertyManager(null);
    }
  }, [property]);

  const handleSaveEdit = async () => {
    if (!property) return;
    
    setSaveLoading(true);
    try {
      console.log("💾 Mock save - property details:", editForm, selectedPropertyManager);
      
      // Simulate save delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setEditDialogOpen(false);
      alert('Property details updated successfully! (Mock implementation)');
    } catch (error: any) {
      console.error("❌ Update property error:", error);
      alert(`Error updating property: ${error.message}`);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setEditDialogOpen(false);
    
    // Reset form to original values
    if (property) {
      const streetAddress = property.address || "";
      const city = property.city || "";
      const state = property.state || "";
      const zip = property.zip || "";
      
      setEditForm({
        streetAddress,
        city,
        state,
        zip,
        country: "United States",
        rentalOwners: []
      });
      
      setSelectedPropertyManager(null);
    }
  };

  // Mock financial data - in a real app this would come from the API
  const financialData = {
    cashBalance: 3061.80,
    securityDeposits: 875.00,
    propertyReserve: 200.00,
    available: 2576.80,
    operatingAccount: "Trust account 4321",
    depositTrustAccount: "Setup",
    propertyReserveAmount: 200.00
  };

  // Initialize banking form with current financial data
  useEffect(() => {
    setBankingForm({
      operatingAccount: financialData.operatingAccount,
      depositTrustAccount: financialData.depositTrustAccount,
      propertyReserveAmount: financialData.propertyReserveAmount
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Property Details and Location */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Property Details</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setEditDialogOpen(true)}>
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: Property Image */}
                <div className="relative">
                  <div className="aspect-video w-full bg-muted rounded-lg overflow-hidden">
                    <ImageWithFallback
                      src={`https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=450&fit=crop&crop=center`}
                      alt={property.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <Button variant="secondary" size="sm">
                      <Camera className="w-4 h-4 mr-2" />
                      Replace photo
                    </Button>
                  </div>
                </div>

                {/* Column 2: Property Information */}
                <div className="space-y-6">
                  {/* Address */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">ADDRESS</label>
                    <div className="mt-1">
                      <div className="space-y-1">
                        <p className="font-medium">{property.address}</p>
                        <p className="text-muted-foreground">{property.city}, {property.state} {property.zip}</p>
                        <Button variant="link" className="p-0 h-auto text-sm text-blue-600">
                          📍 Map it
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Property Manager */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">PROPERTY MANAGER</label>
                    <div className="mt-1">
                      <p className="text-muted-foreground">No manager assigned</p>
                    </div>
                  </div>

                  {/* Property Type and Units */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">PROPERTY TYPE</label>
                    <div className="mt-1">
                      <p className="font-medium">{property.type}</p>
                      
                    </div>
                  </div>

                  {/* Rental Owners */}
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">RENTAL OWNERS</label>
                    <div className="mt-2">
                      <p className="text-muted-foreground">No ownership information available</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Location</CardTitle>
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: Geographic Information */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">BOROUGH</label>
                    <p className="font-medium mt-1">Manhattan</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">NEIGHBORHOOD</label>
                    <p className="font-medium mt-1">Downtown</p>
                  </div>
                </div>

                {/* Column 2: Coordinates and Verification */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">LONGITUDE</label>
                      <p className="font-medium mt-1">-118.2437</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">LATITUDE</label>
                      <p className="font-medium mt-1">34.0522</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">LOCATION VERIFIED</label>
                    <div className="mt-1">
                      <Badge className="bg-green-100 text-green-800">
                        Verified
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Integrations Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Integrations</CardTitle>
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Column 1: Left Side Fields */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">SYNC TO BUILDIUM</label>
                    <div className="text-green-600">✓</div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">PLUTO RESPONSE</label>
                    <div className="text-green-600">✓</div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">HPD RESPONSE</label>
                    <div className="text-green-600">✓</div>
                  </div>
                </div>

                {/* Column 2: Right Side Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">BUILDIUM PROPERTY ID</label>
                    <p className="font-medium mt-1">7643</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">NYC GEO RESPONSE</label>
                    <span className="text-muted-foreground">-</span>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">PLACE ID</label>
                    <p className="font-medium mt-1 text-sm break-all">ChIJT8aEcKZZwokRk8mXAKJIpEM</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">HPD REGISTRATION RESPONSE</label>
                    <div className="text-green-600">✓</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Financial Information */}
        <div className="lg:col-span-1 space-y-6">
          {/* Cash Balance Card */}
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Cash balance:</span>
                  <span className="font-medium">{formatCurrency(financialData.cashBalance)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">- Security deposits and early payments:</span>
                  <span className="font-medium">{formatCurrency(financialData.securityDeposits)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">- Property reserve:</span>
                  <span className="font-medium">{formatCurrency(financialData.propertyReserve)}</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Available:</span>
                    <span className="font-medium">{formatCurrency(financialData.available)}</span>
                  </div>
                </div>
                <Button variant="link" className="p-0 h-auto text-sm text-blue-600">
                  View income statement
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Banking Details Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Banking details</CardTitle>
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-sm text-blue-600"
                  onClick={() => setBankingEditDialogOpen(true)}
                >
                  Edit
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">OPERATING ACCOUNT</label>
                <div className="mt-1 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{financialData.operatingAccount}</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">DEPOSIT TRUST ACCOUNT</label>
                <div className="mt-1">
                  <Button variant="link" className="p-0 h-auto text-sm text-blue-600">
                    {financialData.depositTrustAccount}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wide">PROPERTY RESERVE</label>
                <div className="mt-1">
                  <span className="font-medium">{formatCurrency(financialData.propertyReserveAmount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Property Details Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <DialogTitle className="text-lg font-medium">Edit property details</DialogTitle>
              <DialogDescription>
                Update property address, manager, and rental owner information.
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditDialogOpen(false)}
              className="h-auto p-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogHeader>

          <div className="space-y-6">
            {/* Address Section */}
            <div className="space-y-4">
              <h3 className="text-base font-medium">Address</h3>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="street-address" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    STREET ADDRESS
                  </Label>
                  <Input
                    id="street-address"
                    value={editForm.streetAddress}
                    onChange={(e) => setEditForm(prev => ({ ...prev, streetAddress: e.target.value }))}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="city" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      CITY
                    </Label>
                    <Input
                      id="city"
                      value={editForm.city}
                      onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="state" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      STATE
                    </Label>
                    <Select value={editForm.state} onValueChange={(value) => setEditForm(prev => ({ ...prev, state: value }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select state" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AL">AL</SelectItem>
                        <SelectItem value="AK">AK</SelectItem>
                        <SelectItem value="AZ">AZ</SelectItem>
                        <SelectItem value="AR">AR</SelectItem>
                        <SelectItem value="CA">CA</SelectItem>
                        <SelectItem value="CO">CO</SelectItem>
                        <SelectItem value="CT">CT</SelectItem>
                        <SelectItem value="DE">DE</SelectItem>
                        <SelectItem value="FL">FL</SelectItem>
                        <SelectItem value="GA">GA</SelectItem>
                        <SelectItem value="HI">HI</SelectItem>
                        <SelectItem value="ID">ID</SelectItem>
                        <SelectItem value="IL">IL</SelectItem>
                        <SelectItem value="IN">IN</SelectItem>
                        <SelectItem value="IA">IA</SelectItem>
                        <SelectItem value="KS">KS</SelectItem>
                        <SelectItem value="KY">KY</SelectItem>
                        <SelectItem value="LA">LA</SelectItem>
                        <SelectItem value="ME">ME</SelectItem>
                        <SelectItem value="MD">MD</SelectItem>
                        <SelectItem value="MA">MA</SelectItem>
                        <SelectItem value="MI">MI</SelectItem>
                        <SelectItem value="MN">MN</SelectItem>
                        <SelectItem value="MS">MS</SelectItem>
                        <SelectItem value="MO">MO</SelectItem>
                        <SelectItem value="MT">MT</SelectItem>
                        <SelectItem value="NE">NE</SelectItem>
                        <SelectItem value="NV">NV</SelectItem>
                        <SelectItem value="NH">NH</SelectItem>
                        <SelectItem value="NJ">NJ</SelectItem>
                        <SelectItem value="NM">NM</SelectItem>
                        <SelectItem value="NY">NY</SelectItem>
                        <SelectItem value="NC">NC</SelectItem>
                        <SelectItem value="ND">ND</SelectItem>
                        <SelectItem value="OH">OH</SelectItem>
                        <SelectItem value="OK">OK</SelectItem>
                        <SelectItem value="OR">OR</SelectItem>
                        <SelectItem value="PA">PA</SelectItem>
                        <SelectItem value="RI">RI</SelectItem>
                        <SelectItem value="SC">SC</SelectItem>
                        <SelectItem value="SD">SD</SelectItem>
                        <SelectItem value="TN">TN</SelectItem>
                        <SelectItem value="TX">TX</SelectItem>
                        <SelectItem value="UT">UT</SelectItem>
                        <SelectItem value="VT">VT</SelectItem>
                        <SelectItem value="VA">VA</SelectItem>
                        <SelectItem value="WA">WA</SelectItem>
                        <SelectItem value="WV">WV</SelectItem>
                        <SelectItem value="WI">WI</SelectItem>
                        <SelectItem value="WY">WY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="zip" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      ZIP
                    </Label>
                    <Input
                      id="zip"
                      value={editForm.zip}
                      onChange={(e) => setEditForm(prev => ({ ...prev, zip: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="country" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    COUNTRY
                  </Label>
                  <Select value={editForm.country} onValueChange={(value) => setEditForm(prev => ({ ...prev, country: value }))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="United States">United States</SelectItem>
                      <SelectItem value="Canada">Canada</SelectItem>
                      <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Property Manager Section */}
            <div className="space-y-4">
              <h3 className="text-base font-medium">Property manager</h3>
              
              <div>
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  PROPERTY MANAGER
                </Label>
                <div className="mt-1">
                  <PropertyManagerSearch
                    selectedManager={selectedPropertyManager}
                    onSelectManager={setSelectedPropertyManager}
                    placeholder="Select a staff member..."
                  />
                </div>
              </div>
            </div>

            {/* Rental Owners Section */}
            <div className="space-y-4">
              <h3 className="text-base font-medium">Rental owners</h3>
              
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        OWNER
                      </TableHead>
                      <TableHead className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">
                        OWNERSHIP PERCENTAGE
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editForm.rentalOwners.map((owner, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{owner.name}</TableCell>
                        <TableCell className="text-right">{owner.percentage}%</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2">
                      <TableCell className="font-medium">Total</TableCell>
                      <TableCell className="text-right font-medium">
                        {editForm.rentalOwners.reduce((sum, owner) => sum + owner.percentage, 0)}%
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-start gap-3 pt-4">
              <Button 
                onClick={handleSaveEdit} 
                disabled={saveLoading}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {saveLoading ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={handleCancelEdit} disabled={saveLoading}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Banking Details Edit Dialog */}
      <Dialog open={bankingEditDialogOpen} onOpenChange={setBankingEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Banking Details</DialogTitle>
            <DialogDescription>
              Update the banking information for this property.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="operating-account">Operating Account</Label>
              <Input
                id="operating-account"
                value={bankingForm.operatingAccount}
                onChange={(e) => setBankingForm(prev => ({ ...prev, operatingAccount: e.target.value }))}
                placeholder="Enter operating account details"
              />
            </div>
            <div>
              <Label htmlFor="deposit-trust">Deposit Trust Account</Label>
              <Input
                id="deposit-trust"
                value={bankingForm.depositTrustAccount}
                onChange={(e) => setBankingForm(prev => ({ ...prev, depositTrustAccount: e.target.value }))}
                placeholder="Enter deposit trust account"
              />
            </div>
            <div>
              <Label htmlFor="property-reserve">Property Reserve Amount</Label>
              <Input
                id="property-reserve"
                type="number"
                step="0.01"
                value={bankingForm.propertyReserveAmount}
                onChange={(e) => setBankingForm(prev => ({ ...prev, propertyReserveAmount: parseFloat(e.target.value) || 0 }))}
                placeholder="0.00"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setBankingEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                console.log('Banking details save clicked:', bankingForm);
                setBankingEditDialogOpen(false);
                alert('Banking details updated! (Demo mode - no actual save)');
              }}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}