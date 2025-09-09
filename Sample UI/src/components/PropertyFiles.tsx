import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { 
  FileText, 
  Upload, 
  Search, 
  Filter,
  Download,
  Eye,
  Trash2,
  File,
  Image,
  FileSpreadsheet,
  Calendar,
  User,
  FolderOpen,
  Plus
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface PropertyFilesProps {
  propertyId: string;
  accessToken?: string;
}

interface PropertyFile {
  id: string;
  name: string;
  type: string;
  category: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  url?: string;
}

export function PropertyFiles({ propertyId, accessToken }: PropertyFilesProps) {
  const [files, setFiles] = useState<PropertyFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Mock files data for demonstration
  const mockFiles: PropertyFile[] = [
    {
      id: '1',
      name: 'Property Insurance Policy 2024.pdf',
      type: 'application/pdf',
      category: 'insurance',
      size: 2457600,
      uploadedAt: '2024-01-15T10:30:00Z',
      uploadedBy: 'John Smith'
    },
    {
      id: '2',
      name: 'Property Tax Assessment.pdf',
      type: 'application/pdf',
      category: 'tax',
      size: 1234567,
      uploadedAt: '2024-01-10T14:20:00Z',
      uploadedBy: 'Mary Johnson'
    },
    {
      id: '3',
      name: 'Lease Agreement Template.docx',
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      category: 'legal',
      size: 567890,
      uploadedAt: '2024-01-08T09:15:00Z',
      uploadedBy: 'Legal Team'
    },
    {
      id: '4',
      name: 'Property Photos - Exterior.jpg',
      type: 'image/jpeg',
      category: 'photos',
      size: 3456789,
      uploadedAt: '2024-01-05T16:45:00Z',
      uploadedBy: 'Property Manager'
    },
    {
      id: '5',
      name: 'Maintenance Schedule 2024.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      category: 'maintenance',
      size: 789012,
      uploadedAt: '2024-01-03T11:00:00Z',
      uploadedBy: 'Maintenance Team'
    },
    {
      id: '6',
      name: 'Property Inspection Report.pdf',
      type: 'application/pdf',
      category: 'inspection',
      size: 1987654,
      uploadedAt: '2023-12-28T13:30:00Z',
      uploadedBy: 'Inspector Bob'
    }
  ];

  useEffect(() => {
    // Simulate API call
    setFiles(mockFiles);
  }, [propertyId]);

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || file.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4 text-blue-600" />;
    if (type.includes('spreadsheet') || type.includes('excel')) return <FileSpreadsheet className="w-4 h-4 text-green-600" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4 text-red-600" />;
    return <File className="w-4 h-4 text-gray-600" />;
  };

  const getCategoryBadge = (category: string) => {
    const categoryConfig = {
      insurance: { label: 'Insurance', color: 'bg-blue-100 text-blue-800' },
      tax: { label: 'Tax Documents', color: 'bg-green-100 text-green-800' },
      legal: { label: 'Legal', color: 'bg-purple-100 text-purple-800' },
      photos: { label: 'Photos', color: 'bg-pink-100 text-pink-800' },
      maintenance: { label: 'Maintenance', color: 'bg-orange-100 text-orange-800' },
      inspection: { label: 'Inspection', color: 'bg-yellow-100 text-yellow-800' },
      financial: { label: 'Financial', color: 'bg-emerald-100 text-emerald-800' },
      other: { label: 'Other', color: 'bg-gray-100 text-gray-800' }
    };
    
    return categoryConfig[category as keyof typeof categoryConfig] || categoryConfig.other;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getFileStats = () => {
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const categories = [...new Set(files.map(f => f.category))].length;
    
    return { totalFiles, totalSize, categories };
  };

  const stats = getFileStats();

  return (
    <div className="space-y-6">


      {/* Search and Upload */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="all">All Categories</option>
              <option value="insurance">Insurance</option>
              <option value="tax">Tax Documents</option>
              <option value="legal">Legal</option>
              <option value="photos">Photos</option>
              <option value="maintenance">Maintenance</option>
              <option value="inspection">Inspection</option>
              <option value="financial">Financial</option>
              <option value="other">Other</option>
            </select>
          </div>

          <Button onClick={() => setUploadModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Files
          </Button>
        </div>
      </Card>

      {/* Files Table */}
      <Card>
        <div className="p-4 border-b">
          <h3 className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Files ({filteredFiles.length})
          </h3>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFiles.map((file) => {
              const categoryConfig = getCategoryBadge(file.category);
              return (
                <TableRow key={file.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {getFileIcon(file.type)}
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-sm text-muted-foreground">{file.type}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={categoryConfig.color}>
                      {categoryConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{formatFileSize(file.size)}</span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm">{formatDate(file.uploadedAt)}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {file.uploadedBy}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" title="View">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Download">
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm" title="Delete" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {filteredFiles.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground mb-2">
              {searchTerm || filterCategory !== "all" ? "No files match your filters" : "No files uploaded yet"}
            </p>
            {searchTerm || filterCategory !== "all" ? (
              <Button 
                variant="outline" 
                onClick={() => { setSearchTerm(""); setFilterCategory("all"); }}
              >
                Clear Filters
              </Button>
            ) : (
              <Button onClick={() => setUploadModalOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Upload First File
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Quick Actions */}
      <Card className="p-6">
        <h3 className="mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Button variant="outline" className="h-16 flex-col">
            <Upload className="w-5 h-5 mb-2" />
            <span className="text-sm">Upload Files</span>
          </Button>
          <Button variant="outline" className="h-16 flex-col">
            <FolderOpen className="w-5 h-5 mb-2" />
            <span className="text-sm">Create Folder</span>
          </Button>
          <Button variant="outline" className="h-16 flex-col">
            <Download className="w-5 h-5 mb-2" />
            <span className="text-sm">Bulk Download</span>
          </Button>
          <Button variant="outline" className="h-16 flex-col">
            <FileText className="w-5 h-5 mb-2" />
            <span className="text-sm">Generate Report</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}