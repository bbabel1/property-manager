import { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Separator } from "./ui/separator";
import { 
  Download,
  Eye,
  FileText,
  Save,
  Send
} from "lucide-react";

interface TaxProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerId: string;
  ownerName: string;
}

// Mock data for tax information
const mockTaxData = {
  taxPayerType: "Individual",
  taxId: "***-**-6789",
  taxName: "Robert Johnson",
  taxAddress: "123 Oak Street, Suite 400",
  taxCity: "San Francisco",
  taxState: "CA",
  taxZip: "94102",
  backupWithholding: false,
  exemptFromBackupWithholding: true,
  exemptPayeeCode: "",
  exemptFromFatca: false,
  completionPercentage: 85,
  lastUpdated: "2024-01-15"
};

const mock1099History = [
  { 
    id: "1099-2023", 
    year: "2023", 
    amount: 28500, 
    status: "Issued", 
    dateIssued: "2024-01-31",
    dateDeadline: "2024-01-31",
    type: "1099-MISC"
  },
  { 
    id: "1099-2022", 
    year: "2022", 
    amount: 26800, 
    status: "Issued", 
    dateIssued: "2023-01-30",
    dateDeadline: "2023-01-31",
    type: "1099-MISC"
  },
  { 
    id: "1099-2024", 
    year: "2024", 
    amount: 31200, 
    status: "Draft", 
    dateIssued: null,
    dateDeadline: "2025-01-31",
    type: "1099-MISC"
  }
];

export function TaxProfileDialog({ open, onOpenChange, ownerId, ownerName }: TaxProfileDialogProps) {
  const [taxData, setTaxData] = useState(mockTaxData);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Issued': return 'bg-green-50 text-green-700 border-green-200';
      case 'Draft': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'Overdue': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const handleSave = () => {
    // Mock save functionality
    console.log('Saving tax profile data:', taxData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="min-w-[600px] max-w-[700px] h-[650px] min-h-[650px] max-h-[650px] fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-8 py-6">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FileText className="w-5 h-5" />
            Tax Profile Management - {ownerName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="space-y-8">
            {/* Tax Information Section */}
            <div>
              <h4 className="font-medium mb-6">Tax Information</h4>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="taxPayerType">Tax Payer Type</Label>
                    <Select value={taxData.taxPayerType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Individual">Individual</SelectItem>
                        <SelectItem value="Corporation">Corporation</SelectItem>
                        <SelectItem value="Partnership">Partnership</SelectItem>
                        <SelectItem value="LLC">LLC</SelectItem>
                        <SelectItem value="Trust">Trust</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="taxId">Tax ID / SSN</Label>
                    <Input
                      id="taxId"
                      value={taxData.taxId}
                      onChange={(e) => setTaxData({...taxData, taxId: e.target.value})}
                      placeholder="XXX-XX-XXXX"
                    />
                  </div>

                  <div className="space-y-3 md:col-span-2">
                    <Label htmlFor="taxName">Tax Name</Label>
                    <Input
                      id="taxName"
                      value={taxData.taxName}
                      onChange={(e) => setTaxData({...taxData, taxName: e.target.value})}
                      placeholder="Legal name for tax purposes"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Tax Address Section */}
            <div>
              <h4 className="font-medium mb-6">Tax Address</h4>
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="taxAddress">Street Address</Label>
                  <Input
                    id="taxAddress"
                    value={taxData.taxAddress}
                    onChange={(e) => setTaxData({...taxData, taxAddress: e.target.value})}
                    placeholder="Enter street address"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="taxCity">City</Label>
                    <Input
                      id="taxCity"
                      value={taxData.taxCity}
                      onChange={(e) => setTaxData({...taxData, taxCity: e.target.value})}
                      placeholder="Enter city"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="taxState">State</Label>
                    <Input
                      id="taxState"
                      value={taxData.taxState}
                      onChange={(e) => setTaxData({...taxData, taxState: e.target.value})}
                      placeholder="Enter state"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="taxZip">ZIP Code</Label>
                    <Input
                      id="taxZip"
                      value={taxData.taxZip}
                      onChange={(e) => setTaxData({...taxData, taxZip: e.target.value})}
                      placeholder="Enter ZIP code"
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} className="px-8">
                <Save className="w-4 h-4 mr-2" />
                Save Profile
              </Button>
            </div>

            <Separator />

            {/* 1099 History Section */}
            <div>
              <h4 className="font-medium mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                1099 History
              </h4>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="h-12">
                      <TableHead className="font-medium">Year</TableHead>
                      <TableHead className="font-medium">Type</TableHead>
                      <TableHead className="font-medium">Amount</TableHead>
                      <TableHead className="font-medium">Status</TableHead>
                      <TableHead className="font-medium">Date Issued</TableHead>
                      <TableHead className="font-medium">Deadline</TableHead>
                      <TableHead className="text-right font-medium">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mock1099History.map((form) => (
                      <TableRow key={form.id} className="h-12">
                        <TableCell className="font-medium">{form.year}</TableCell>
                        <TableCell>{form.type}</TableCell>
                        <TableCell>{formatCurrency(form.amount)}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(form.status)}>
                            {form.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(form.dateIssued)}</TableCell>
                        <TableCell>{formatDate(form.dateDeadline)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                              <Download className="w-4 h-4" />
                            </Button>
                            {form.status !== 'Draft' && (
                              <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                                <Send className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}