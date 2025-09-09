import { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Building2, Plus, MapPin, DollarSign, Users, Home } from "lucide-react";
import { toast } from "sonner@2.0.3";
import { mockOwners, mockBankAccounts, type Property, type Owner, type BankAccount } from "../utils/mockData";

interface AddPropertyDialogProps {
  onPropertyAdded: (property: Property) => void;
}

export function AddPropertyDialog({ onPropertyAdded }: AddPropertyDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  
  // Form data
  const [propertyData, setPropertyData] = useState({
    name: "",
    type: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    country: "",
    year_built: "",
    description: ""
  });
  
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [reserve, setReserve] = useState<string>("");
  const [selectedManagerId, setSelectedManagerId] = useState<string>("");
  const [showCreateOwner, setShowCreateOwner] = useState(false);
  const [newOwnerData, setNewOwnerData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: ""
  });
  const [createdOwners, setCreatedOwners] = useState<Array<{id: string, first_name: string, last_name: string, email: string, phone?: string}>>([]);
  const [ownershipData, setOwnershipData] = useState<Record<string, {ownership_percentage: number, disbursement_percentage: number, is_primary: boolean}>>({});
  const [primaryOwnerId, setPrimaryOwnerId] = useState<string>("");

  const propertyTypes = [
    "CondoTownhome",
    "MultiFamily", 
    "SingleFamily",
    "Industrial",
    "Office",
    "Retail",
    "ShoppingCenter",
    "Storage",
    "ParkingSpace"
  ];

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get all owners (selected + created) for display
      const allOwners = [
        ...mockOwners.filter(owner => selectedOwnerIds.includes(owner.id)),
        ...createdOwners
      ];
      
      const primaryOwnerName = allOwners.length > 0 ? `${allOwners[0].first_name} ${allOwners[0].last_name}` : null;
      
      // Create new property with mock data structure
      const newProperty: Property = {
        id: Date.now().toString(), // Simple ID generation for demo
        name: propertyData.name,
        address: propertyData.address,
        city: propertyData.city,
        state: propertyData.state,
        zip: propertyData.zip,
        type: propertyData.type,
        units_count: 1, // Default to 1 unit
        totalUnits: 1,
        occupiedUnits: 0, // New property starts with no tenants
        availableUnits: 1,
        country: propertyData.country,
        totalOwners: selectedOwnerIds.length + createdOwners.length,
        primaryOwner: primaryOwnerName,
        operating_bank_account_id: selectedBankAccountId || undefined,
        status: 'active', // New properties default to active status
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Call the callback to add the property to the list
      onPropertyAdded(newProperty);
      
      toast.success("Property created successfully!");
      
      // Reset form and close dialog
      setPropertyData({
        name: "",
        type: "",
        address: "",
        city: "",
        state: "",
        zip: "",
        country: "",
        year_built: "",
        description: ""
      });
      setSelectedOwnerIds([]);
      setSelectedBankAccountId("");
      setReserve("");
      setSelectedManagerId("");
      setShowCreateOwner(false);
      setNewOwnerData({
        first_name: "",
        last_name: "",
        email: "",
        phone: ""
      });
      setCreatedOwners([]);
      setOwnershipData({});
      setPrimaryOwnerId("");
      setCurrentStep(1);
      setOpen(false);
      
    } catch (error: any) {
      console.error('Error creating property:', error);
      toast.error("Failed to create property. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setCurrentStep(prev => Math.min(prev + 1, 5));
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const isStepValid = (step: number) => {
    switch (step) {
      case 1:
        return propertyData.type !== "";
      case 2:
        return propertyData.name && propertyData.address && propertyData.city && propertyData.state && propertyData.zip && propertyData.country;
      case 3:
        return selectedOwnerIds.length > 0 || createdOwners.length > 0; // At least one owner is required
      case 4:
        return true; // Bank account is optional
      case 5:
        return true; // Manager is optional
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Building2 className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-medium">Property Type</h3>
              <p className="text-sm text-muted-foreground">What type of property are you adding?</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {propertyTypes.map((type) => (
                <Button
                  key={type}
                  variant={propertyData.type === type ? "default" : "outline"}
                  className="h-16 flex-col gap-1"
                  onClick={() => setPropertyData(prev => ({ ...prev, type }))}
                >
                  <Home className="w-5 h-5" />
                  <span className="text-sm">{type}</span>
                </Button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <MapPin className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-medium">Property Details</h3>
              <p className="text-sm text-muted-foreground">Enter the property address and basic information</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Property Name *</Label>
                <Input
                  id="name"
                  value={propertyData.name}
                  onChange={(e) => setPropertyData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Sunset Apartments"
                />
              </div>

              <div>
                <Label htmlFor="address">Street Address *</Label>
                <Input
                  id="address"
                  value={propertyData.address}
                  onChange={(e) => setPropertyData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="e.g., 123 Main Street"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    value={propertyData.city}
                    onChange={(e) => setPropertyData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="e.g., Los Angeles"
                  />
                </div>
                <div>
                  <Label htmlFor="state">State *</Label>
                  <Input
                    id="state"
                    value={propertyData.state}
                    onChange={(e) => setPropertyData(prev => ({ ...prev, state: e.target.value }))}
                    placeholder="e.g., CA"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="zip">ZIP Code *</Label>
                  <Input
                    id="zip"
                    value={propertyData.zip}
                    onChange={(e) => setPropertyData(prev => ({ ...prev, zip: e.target.value }))}
                    placeholder="e.g., 90210"
                  />
                </div>
                <div>
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    value={propertyData.country}
                    onChange={(e) => setPropertyData(prev => ({ ...prev, country: e.target.value }))}
                    placeholder="e.g., United States"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="year-built">Year Built (Optional)</Label>
                <Input
                  id="year-built"
                  type="number"
                  min="1800"
                  max={new Date().getFullYear()}
                  value={propertyData.year_built}
                  onChange={(e) => setPropertyData(prev => ({ ...prev, year_built: e.target.value }))}
                  placeholder="e.g., 1995"
                />
              </div>

              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={propertyData.description}
                  onChange={(e) => setPropertyData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of the property..."
                  className="min-h-[80px]"
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Users className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-medium">Ownership</h3>
              <p className="text-sm text-muted-foreground">Select the owners related to this property</p>
            </div>

            <div className="space-y-3">
              <Label>Add Owners *</Label>
              <Select 
                value="" 
                onValueChange={(value) => {
                  if (value === "create-new") {
                    setShowCreateOwner(true);
                  } else if (value && !selectedOwnerIds.includes(value)) {
                    const newOwnerIds = [...selectedOwnerIds, value];
                    setSelectedOwnerIds(newOwnerIds);
                    
                    // Set as primary if first owner
                    const isFirstOwner = selectedOwnerIds.length === 0 && createdOwners.length === 0;
                    
                    setOwnershipData(prev => ({
                      ...prev,
                      [value]: {
                        ownership_percentage: 100,
                        disbursement_percentage: 100,
                        is_primary: isFirstOwner
                      }
                    }));
                    
                    if (isFirstOwner) {
                      setPrimaryOwnerId(value);
                    }
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose owners to add..." />
                </SelectTrigger>
                <SelectContent>
                  {mockOwners
                    .filter(owner => !selectedOwnerIds.includes(owner.id))
                    .map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.first_name} {owner.last_name}
                    </SelectItem>
                  ))}
                  <SelectItem value="create-new">
                    <span className="text-primary font-medium">+ Create New Owner</span>
                  </SelectItem>
                </SelectContent>
              </Select>
              
              {/* Selected Owners Display */}
              {(selectedOwnerIds.length > 0 || createdOwners.length > 0) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Selected Owners</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedOwnerIds.map((ownerId) => {
                      const owner = mockOwners.find(o => o.id === ownerId);
                      const ownerData = ownershipData[ownerId];
                      return owner ? (
                        <div key={ownerId} className="p-4 border rounded-md space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="font-medium">{owner.first_name} {owner.last_name}</div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedOwnerIds(prev => prev.filter(id => id !== ownerId));
                                setOwnershipData(prev => {
                                  const newData = { ...prev };
                                  delete newData[ownerId];
                                  return newData;
                                });
                                if (primaryOwnerId === ownerId) {
                                  setPrimaryOwnerId("");
                                }
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              Remove
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-sm">Ownership %</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={ownerData?.ownership_percentage || 0}
                                onChange={(e) => setOwnershipData(prev => ({
                                  ...prev,
                                  [ownerId]: {
                                    ...prev[ownerId],
                                    ownership_percentage: Number(e.target.value)
                                  }
                                }))}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">Disbursement %</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={ownerData?.disbursement_percentage || 0}
                                onChange={(e) => setOwnershipData(prev => ({
                                  ...prev,
                                  [ownerId]: {
                                    ...prev[ownerId],
                                    disbursement_percentage: Number(e.target.value)
                                  }
                                }))}
                                className="h-8"
                              />
                            </div>
                            <div className="flex items-center space-x-2 pt-5">
                              <input
                                type="checkbox"
                                id={`primary-${ownerId}`}
                                checked={primaryOwnerId === ownerId}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setPrimaryOwnerId(ownerId);
                                    setOwnershipData(prev => {
                                      const newData = { ...prev };
                                      // Remove primary from all others
                                      Object.keys(newData).forEach(id => {
                                        newData[id] = { ...newData[id], is_primary: false };
                                      });
                                      // Set this one as primary
                                      newData[ownerId] = { ...newData[ownerId], is_primary: true };
                                      return newData;
                                    });
                                  }
                                }}
                              />
                              <Label htmlFor={`primary-${ownerId}`} className="text-sm">Primary</Label>
                            </div>
                          </div>
                        </div>
                      ) : null;
                    })}
                    {createdOwners.map((owner) => {
                      const ownerData = ownershipData[owner.id];
                      return (
                        <div key={owner.id} className="p-4 border rounded-md space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{owner.first_name} {owner.last_name}</div>
                              <Badge variant="secondary" className="text-xs mt-1">New Owner</Badge>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setCreatedOwners(prev => prev.filter(o => o.id !== owner.id));
                                setOwnershipData(prev => {
                                  const newData = { ...prev };
                                  delete newData[owner.id];
                                  return newData;
                                });
                                if (primaryOwnerId === owner.id) {
                                  setPrimaryOwnerId("");
                                }
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              Remove
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-sm">Ownership %</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={ownerData?.ownership_percentage || 0}
                                onChange={(e) => setOwnershipData(prev => ({
                                  ...prev,
                                  [owner.id]: {
                                    ...prev[owner.id],
                                    ownership_percentage: Number(e.target.value)
                                  }
                                }))}
                                className="h-8"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">Disbursement %</Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={ownerData?.disbursement_percentage || 0}
                                onChange={(e) => setOwnershipData(prev => ({
                                  ...prev,
                                  [owner.id]: {
                                    ...prev[owner.id],
                                    disbursement_percentage: Number(e.target.value)
                                  }
                                }))}
                                className="h-8"
                              />
                            </div>
                            <div className="flex items-center space-x-2 pt-5">
                              <input
                                type="checkbox"
                                id={`primary-${owner.id}`}
                                checked={primaryOwnerId === owner.id}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setPrimaryOwnerId(owner.id);
                                    setOwnershipData(prev => {
                                      const newData = { ...prev };
                                      // Remove primary from all others
                                      Object.keys(newData).forEach(id => {
                                        newData[id] = { ...newData[id], is_primary: false };
                                      });
                                      // Set this one as primary
                                      newData[owner.id] = { ...newData[owner.id], is_primary: true };
                                      return newData;
                                    });
                                  }
                                }}
                              />
                              <Label htmlFor={`primary-${owner.id}`} className="text-sm">Primary</Label>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {showCreateOwner && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Create New Owner</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="owner-first-name">First Name *</Label>
                        <Input
                          id="owner-first-name"
                          value={newOwnerData.first_name}
                          onChange={(e) => setNewOwnerData(prev => ({ ...prev, first_name: e.target.value }))}
                          placeholder="e.g., John"
                        />
                      </div>
                      <div>
                        <Label htmlFor="owner-last-name">Last Name *</Label>
                        <Input
                          id="owner-last-name"
                          value={newOwnerData.last_name}
                          onChange={(e) => setNewOwnerData(prev => ({ ...prev, last_name: e.target.value }))}
                          placeholder="e.g., Smith"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="owner-email">Email *</Label>
                      <Input
                        id="owner-email"
                        type="email"
                        value={newOwnerData.email}
                        onChange={(e) => setNewOwnerData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="e.g., john.smith@example.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="owner-phone">Phone (Optional)</Label>
                      <Input
                        id="owner-phone"
                        type="tel"
                        value={newOwnerData.phone}
                        onChange={(e) => setNewOwnerData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="e.g., (555) 123-4567"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        onClick={() => {
                          if (newOwnerData.first_name && newOwnerData.last_name && newOwnerData.email) {
                            const newOwner = {
                              id: `new-${Date.now()}`,
                              ...newOwnerData
                            };
                            setCreatedOwners(prev => [...prev, newOwner]);
                            
                            // Set as primary if first owner
                            const isFirstOwner = selectedOwnerIds.length === 0 && createdOwners.length === 0;
                            
                            setOwnershipData(prev => ({
                              ...prev,
                              [newOwner.id]: {
                                ownership_percentage: 100,
                                disbursement_percentage: 100,
                                is_primary: isFirstOwner
                              }
                            }));
                            
                            if (isFirstOwner) {
                              setPrimaryOwnerId(newOwner.id);
                            }
                            
                            setNewOwnerData({
                              first_name: "",
                              last_name: "",
                              email: "",
                              phone: ""
                            });
                            setShowCreateOwner(false);
                          }
                        }}
                        disabled={!newOwnerData.first_name || !newOwnerData.last_name || !newOwnerData.email}
                      >
                        Add Owner
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowCreateOwner(false);
                          setNewOwnerData({
                            first_name: "",
                            last_name: "",
                            email: "",
                            phone: ""
                          });
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <DollarSign className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-medium">Bank Account</h3>
              <p className="text-sm text-muted-foreground">Select the operating bank account for this property</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Operating Bank Account (Optional)</Label>
                <Select value={selectedBankAccountId} onValueChange={setSelectedBankAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a bank account..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mockBankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name} (...{account.account_last4})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="reserve">Reserve Amount (Optional)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="reserve"
                    type="number"
                    min="0"
                    step="0.01"
                    value={reserve}
                    onChange={(e) => setReserve(e.target.value)}
                    placeholder="0.00"
                    className="pl-8"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Minimum amount to maintain in the account
                </p>
              </div>
              
              {selectedBankAccountId && (
                <Card>
                  <CardContent className="pt-4">
                    {(() => {
                      const account = mockBankAccounts.find(a => a.id === selectedBankAccountId);
                      return account ? (
                        <div className="space-y-2">
                          <div className="font-medium">{account.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Account ending in {account.account_last4}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Routing: ...{account.routing_last4}
                          </div>
                          {reserve && (
                            <div className="text-sm text-muted-foreground">
                              Reserve: ${Number(reserve).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          )}
                        </div>
                      ) : null;
                    })()}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <Users className="w-12 h-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-medium">Property Manager</h3>
              <p className="text-sm text-muted-foreground">Assign a property manager (optional)</p>
            </div>

            <div className="space-y-3">
              <Label>Property Manager (Optional)</Label>
              <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a manager..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">John Smith</SelectItem>
                  <SelectItem value="2">Sarah Johnson</SelectItem>
                  <SelectItem value="3">Michael Brown</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="mt-6 p-4 bg-muted/30 rounded-md">
                <h4 className="font-medium mb-2">Property Summary</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Property:</span>
                    <span>{propertyData.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Type:</span>
                    <Badge variant="outline">{propertyData.type}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Address:</span>
                    <span>{propertyData.address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Country:</span>
                    <span>{propertyData.country}</span>
                  </div>
                  {propertyData.year_built && (
                    <div className="flex justify-between">
                      <span>Year Built:</span>
                      <span>{propertyData.year_built}</span>
                    </div>
                  )}
                  {propertyData.description && (
                    <div className="flex justify-between">
                      <span>Description:</span>
                      <span className="text-right max-w-48 truncate" title={propertyData.description}>
                        {propertyData.description}
                      </span>
                    </div>
                  )}
                  {(selectedOwnerIds.length > 0 || createdOwners.length > 0) && (
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>Owners:</span>
                        <span className="text-right">
                          {(() => {
                            const allOwners = [
                              ...mockOwners.filter(owner => selectedOwnerIds.includes(owner.id)),
                              ...createdOwners
                            ];
                            if (allOwners.length === 1) {
                              return `${allOwners[0].first_name} ${allOwners[0].last_name}`;
                            } else if (allOwners.length > 1) {
                              return `${allOwners[0].first_name} ${allOwners[0].last_name} +${allOwners.length - 1} more`;
                            }
                            return '';
                          })()}
                        </span>
                      </div>
                      {primaryOwnerId && (
                        <div className="flex justify-between">
                          <span>Primary Owner:</span>
                          <span className="text-right">
                            {(() => {
                              const primaryOwner = mockOwners.find(o => o.id === primaryOwnerId) || 
                                                 createdOwners.find(o => o.id === primaryOwnerId);
                              return primaryOwner ? `${primaryOwner.first_name} ${primaryOwner.last_name}` : '';
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  {selectedBankAccountId && (
                    <div className="flex justify-between">
                      <span>Bank Account:</span>
                      <span>
                        {(() => {
                          const account = mockBankAccounts.find(a => a.id === selectedBankAccountId);
                          return account ? `${account.name} (...${account.account_last4})` : '';
                        })()}
                      </span>
                    </div>
                  )}
                  {reserve && (
                    <div className="flex justify-between">
                      <span>Reserve:</span>
                      <span>${Number(reserve).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Property
        </Button>
      </DialogTrigger>
      <DialogContent className="min-w-[600px] max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="mb-6">
          <DialogTitle>Add New Property</DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step <= currentStep ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {step}
              </div>
              {step < 5 && (
                <div className={`w-12 h-0.5 mx-2 ${
                  step < currentStep ? 'bg-primary' : 'bg-muted'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6 border-t">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 1}
          >
            Previous
          </Button>
          
          <div className="flex gap-2">
            {currentStep < 5 ? (
              <Button
                onClick={handleNext}
                disabled={!isStepValid(currentStep)}
              >
                Next
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading || !isStepValid(currentStep)}
              >
                {loading ? "Creating..." : "Create Property"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}