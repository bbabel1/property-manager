'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Eye, Copy, Archive } from 'lucide-react';
import type { EmailTemplate, EmailTemplateStatus } from '@/types/email-templates';
import type { TemplateRenderResult } from '@/types/email-templates';
import { TemplatePreview } from '@/components/email-templates/template-preview';

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<EmailTemplateStatus | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TemplateRenderResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      const response = await fetch(`/api/email-templates?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }

      const data = await response.json();
      setTemplates(data.templates || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const getStatusBadgeVariant = (status: EmailTemplateStatus) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'archived':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const handleEdit = (id: string) => {
    router.push(`/settings/templates/${id}`);
  };

  const handlePreview = async (template: EmailTemplate) => {
    try {
      setPreviewLoading(true);
      const response = await fetch(`/api/email-templates/${template.id}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Failed to preview template');
      }

      const data = await response.json();
      setPreview(data);
      setPreviewOpen(true);
    } catch (err) {
      console.error('Error previewing template:', err);
      alert('Failed to preview template');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    const suggestedKey = `${template.template_key}_copy`;
    const newKey = window.prompt('Enter a new template key for the duplicate', suggestedKey);
    if (!newKey) return;

    try {
      const response = await fetch(`/api/email-templates/${template.id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_key: newKey }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to duplicate template');
      }

      await fetchTemplates();
    } catch (err) {
      console.error('Error duplicating template:', err);
      alert(err instanceof Error ? err.message : 'Failed to duplicate template');
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm('Are you sure you want to archive this template?')) {
      return;
    }

    try {
      const response = await fetch(`/api/email-templates/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to archive template');
      }

      await fetchTemplates();
    } catch (err) {
      console.error('Error archiving template:', err);
      alert('Failed to archive template');
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Email Templates"
        description="Manage email templates for statements and notifications"
        actions={
          <Button onClick={() => router.push('/settings/templates/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        }
      />

      <PageBody>
        <Card>
          <CardContent className="p-0">
            <div className="p-4 border-b flex items-center justify-between">
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as EmailTemplateStatus | 'all')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading templates...</div>
            ) : error ? (
              <div className="p-8 text-center text-destructive">{error}</div>
            ) : templates.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No templates found. Create your first template to get started.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Template Key</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">{template.name}</TableCell>
                      <TableCell className="text-muted-foreground">{template.template_key}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(template.status)}>
                          {template.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(template.updated_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template.id)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(template)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDuplicate(template)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {template.status !== 'archived' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchive(template.id)}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <TemplatePreview
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          preview={preview}
          loading={previewLoading}
        />
      </PageBody>
    </PageShell>
  );
}
