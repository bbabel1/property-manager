'use client';

import { useEffect, useState } from 'react';
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
import { Loader2 } from 'lucide-react';

type GeoserviceConfig = {
  geoservice_base_url: string | null;
  geoservice_api_key_masked: string | null;
  has_geoservice_api_key: boolean;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export function NYCGeoserviceForm({ isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<GeoserviceConfig | null>(null);
  const [baseUrl, setBaseUrl] = useState('https://api.nyc.gov/geoclient/v2/');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/nyc-data/integration');
        if (!res.ok) throw new Error('Failed to load NYC Geoservice config');
        const data = await res.json();
        setConfig(data);
        setBaseUrl(data.geoservice_base_url || baseUrl);
        setApiKey('');
      } catch (err) {
        console.error(err);
        toast.error('Failed to load NYC Geoservice config');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/nyc-data/integration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geoserviceBaseUrl: baseUrl,
          geoserviceApiKey: apiKey || undefined,
          geoserviceApiKeyUnchanged: !apiKey && config?.has_geoservice_api_key,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || 'Failed to save NYC Geoservice config');
      }
      toast.success('NYC Geoservice saved');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save NYC Geoservice config');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="w-[680px] max-w-[680px]">
        <DialogHeader>
          <DialogTitle>NYC Geoservice</DialogTitle>
          <DialogDescription>
            Provide the Geoservice Base URL and API Key for address → BIN/BBL lookups.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Base URL</Label>
            <Input
              value={baseUrl}
              disabled={loading || saving}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.nyc.gov/geoclient/v2/"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Subscription Key</Label>
            <Input
              type="password"
              value={apiKey}
              disabled={loading || saving}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.geoservice_api_key_masked || 'Enter subscription key'}
            />
            {config?.has_geoservice_api_key && !apiKey && (
              <p className="text-muted-foreground text-xs">
                Leaving blank keeps the existing subscription key.
              </p>
            )}
          </div>
        </div>
        <DialogFooter className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
