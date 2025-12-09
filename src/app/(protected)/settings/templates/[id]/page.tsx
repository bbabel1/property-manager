'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { PageBody, PageHeader, PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Save, Eye, AlertTriangle, Type, Bold, Italic, List, ListOrdered, Link, Image as ImageIcon, Video, Smile, Undo, Redo, Code2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { VariableHelper } from '@/components/email-templates/variable-helper';
import { TemplatePreview } from '@/components/email-templates/template-preview';
import type {
  EmailTemplate,
  EmailTemplateStatus,
  TemplateRenderResult,
} from '@/types/email-templates';
import { getAvailableVariables } from '@/lib/email-templates/variable-definitions';

export default function TemplateEditorPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  const isNew = templateId === 'new';

  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [preview, setPreview] = useState<TemplateRenderResult | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateKey, setTemplateKey] = useState('monthly_rental_statement');
  const [status, setStatus] = useState<EmailTemplateStatus>('active');
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [bodyHtmlTemplate, setBodyHtmlTemplate] = useState('');
  const [bodyTextTemplate, setBodyTextTemplate] = useState('');
  const [bodyViewMode, setBodyViewMode] = useState<'text' | 'html'>('text');

  const subjectRef = useRef<HTMLInputElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const variables = getAvailableVariables('monthly_rental_statement');

  const handleBodyInsert = (key: string) =>
    insertVariable(key, bodyViewMode === 'html' ? htmlRef : textRef);

  const bodyValue = bodyViewMode === 'html' ? bodyHtmlTemplate : bodyTextTemplate;

  useEffect(() => {
    if (!isNew) {
      fetchTemplate();
    } else {
      setLoading(false);
    }
  }, [templateId, isNew]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/email-templates/${templateId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch template');
      }

      const data = await response.json();
      setTemplate(data);
      setName(data.name || '');
      setDescription(data.description || '');
      setTemplateKey(data.template_key || 'monthly_rental_statement');
      setStatus(data.status || 'active');
      setSubjectTemplate(data.subject_template || '');
      setBodyHtmlTemplate(data.body_html_template || '');
      setBodyTextTemplate(data.body_text_template || '');
      setError(null);
    } catch (err) {
      console.error('Error fetching template:', err);
      setError(err instanceof Error ? err.message : 'Failed to load template');
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (
    variableKey: string,
    ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const element = ref.current;
    if (!element) return;

    const start = element.selectionStart || 0;
    const end = element.selectionEnd || 0;
    const text = element.value;
    const variable = `{{${variableKey}}}`;

    const newText = text.substring(0, start) + variable + text.substring(end);

    if (ref === subjectRef) {
      setSubjectTemplate(newText);
    } else if (ref === htmlRef) {
      setBodyHtmlTemplate(newText);
    } else if (ref === textRef) {
      setBodyTextTemplate(newText);
    }

    // Restore cursor position
    setTimeout(() => {
      element.focus();
      const newPosition = start + variable.length;
      element.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const convertPlainTextToHtml = (text: string) => {
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    const paragraphs = escaped
      .split(/\n{2,}/)
      .map((block) => block.replace(/\n/g, '<br />'))
      .map((block) => `<p>${block}</p>`)
      .join('');

    return `<div>${paragraphs}</div>`;
  };

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      const htmlForPreview =
        bodyViewMode === 'text' ? convertPlainTextToHtml(bodyTextTemplate || '') : bodyHtmlTemplate;
      const response = isNew
        ? await fetch('/api/email-templates/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              template_key: templateKey,
              name,
              subject_template: subjectTemplate,
              body_html_template: htmlForPreview,
              body_text_template: bodyTextTemplate || null,
              available_variables: variables,
            }),
          })
        : await fetch(`/api/email-templates/${templateId}/preview`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });

      if (!response.ok) {
        throw new Error('Failed to preview template');
      }

      const data = await response.json();
      setPreview(data);
      setShowPreview(true);
    } catch (err) {
      console.error('Error previewing template:', err);
      alert('Failed to preview template');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (isNew) {
      alert('Please save the template before sending a test email.');
      return;
    }

    const to = window.prompt('Send test email to:');
    if (!to) return;

    try {
      setTestSending(true);
      const response = await fetch(`/api/email-templates/${templateId}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Failed to send test email');
      }

      alert('Test email sent');
    } catch (err: any) {
      console.error('Error sending test email:', err);
      alert(err.message || 'Failed to send test email');
    } finally {
      setTestSending(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const htmlForSave =
        bodyViewMode === 'text' ? convertPlainTextToHtml(bodyTextTemplate || '') : bodyHtmlTemplate;

      const payload: any = {
        name,
        description: description || null,
        subject_template: subjectTemplate,
        body_html_template: htmlForSave,
        body_text_template: bodyTextTemplate || null,
        status,
      };

      if (!isNew && template) {
        payload.updated_at = template.updated_at;
      }

      const url = isNew ? '/api/email-templates' : `/api/email-templates/${templateId}`;
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          template_key: templateKey,
          available_variables: variables,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to save template');
      }

      const saved = await response.json();
      if (isNew) {
        router.push(`/settings/templates/${saved.id}`);
      } else {
        await fetchTemplate();
      }
    } catch (err: any) {
      console.error('Error saving template:', err);
      setError(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PageShell>
        <PageBody>
          <div className="text-muted-foreground p-8 text-center">Loading template...</div>
        </PageBody>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={isNew ? 'New Email Template' : `Edit: ${name || 'Template'}`}
        description="Create or edit email template with dynamic variables"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePreview} disabled={previewLoading}>
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            {!isNew && (
              <Button variant="outline" onClick={handleSendTest} disabled={testSending}>
                Send Test
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        }
      />

      <PageBody>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Monthly Rental Statement"
                  maxLength={255}
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Template description..."
                  maxLength={1000}
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="templateKey">Template Key</Label>
                <Input
                  id="templateKey"
                  value={templateKey}
                  onChange={(e) => setTemplateKey(e.target.value)}
                  disabled={!isNew}
                  placeholder="monthly_rental_statement"
                />
                {!isNew && (
                  <p className="text-muted-foreground mt-1 text-xs">
                    Template key cannot be changed after creation
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as EmailTemplateStatus)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Subject Template */}
          <Card>
            <CardHeader>
              <CardTitle>Subject Line</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="subject">Subject Template *</Label>
                <VariableHelper
                  variables={variables}
                  onInsert={(key) => insertVariable(key, subjectRef)}
                />
              </div>
              <Input
                id="subject"
                ref={subjectRef}
                value={subjectTemplate}
                onChange={(e) => setSubjectTemplate(e.target.value)}
                placeholder="Monthly Statement - {{propertyName}} ({{periodMonth}})"
                maxLength={500}
              />
              <p className="text-muted-foreground text-xs">
                {subjectTemplate.length} / 500 characters
              </p>
            </CardContent>
          </Card>

          {/* Email Body Template - Consolidated */}
          <Card>
            <CardHeader className="space-y-1">
                <div className="flex items-center justify-between">
                  <CardTitle>Email Body</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Mode: {bodyViewMode === 'html' ? 'HTML' : 'Plain Text'}</span>
                    <Button
                      variant={bodyViewMode === 'html' ? 'secondary' : 'ghost'}
                      size="sm"
                      onClick={() => setBodyViewMode(bodyViewMode === 'html' ? 'text' : 'html')}
                      title="Toggle HTML mode"
                    >
                      <Code2 className="h-4 w-4 mr-1" />
                      {bodyViewMode === 'html' ? 'HTML' : 'Plain Text'}
                    </Button>
                  </div>
                </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Compose your template. Use the toolbar to insert variables or switch to HTML editing.
                </p>
                <VariableHelper variables={variables} onInsert={handleBodyInsert} />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-1 border rounded-md px-2 py-1 bg-muted/40">
                <Button variant="ghost" size="icon" aria-label="Font">
                  <Type className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Bold">
                  <Bold className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Italic">
                  <Italic className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Bulleted list">
                  <List className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Numbered list">
                  <ListOrdered className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Align left">
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Align center">
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Align right">
                  <AlignRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Insert link">
                  <Link className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Insert image">
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Insert video">
                  <Video className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Emoji">
                  <Smile className="h-4 w-4" />
                </Button>
                <div className="ml-auto flex items-center gap-1">
                  <Button variant="ghost" size="icon" aria-label="Undo">
                    <Undo className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Redo">
                    <Redo className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={bodyViewMode === 'html' ? 'secondary' : 'ghost'}
                    size="icon"
                    aria-label="Switch to HTML"
                    onClick={() => setBodyViewMode(bodyViewMode === 'html' ? 'text' : 'html')}
                  >
                    <Code2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Textarea
                id="body"
                ref={bodyViewMode === 'html' ? htmlRef : textRef}
                value={bodyValue}
                onChange={(e) =>
                  bodyViewMode === 'html'
                    ? setBodyHtmlTemplate(e.target.value)
                    : setBodyTextTemplate(e.target.value)
                }
                placeholder={
                  bodyViewMode === 'html'
                    ? '<p>Dear {{recipientName}},</p>...'
                    : 'Dear {{recipientName}}, ...'
                }
                maxLength={50000}
                rows={18}
                className="font-mono text-sm"
              />
              <p className="text-muted-foreground text-xs">
                {bodyValue.length} / 50000 characters
              </p>
            </CardContent>
          </Card>
        </div>

        <TemplatePreview
          open={showPreview}
          onOpenChange={setShowPreview}
          preview={preview}
          loading={previewLoading}
        />
      </PageBody>
    </PageShell>
  );
}
