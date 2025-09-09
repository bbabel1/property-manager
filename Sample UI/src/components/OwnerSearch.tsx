import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { Checkbox } from "./ui/checkbox";
import {
  Plus,
  ChevronDown,
  User,
  Mail,
  Phone,
  Check,
  X,
  Search,
  RefreshCw,
  Building,
} from "lucide-react";
import { projectId } from "../utils/supabase/info";

interface RentalOwner {
  id: string;
  firstName: string;
  lastName: string;
  companyName?: string;
  isCompany: boolean;
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  contactId?: string;
}

interface SelectedOwner extends RentalOwner {
  ownershipPercent: number;
  disbursementPercent: number;
  isPrimary: boolean;
}

interface OwnerSearchProps {
  accessToken?: string;
  selectedOwners: SelectedOwner[];
  onOwnersChange: (owners: SelectedOwner[]) => void;
  placeholder?: string;
}

export function OwnerSearch({ 
  accessToken, 
  selectedOwners, 
  onOwnersChange, 
  placeholder = "Search and select owners..." 
}: OwnerSearchProps) {
  const [owners, setOwners] = useState<RentalOwner[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAddOwnerDialogOpen, setIsAddOwnerDialogOpen] = useState(false);
  const [creatingOwner, setCreatingOwner] = useState(false);
  
  const [newOwnerFormData, setNewOwnerFormData] = useState({
    firstName: "",
    lastName: "",
    companyName: "",
    isCompany: false,
    email: "",
    phone: "",
    address: ""
  });

  useEffect(() => {
    if (accessToken) {
      fetchOwners();
    }
  }, [accessToken]);

  // Auto-calculate percentages when owners change
  useEffect(() => {
    if (selectedOwners.length > 0) {
      const equalOwnershipPercent = Math.floor(100 / selectedOwners.length);
      const ownershipRemainder = 100 - (equalOwnershipPercent * selectedOwners.length);
      
      const equalDisbursementPercent = Math.floor(100 / selectedOwners.length);
      const disbursementRemainder = 100 - (equalDisbursementPercent * selectedOwners.length);
      
      const updatedOwners = selectedOwners.map((owner, index) => ({
        ...owner,
        ownershipPercent: index === 0 ? equalOwnershipPercent + ownershipRemainder : equalOwnershipPercent,
        disbursementPercent: index === 0 ? equalDisbursementPercent + disbursementRemainder : equalDisbursementPercent,
      }));
      
      if (JSON.stringify(updatedOwners) !== JSON.stringify(selectedOwners)) {
        onOwnersChange(updatedOwners);
      }
    }
  }, [selectedOwners.length]);

  const fetchOwners = async () => {
    if (!accessToken) return;
    
    setLoading(true);
    try {
      console.log("Fetching rental owners with contact data from backend...");
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/rental-owners/search`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Rental owners with contact data received:", data);
        setOwners(data.owners || []);
      } else {
        console.log("❌ Rental owners fetch failed:", response.status);
        const errorText = await response.text();
        console.log("Error response:", errorText);
        setOwners([]);
      }
    } catch (error) {
      console.log("❌ Error fetching rental owners:", error);
      setOwners([]);
    } finally {
      setLoading(false);
    }
  };

  const createOwner = async () => {
    if (!accessToken) return null;

    // Validate required fields
    if (!newOwnerFormData.firstName.trim() || !newOwnerFormData.lastName.trim()) {
      alert("First name and last name are required");
      return null;
    }

    if (newOwnerFormData.isCompany && !newOwnerFormData.companyName.trim()) {
      alert("Company name is required when creating a company");
      return null;
    }
    
    try {
      console.log("Creating new rental owner with contact:", newOwnerFormData);
      
      const payload = {
        firstName: newOwnerFormData.firstName.trim(),
        lastName: newOwnerFormData.lastName.trim(),
        companyName: newOwnerFormData.companyName.trim() || null,
        isCompany: newOwnerFormData.isCompany,
        email: newOwnerFormData.email.trim() || null,
        phone: newOwnerFormData.phone.trim() || null,
        address: newOwnerFormData.address.trim() || null
      };

      console.log("Payload being sent:", payload);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-04fa0d09/rental-owners`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (response.ok) {
        const data = await response.json();
        console.log("✅ Rental owner created successfully:", data);
        
        // Refresh owners list
        await fetchOwners();
        
        // Auto-select the newly created owner
        if (data.owner) {
          handleSelectOwner(data.owner);
        }
        
        return data.owner;
      } else {
        const errorText = await response.text();
        console.error("❌ Failed to create rental owner:", response.status, errorText);
        throw new Error(`Failed to create rental owner: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error("❌ Network error creating rental owner:", error);
      throw error;
    }
  };

  const handleCreateOwner = async () => {
    setCreatingOwner(true);
    try {
      const result = await createOwner();
      if (result) {
        // Reset form
        setNewOwnerFormData({
          firstName: "",
          lastName: "",
          companyName: "",
          isCompany: false,
          email: "",
          phone: "",
          address: ""
        });
        setIsAddOwnerDialogOpen(false);
      }
    } catch (error) {
      alert(`Failed to create owner: ${error}`);
    } finally {
      setCreatingOwner(false);
    }
  };

  const handleSelectOwner = (owner: RentalOwner) => {
    const isSelected = selectedOwners.some(selected => selected.id === owner.id);
    
    if (isSelected) {
      // Remove owner
      onOwnersChange(selectedOwners.filter(selected => selected.id !== owner.id));
    } else {
      // Add owner with default percentages and primary status
      const newSelectedOwner: SelectedOwner = {
        ...owner,
        ownershipPercent: 100,
        disbursementPercent: 100,
        isPrimary: selectedOwners.length === 0 // First owner is primary
      };
      onOwnersChange([...selectedOwners, newSelectedOwner]);
    }
    setSearchOpen(false);
  };

  const removeOwner = (ownerId: string) => {
    onOwnersChange(selectedOwners.filter(owner => owner.id !== ownerId));
  };

  const updateOwnershipPercent = (ownerId: string, percent: number) => {
    onOwnersChange(selectedOwners.map(owner => 
      owner.id === ownerId ? { ...owner, ownershipPercent: percent } : owner
    ));
  };

  const updateDisbursementPercent = (ownerId: string, percent: number) => {
    onOwnersChange(selectedOwners.map(owner => 
      owner.id === ownerId ? { ...owner, disbursementPercent: percent } : owner
    ));
  };

  const updatePrimaryStatus = (ownerId: string, isPrimary: boolean) => {
    onOwnersChange(selectedOwners.map(owner => {
      if (owner.id === ownerId) {
        return { ...owner, isPrimary };
      } else if (isPrimary) {
        // If setting this owner as primary, unset others
        return { ...owner, isPrimary: false };
      }
      return owner;
    }));
  };

  const getInitials = (firstName: string, lastName: string, companyName?: string) => {
    if (companyName) {
      return companyName.substring(0, 2).toUpperCase();
    }
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const getTotalOwnership = () => {
    return selectedOwners.reduce((total, owner) => total + owner.ownershipPercent, 0);
  };

  const getTotalDisbursement = () => {
    return selectedOwners.reduce((total, owner) => total + owner.disbursementPercent, 0);
  };

  return (
    <div className="space-y-4">
      {/* Owner Search and Selection */}
      <div className="space-y-2">
        <Popover open={searchOpen} onOpenChange={setSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={searchOpen}
              className="w-full justify-between"
            >
              <span className="flex items-center">
                <User className="w-4 h-4 mr-2" />
                {selectedOwners.length === 0 
                  ? placeholder 
                  : `${selectedOwners.length} owner${selectedOwners.length > 1 ? 's' : ''} selected`
                }
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Search owners by name, email..." />
              <CommandList>
                <CommandEmpty>
                  {loading ? "Loading owners..." : "No owners found."}
                </CommandEmpty>
                <CommandGroup>
                  {owners.map((owner) => {
                    const isSelected = selectedOwners.some(selected => selected.id === owner.id);
                    
                    return (
                      <CommandItem
                        key={owner.id}
                        onSelect={() => handleSelectOwner(owner)}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <Checkbox checked={isSelected} readOnly />
                        <div className="flex-1">
                          <div className="font-medium">{owner.fullName}</div>
                          {owner.isCompany && owner.companyName && (
                            <div className="text-xs text-muted-foreground flex items-center">
                              <Building className="w-3 h-3 mr-1" />
                              {owner.companyName}
                            </div>
                          )}
                          {owner.email && (
                            <div className="text-xs text-muted-foreground">{owner.email}</div>
                          )}
                        </div>
                        {isSelected && <Check className="h-4 w-4" />}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected Owners Display */}
      {selectedOwners.length > 0 && (
        <div className="space-y-4">
          {selectedOwners.map((owner) => (
            <div key={owner.id} className="bg-gray-50 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 border-2 border-orange-300 flex items-center justify-center">
                    <span className="text-sm font-medium text-orange-700">
                      {getInitials(owner.firstName, owner.lastName, owner.companyName)}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium">{owner.fullName}</div>
                    <div className="flex items-center gap-2 mt-1">
                      {owner.isCompany && owner.companyName && (
                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">
                          <Building className="w-3 h-3 mr-1" />
                          {owner.companyName}
                        </Badge>
                      )}
                      {owner.isPrimary && (
                        <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                          Primary
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOwner(owner.id)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">OWNERSHIP %</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={owner.ownershipPercent}
                      onChange={(e) => updateOwnershipPercent(owner.id, parseInt(e.target.value) || 0)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">DISBURSEMENT %</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={owner.disbursementPercent}
                      onChange={(e) => updateDisbursementPercent(owner.id, parseInt(e.target.value) || 0)}
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">PRIMARY</Label>
                  <div className="flex items-center justify-center h-10">
                    <Checkbox 
                      checked={owner.isPrimary}
                      onCheckedChange={(checked) => updatePrimaryStatus(owner.id, checked === true)}
                    />
                  </div>
                </div>
              </div>
              
              {/* Contact Details */}
              {(owner.email || owner.phone) && (
                <div className="pt-2 border-t border-gray-200">
                  {owner.email && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Mail className="w-3 h-3 mr-1" />
                      {owner.email}
                    </div>
                  )}
                  {owner.phone && (
                    <div className="flex items-center text-sm text-muted-foreground mt-1">
                      <Phone className="w-3 h-3 mr-1" />
                      {owner.phone}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          
          {/* Total Percentages Display */}
          <div className="text-right space-y-1">
            <div>
              <span className="text-sm font-medium">
                Total Ownership: <span className={getTotalOwnership() === 100 ? 'text-green-600' : 'text-red-600'}>
                  {getTotalOwnership()}%
                </span>
              </span>
            </div>
            <div>
              <span className="text-sm font-medium">
                Total Disbursement: <span className={getTotalDisbursement() === 100 ? 'text-green-600' : 'text-red-600'}>
                  {getTotalDisbursement()}%
                </span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Add New Owner */}
      <Dialog open={isAddOwnerDialogOpen} onOpenChange={setIsAddOwnerDialogOpen}>
        <DialogTrigger asChild>
          <Button 
            variant="link" 
            className="p-0 h-auto text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add new owner
          </Button>
        </DialogTrigger>
        
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Rental Owner</DialogTitle>
            <DialogDescription>
              Create a new rental owner with contact information.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Personal Information */}
            <div className="space-y-4">
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                PERSONAL INFORMATION
              </Label>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input
                    placeholder="First name"
                    value={newOwnerFormData.firstName}
                    onChange={(e) => setNewOwnerFormData(prev => ({
                      ...prev,
                      firstName: e.target.value
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input
                    placeholder="Last name"
                    value={newOwnerFormData.lastName}
                    onChange={(e) => setNewOwnerFormData(prev => ({
                      ...prev,
                      lastName: e.target.value
                    }))}
                  />
                </div>
              </div>
              
              {/* Company Information */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="is-company"
                    checked={newOwnerFormData.isCompany}
                    onCheckedChange={(checked) => setNewOwnerFormData(prev => ({
                      ...prev,
                      isCompany: checked === true
                    }))}
                  />
                  <Label htmlFor="is-company" className="text-sm">
                    Company Entity
                  </Label>
                </div>
                
                {newOwnerFormData.isCompany && (
                  <div className="space-y-2">
                    <Label>Company Name *</Label>
                    <Input
                      placeholder="Company name"
                      value={newOwnerFormData.companyName}
                      onChange={(e) => setNewOwnerFormData(prev => ({
                        ...prev,
                        companyName: e.target.value
                      }))}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                CONTACT INFORMATION
              </Label>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      className="pl-10"
                      value={newOwnerFormData.email}
                      onChange={(e) => setNewOwnerFormData(prev => ({
                        ...prev,
                        email: e.target.value
                      }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="tel"
                      placeholder="(555) 123-4567"
                      className="pl-10"
                      value={newOwnerFormData.phone}
                      onChange={(e) => setNewOwnerFormData(prev => ({
                        ...prev,
                        phone: e.target.value
                      }))}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input
                    placeholder="Street address"
                    value={newOwnerFormData.address}
                    onChange={(e) => setNewOwnerFormData(prev => ({
                      ...prev,
                      address: e.target.value
                    }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddOwnerDialogOpen(false)}
              disabled={creatingOwner}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOwner}
              disabled={
                (!newOwnerFormData.firstName.trim() || 
                 !newOwnerFormData.lastName.trim() ||
                 (newOwnerFormData.isCompany && !newOwnerFormData.companyName.trim())) ||
                creatingOwner
              }
              className="bg-green-600 hover:bg-green-700"
            >
              {creatingOwner ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {creatingOwner ? 'Creating...' : 'Create Owner'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}