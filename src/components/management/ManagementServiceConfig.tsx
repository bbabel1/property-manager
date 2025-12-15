'use client';

import { useState, useEffect, useCallback } from 'react';
import { ManagementServiceConfig } from '@/lib/management-service';
import { SERVICE_PLAN_OPTIONS, toServicePlan } from '@/lib/service-plan';

interface ManagementServiceConfigProps {
  propertyId: string;
  unitId?: string;
  onConfigChange?: (config: ManagementServiceConfig) => void;
}

const ACTIVE_SERVICES = [
  'Rent Collection',
  'Maintenance',
  'Turnovers',
  'Compliance',
  'Bill Pay',
  'Condition Reports',
  'Renewals',
];

export default function ManagementServiceConfigComponent({
  propertyId,
  unitId,
  onConfigChange,
}: ManagementServiceConfigProps) {
  const [config, setConfig] = useState<ManagementServiceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const loadConfiguration = useCallback(async () => {
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

      const normalized = {
        ...result.data,
        service_plan: toServicePlan(result.data?.service_plan),
      } as ManagementServiceConfig;

      setConfig(normalized);
      onConfigChange?.(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [propertyId, unitId, onConfigChange]);

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  const saveConfiguration = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);

      const params = new URLSearchParams({ propertyId });
      if (unitId) params.append('unitId', unitId);

      const response = await fetch(`/api/management-service/config?${params}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save configuration');
      }

      setEditing(false);
      onConfigChange?.(config);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (updates: Partial<ManagementServiceConfig>) => {
    if (!config) return;
    setConfig({ ...config, ...updates });
  };

  const toggleService = (service: string) => {
    if (!config) return;

    const currentServices = config.active_services || [];
    const updatedServices = currentServices.includes(service)
      ? currentServices.filter((s) => s !== service)
      : [...currentServices, service];

    const updates: Partial<ManagementServiceConfig> = {
      active_services: updatedServices.length > 0 ? updatedServices : null,
    };

    if (!updatedServices.includes('Bill Pay')) {
      updates.bill_pay_list = null;
      updates.bill_pay_notes = null;
    }

    updateConfig(updates);
  };

  const hasBillPay = Boolean(config?.active_services?.includes('Bill Pay'));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-gray-600">Loading service configuration...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4">
        <div className="text-sm text-red-800">
          <strong>Error:</strong> {error}
        </div>
        <button
          onClick={loadConfiguration}
          className="mt-2 text-sm text-red-600 underline hover:text-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!config) {
    return <div className="p-4 text-sm text-gray-600">No service configuration found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Management Service Configuration</h3>
          <p className="text-sm text-gray-600">
            Source: {config.source === 'property' ? 'Property Level' : 'Unit Level'}
            {config.unit_id && ` (Unit: ${config.unit_id})`}
          </p>
        </div>
        <div className="flex space-x-2">
          {editing ? (
            <>
              <button
                onClick={() => {
                  setEditing(false);
                  loadConfiguration(); // Reset to original values
                }}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={saveConfiguration}
                disabled={saving}
                className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Service Plan */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Service Plan</label>
        {editing ? (
          <select
            value={config.service_plan || ''}
            onChange={(e) => updateConfig({ service_plan: toServicePlan(e.target.value) })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            aria-label="Service Plan"
          >
            <option value="">Select service plan...</option>
            {SERVICE_PLAN_OPTIONS.map((plan) => {
              const label = plan === 'A-la-carte' ? 'A-la-carte Service' : `${plan} Service`;
              return (
                <option key={plan} value={plan}>
                  {label}
                </option>
              );
            })}
          </select>
        ) : (
          <div className="text-sm text-gray-900">{config.service_plan || 'Not set'}</div>
        )}
      </div>

      {/* Active Services */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Active Services</label>
        {editing ? (
          <div className="space-y-2">
            {ACTIVE_SERVICES.map((service) => (
              <label key={service} className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.active_services?.includes(service) || false}
                  onChange={() => toggleService(service)}
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{service}</span>
              </label>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-900">
            {config.active_services && config.active_services.length > 0 ? (
              <ul className="list-inside list-disc space-y-1">
                {config.active_services.map((service) => (
                  <li key={service}>{service}</li>
                ))}
              </ul>
            ) : (
              'No services selected'
            )}
          </div>
        )}
      </div>

      {hasBillPay && (
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Bill Pay List</label>
            {editing ? (
              <textarea
                value={config.bill_pay_list || ''}
                onChange={(e) => updateConfig({ bill_pay_list: e.target.value || null })}
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter the bills to be paid..."
              />
            ) : (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 whitespace-pre-line">
                {config.bill_pay_list?.trim()?.length ? config.bill_pay_list : 'No bill pay list provided'}
              </div>
            )}
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Bill Pay Notes</label>
            {editing ? (
              <textarea
                value={config.bill_pay_notes || ''}
                onChange={(e) => updateConfig({ bill_pay_notes: e.target.value || null })}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add any additional bill pay instructions..."
              />
            ) : (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 whitespace-pre-line">
                {config.bill_pay_notes?.trim()?.length ? config.bill_pay_notes : 'No bill pay notes provided'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
