import { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Switch } from "./ui/switch";
import { Textarea } from "./ui/textarea";
import { Separator } from "./ui/separator";

interface OwnerData {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  alternate_email: string;
  alternate_phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  entity_type: string;
  preferred_contact: string;
  email_opt_in: boolean;
  text_opt_in: boolean;
  comments?: string;
  date_of_birth?: string;
}

interface EditOwnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerData: OwnerData;
  onSave: (updatedData: OwnerData) => void;
}

export function EditOwnerDialog({ open, onOpenChange, ownerData, onSave }: EditOwnerDialogProps) {
  const [formData, setFormData] = useState<OwnerData>(ownerData);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (field: keyof OwnerData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Here you would typically make an API call to save the data
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      onSave(formData);
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving owner data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(ownerData); // Reset form data
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[600px] max-w-4xl max-h-[90vh] overflow-y-auto p-6">
        <DialogHeader className="mb-6">
          <DialogTitle>Edit Rental Owner Information</DialogTitle>
          <DialogDescription>
            Update the rental owner's contact information and preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 px-2">
          {/* Personal Information */}
          <div>
            <h4 className="font-medium mb-6">Personal Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="Enter first name"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="Enter last name"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="entity_type">Entity Type</Label>
                <Select value={formData.entity_type} onValueChange={(value) => handleInputChange('entity_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Corporation">Corporation</SelectItem>
                    <SelectItem value="LLC">LLC</SelectItem>
                    <SelectItem value="Partnership">Partnership</SelectItem>
                    <SelectItem value="Trust">Trust</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Label htmlFor="date_of_birth">Date of Birth</Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  value={formData.date_of_birth || "1993-06-14"}
                  onChange={(e) => handleInputChange('date_of_birth', e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div>
            <h4 className="font-medium mb-6">Contact Information</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label htmlFor="email">Primary Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter primary email"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="alternate_email">Alternate Email</Label>
                <Input
                  id="alternate_email"
                  type="email"
                  value={formData.alternate_email}
                  onChange={(e) => handleInputChange('alternate_email', e.target.value)}
                  placeholder="Enter alternate email"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="phone">Primary Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="Enter primary phone"
                />
              </div>
              <div className="space-y-3">
                <Label htmlFor="alternate_phone">Alternate Phone</Label>
                <Input
                  id="alternate_phone"
                  type="tel"
                  value={formData.alternate_phone}
                  onChange={(e) => handleInputChange('alternate_phone', e.target.value)}
                  placeholder="Enter alternate phone"
                />
              </div>
              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="preferred_contact">Preferred Contact Method</Label>
                <Select value={formData.preferred_contact} onValueChange={(value) => handleInputChange('preferred_contact', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select preferred contact method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="Phone">Phone</SelectItem>
                    <SelectItem value="Text">Text Message</SelectItem>
                    <SelectItem value="Mail">Mail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Address Information */}
          <div>
            <h4 className="font-medium mb-6">Address Information</h4>
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-3">
                <Label htmlFor="address">Street Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Enter street address"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    placeholder="Enter city"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    placeholder="Enter state"
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input
                    id="zip"
                    value={formData.zip}
                    onChange={(e) => handleInputChange('zip', e.target.value)}
                    placeholder="Enter ZIP code"
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Communication Preferences */}
          <div>
            <h4 className="font-medium mb-6">Communication Preferences</h4>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="email_opt_in">Email Notifications</Label>
                  <div className="text-sm text-muted-foreground">
                    Receive email notifications for important updates
                  </div>
                </div>
                <Switch
                  id="email_opt_in"
                  checked={formData.email_opt_in}
                  onCheckedChange={(checked) => handleInputChange('email_opt_in', checked)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="text_opt_in">Text Messages</Label>
                  <div className="text-sm text-muted-foreground">
                    Receive text message notifications
                  </div>
                </div>
                <Switch
                  id="text_opt_in"
                  checked={formData.text_opt_in}
                  onCheckedChange={(checked) => handleInputChange('text_opt_in', checked)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Comments */}
          <div>
            <h4 className="font-medium mb-6">Comments</h4>
            <div className="space-y-3">
              <Label htmlFor="comments">Additional Notes</Label>
              <Textarea
                id="comments"
                value={formData.comments || "Referred by Kirk."}
                onChange={(e) => handleInputChange('comments', e.target.value)}
                placeholder="Enter any additional comments or notes"
                rows={4}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}