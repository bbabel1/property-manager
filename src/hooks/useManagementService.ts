import { useState, useEffect, useCallback } from 'react';
import { ManagementServiceConfig } from '@/lib/management-service';

interface UseManagementServiceOptions {
  propertyId: string;
  unitId?: string;
  autoLoad?: boolean;
}

interface UseManagementServiceReturn {
  config: ManagementServiceConfig | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  loadConfig: () => Promise<void>;
  updateConfig: (updates: Partial<ManagementServiceConfig>) => Promise<void>;
  refreshConfig: () => Promise<void>;
}

export function useManagementService({
  propertyId,
  unitId,
  autoLoad = true,
}: UseManagementServiceOptions): UseManagementServiceReturn {
  const [config, setConfig] = useState<ManagementServiceConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ propertyId });
      if (unitId) params.append('unitId', unitId);

      const response = await fetch(`/api/management-service/config?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load configuration');
      }

      setConfig(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [propertyId, unitId]);

  const updateConfig = useCallback(
    async (updates: Partial<ManagementServiceConfig>) => {
      try {
        setSaving(true);
        setError(null);

        const params = new URLSearchParams({ propertyId });
        if (unitId) params.append('unitId', unitId);

        const response = await fetch(`/api/management-service/config?${params}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to update configuration');
        }

        // Update local state with the changes
        setConfig((prev) => (prev ? { ...prev, ...updates } : null));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update configuration');
        throw err; // Re-throw so calling code can handle it
      } finally {
        setSaving(false);
      }
    },
    [propertyId, unitId],
  );

  const refreshConfig = useCallback(async () => {
    await loadConfig();
  }, [loadConfig]);

  // Auto-load on mount and when dependencies change
  useEffect(() => {
    if (autoLoad) {
      loadConfig();
    }
  }, [loadConfig, autoLoad]);

  return {
    config,
    loading,
    saving,
    error,
    loadConfig,
    updateConfig,
    refreshConfig,
  };
}

/**
 * Hook to get all units service configurations for a property
 */
export function useUnitsServiceConfigurations(propertyId: string) {
  const [configs, setConfigs] = useState<Array<ManagementServiceConfig & { unit_number: string }>>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/management-service/units', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load units configurations');
      }

      setConfigs(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load units configurations');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  return {
    configs,
    loading,
    error,
    refresh: loadConfigs,
  };
}
