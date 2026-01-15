import { FileText, Upload, Download, Search, Filter, Folder, File, Image as ImageIcon, FileType } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Body, Heading, Label } from '@/ui/typography'

interface PropertyFilesProps {
  propertyId: string
}

export function PropertyFiles({ propertyId: _propertyId }: PropertyFilesProps) {
  // TODO: Implement real file management with database integration
  const files: any[] = []

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-500" />
      case 'jpg':
      case 'png':
        return <ImageIcon className="w-5 h-5 text-blue-500" aria-hidden="true" />
      case 'xlsx':
      case 'xls':
        return <FileType className="w-5 h-5 text-green-500" />
      case 'dwg':
        return <File className="w-5 h-5 text-purple-500" />
      default:
        return <File className="w-5 h-5 text-gray-500" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search files..."
              className="pl-10 pr-4 py-2 border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
        <Button>
          <Upload className="w-4 h-4 mr-2" />
          Upload File
        </Button>
      </div>

      {/* Empty State */}
      {files.length === 0 && (
        <div className="text-center py-12">
          <Folder className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <Heading as="h3" size="h5" className="text-foreground mb-2">
            No files uploaded
          </Heading>
          <Body tone="muted" size="sm" className="mb-6">
            Upload property documents, photos, and other files to keep them organized.
          </Body>
          <Button>
            <Upload className="w-4 h-4 mr-2" />
            Upload Your First File
          </Button>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="bg-card rounded-lg border">
          <div className="p-6 border-b border-border">
            <Heading as="h2" size="h5">
              Property Files
            </Heading>
            <Label as="p" size="xs" tone="muted">
              {files.length} files
            </Label>
          </div>
          <div className="divide-y divide-border-subtle">
            {files.map((file) => (
              <div key={file.id} className="p-6 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {getFileIcon(file.type)}
                  <div>
                    <Heading as="h3" size="h6" className="font-medium">
                      {file.name}
                    </Heading>
                    <Body tone="muted" size="sm">
                      {file.size} • {file.category} • Uploaded by {file.uploadedBy}
                    </Body>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Body as="span" tone="muted" size="sm">
                    {new Date(file.uploadedAt).toLocaleDateString()}
                  </Body>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
