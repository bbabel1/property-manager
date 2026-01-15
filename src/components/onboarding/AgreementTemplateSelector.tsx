'use client';

import { FileText } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/ui/typography';

export interface AgreementTemplate {
  id: string;
  name: string;
  description?: string;
}

interface AgreementTemplateSelectorProps {
  templates: AgreementTemplate[];
  selectedTemplateId?: string;
  onTemplateChange: (templateId: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
}

// Default templates when none are loaded from the database
const DEFAULT_TEMPLATES: AgreementTemplate[] = [
  {
    id: 'default-management-agreement',
    name: 'Standard Management Agreement',
    description: 'Default property management agreement template',
  },
  {
    id: 'condo-management-agreement',
    name: 'Condo Management Agreement',
    description: 'Management agreement for condominium properties',
  },
  {
    id: 'rental-building-agreement',
    name: 'Rental Building Agreement',
    description: 'Management agreement for rental buildings',
  },
];

export default function AgreementTemplateSelector({
  templates = DEFAULT_TEMPLATES,
  selectedTemplateId,
  onTemplateChange,
  disabled = false,
  isLoading = false,
}: AgreementTemplateSelectorProps) {
  const displayTemplates = templates.length > 0 ? templates : DEFAULT_TEMPLATES;

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Agreement Template</Label>
      <Select
        value={selectedTemplateId}
        onValueChange={onTemplateChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            <FileText className="text-muted-foreground h-4 w-4" />
            <SelectValue placeholder="Select a template" />
          </div>
        </SelectTrigger>
        <SelectContent>
          {displayTemplates.map((template) => (
            <SelectItem key={template.id} value={template.id}>
              <div className="flex flex-col">
                <span>{template.name}</span>
                {template.description && (
                  <span className="text-muted-foreground text-xs">{template.description}</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
