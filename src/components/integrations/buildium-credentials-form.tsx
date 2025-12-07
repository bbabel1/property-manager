'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

type BuildiumIntegrationStatus = {
  is_enabled: boolean;
  has_credentials: boolean;
  last_tested_at: string | null;
  webhook_secret_rotated_at: string | null;
  base_url: string | null;
  masked_client_id: string | null;
  masked_client_secret: string | null;
  masked_webhook_secret: string | null;
};

type BuildiumCredentialsFormProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialStatus?: BuildiumIntegrationStatus | null;
};

export function BuildiumCredentialsForm({
  isOpen,
  onClose,
  onSuccess,
  initialStatus,
}: BuildiumCredentialsFormProps) {
  const [formData, setFormData] = useState({
    clientId: '',
    clientSecret: '',
    baseUrl: 'https://apisandbox.buildium.com/v1',
    webhookSecret: '',
    isEnabled: false,
  });
  const [unchangedFields, setUnchangedFields] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Load initial status when dialog opens
  useEffect(() => {
    if (isOpen && initialStatus) {
      setFormData({
        clientId: '',
        clientSecret: '',
        baseUrl: initialStatus.base_url || 'https://apisandbox.buildium.com/v1',
        webhookSecret: '',
        isEnabled: initialStatus.is_enabled,
      });
      // Mark all secret fields as unchanged initially
      setUnchangedFields(new Set(['clientId', 'clientSecret', 'webhookSecret']));
      setHasChanges(false);
      setTestError(null);
    }
  }, [isOpen, initialStatus]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // If field is cleared and was marked as unchanged, remove from unchanged set
    if (value === '' && unchangedFields.has(field)) {
      setUnchangedFields((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }
    
    // If field has value and was unchanged, mark as changed
    if (value !== '' && unchangedFields.has(field)) {
      setUnchangedFields((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
    }

    setHasChanges(true);
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestError(null);

    try {
      // First, save credentials if this is a new integration or if fields changed
      if (!initialStatus?.has_credentials || hasChanges) {
        const response = await fetch('/api/buildium/integration', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: formData.clientId || undefined,
            clientSecret: formData.clientSecret || undefined,
            baseUrl: formData.baseUrl || undefined,
            webhookSecret: formData.webhookSecret || undefined,
            isEnabled: formData.isEnabled,
            unchangedFields: Array.from(unchangedFields),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error?.message || 'Failed to save credentials');
        }
      }

      // Then test connection
      const testResponse = await fetch('/api/buildium/integration/status', {
        method: 'POST',
      });

      if (!testResponse.ok) {
        const testData = await testResponse.json();
        const errorMessage =
          testData.error?.code === 'auth_failed'
            ? 'Authentication failed. Please check your Client ID and Client Secret.'
            : testData.error?.code === 'network_error'
            ? `Network error: ${testData.error?.message || 'Failed to connect to Buildium API'}`
            : testData.error?.message || 'Connection test failed';
        setTestError(errorMessage);
        toast.error('Connection test failed', { description: errorMessage });
        return;
      }

      toast.success('Connection test successful', {
        description: 'Buildium API connection is working correctly.',
      });
      setTestError(null);
      onSuccess(); // Refresh status
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      setTestError(errorMessage);
      toast.error('Connection test failed', { description: errorMessage });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/buildium/integration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: formData.clientId || undefined,
          clientSecret: formData.clientSecret || undefined,
          baseUrl: formData.baseUrl || undefined,
          webhookSecret: formData.webhookSecret || undefined,
          isEnabled: formData.isEnabled,
          unchangedFields: Array.from(unchangedFields),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to save credentials');
      }

      toast.success('Buildium credentials saved', {
        description: 'Your Buildium integration has been updated successfully.',
      });
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to save credentials', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete the Buildium integration? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/buildium/integration', {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error?.message || 'Failed to delete integration');
      }

      toast.success('Buildium integration deleted', {
        description: 'Your Buildium integration has been removed.',
      });
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Failed to delete integration', {
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buildium Integration Settings</DialogTitle>
          <DialogDescription>
            Configure your Buildium API credentials. Leave fields empty to keep existing values unchanged.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Status Information */}
          {initialStatus && (
            <div className="space-y-2 p-4 bg-muted rounded-lg">
              <div className="text-sm font-medium">Status Information</div>
              {initialStatus.last_tested_at && (
                <div className="text-xs text-muted-foreground">
                  Last tested: {formatDate(initialStatus.last_tested_at)}
                </div>
              )}
              {initialStatus.webhook_secret_rotated_at && (
                <div className="text-xs text-muted-foreground">
                  Webhook secret rotated: {formatDate(initialStatus.webhook_secret_rotated_at)}
                </div>
              )}
              {initialStatus.has_credentials && (
                <div className="text-xs text-muted-foreground">
                  Current credentials: {initialStatus.masked_client_id || '***'}
                </div>
              )}
            </div>
          )}

          {/* Base URL */}
          <div className="space-y-2">
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              type="url"
              value={formData.baseUrl}
              onChange={(e) => handleInputChange('baseUrl', e.target.value)}
              placeholder="https://apisandbox.buildium.com/v1"
              required
            />
            <p className="text-xs text-muted-foreground">
              Must be apisandbox.buildium.com (sandbox) or api.buildium.com (production)
            </p>
          </div>

          {/* Client ID */}
          <div className="space-y-2">
            <Label htmlFor="clientId">Client ID</Label>
            <Input
              id="clientId"
              type="text"
              value={formData.clientId}
              onChange={(e) => handleInputChange('clientId', e.target.value)}
              placeholder={initialStatus?.masked_client_id || 'Enter Client ID'}
              required={!initialStatus?.has_credentials}
            />
            <p className="text-xs text-muted-foreground">
              {initialStatus?.has_credentials
                ? 'Leave empty to keep existing value'
                : 'Required for new integration'}
            </p>
          </div>

          {/* Client Secret */}
          <div className="space-y-2">
            <Label htmlFor="clientSecret">Client Secret</Label>
            <Input
              id="clientSecret"
              type="password"
              value={formData.clientSecret}
              onChange={(e) => handleInputChange('clientSecret', e.target.value)}
              placeholder={initialStatus?.masked_client_secret || 'Enter Client Secret'}
              required={!initialStatus?.has_credentials}
            />
            <p className="text-xs text-muted-foreground">
              {initialStatus?.has_credentials
                ? 'Leave empty to keep existing value'
                : 'Required for new integration'}
            </p>
          </div>

          {/* Webhook Secret */}
          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Webhook Secret</Label>
            <Input
              id="webhookSecret"
              type="password"
              value={formData.webhookSecret}
              onChange={(e) => handleInputChange('webhookSecret', e.target.value)}
              placeholder={initialStatus?.masked_webhook_secret || 'Enter Webhook Secret'}
              required={!initialStatus?.has_credentials}
            />
            <p className="text-xs text-muted-foreground">
              {initialStatus?.has_credentials
                ? 'Leave empty to keep existing value'
                : 'Required for new integration'}
            </p>
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="isEnabled">Enable Integration</Label>
              <p className="text-xs text-muted-foreground">
                When enabled, Buildium sync operations will use these credentials
              </p>
            </div>
            <Switch
              id="isEnabled"
              checked={formData.isEnabled}
              onCheckedChange={(checked) => handleInputChange('isEnabled', checked)}
            />
          </div>

          {/* Test Error */}
          {testError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{testError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isLoading || isTesting}
              >
                {isTesting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              {initialStatus?.has_credentials && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isLoading || isTesting}
                >
                  Delete
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading || isTesting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || isTesting}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

