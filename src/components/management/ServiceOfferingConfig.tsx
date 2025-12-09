'use client';

import { useState, useEffect, useCallback } from 'react';
import { ManagementServiceConfig, ServiceOffering } from '@/lib/management-service';
import { ServicePricingConfig } from '@/lib/service-pricing';
import { formatCurrency } from '@/lib/format-currency';

interface ServiceOfferingConfigProps {
  propertyId: string;
  unitId?: string;
  servicePlan: string | null;
  onConfigChange?: (config: {
    selectedOfferings: string[];
    pricingOverrides: Record<string, Partial<ServicePricingConfig>>;
  }) => void;
}

interface OfferingWithPricing extends ServiceOffering {
  isSelected: boolean;
  isIncluded: boolean;
  isOptional: boolean;
  pricing?: ServicePricingConfig;
  defaultPricing?: {
    rate: number | null;
    frequency: string;
    min_amount: number | null;
    max_amount: number | null;
  };
}

const SERVICE_PLAN_OPTIONS = [
  { value: 'Full', label: 'Full Service' },
  { value: 'Basic', label: 'Basic Service' },
  { value: 'A-la-carte', label: 'A-la-Carte' },
  { value: 'Custom', label: 'Custom' },
];

export default function ServiceOfferingConfig({
  propertyId,
  unitId,
  servicePlan,
  onConfigChange,
}: ServiceOfferingConfigProps) {
  const [offerings, setOfferings] = useState<OfferingWithPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [selectedOfferings, setSelectedOfferings] = useState<Set<string>>(new Set());
  const [pricingOverrides, setPricingOverrides] = useState<
    Record<string, Partial<ServicePricingConfig>>
  >({});

  const loadOfferings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch service configuration (includes service_offerings when feature flag is on)
      const params = new URLSearchParams({ propertyId });
      if (unitId) params.append('unitId', unitId);

      const configResponse = await fetch(`/api/management-service/config?${params}`);
      const configResult = await configResponse.json();

      if (!configResponse.ok) {
        throw new Error(configResult.error || 'Failed to load service configuration');
      }

      const config: ManagementServiceConfig = configResult.data;

      // Fetch pricing configuration
      const pricingParams = new URLSearchParams({ propertyId });
      if (unitId) pricingParams.append('unitId', unitId);

      const pricingResponse = await fetch(`/api/service-pricing?${pricingParams}`);
      const pricingResult = await pricingResponse.json();
      const pricingConfigs: ServicePricingConfig[] = pricingResult.data || [];

      // Map pricing configs by offering_id
      const pricingByOffering = new Map<string, ServicePricingConfig>();
      pricingConfigs.forEach((pricing) => {
        if (pricing.offering_id) {
          pricingByOffering.set(pricing.offering_id, pricing);
        }
      });

      // Process offerings
      if (config.service_offerings && config.service_offerings.length > 0) {
        const processedOfferings: OfferingWithPricing[] = config.service_offerings.map(
          (offering) => {
            const pricing = pricingByOffering.get(offering.id);
            const isSelected = pricing?.is_active === true || selectedOfferings.has(offering.id);

            return {
              ...offering,
              isSelected,
              isIncluded: false, // Will be set from plan mappings
              isOptional: false,
              pricing: pricing || undefined,
              defaultPricing: {
                rate: offering.default_rate,
                frequency: offering.default_freq,
                min_amount: offering.min_amount,
                max_amount: offering.max_amount,
              },
            };
          },
        );

        // Group by category
        const grouped = processedOfferings.reduce(
          (acc, offering) => {
            const category = offering.category || 'Other';
            if (!acc[category]) {
              acc[category] = [];
            }
            acc[category].push(offering);
            return acc;
          },
          {} as Record<string, OfferingWithPricing[]>,
        );

        // Flatten and sort by category
        const sortedOfferings: OfferingWithPricing[] = [];
        const categoryOrder = [
          'Financial Management',
          'Property Care',
          'Resident Services',
          'Compliance & Legal',
        ];
        categoryOrder.forEach((category) => {
          if (grouped[category]) {
            sortedOfferings.push(...grouped[category]);
          }
        });
        // Add any remaining categories
        Object.keys(grouped).forEach((category) => {
          if (!categoryOrder.includes(category)) {
            sortedOfferings.push(...grouped[category]);
          }
        });

        setOfferings(sortedOfferings);
        const selectedIds = sortedOfferings.filter((o) => o.isSelected).map((o) => o.id);
        setSelectedOfferings(new Set(selectedIds));
        onConfigChange?.({
          selectedOfferings: selectedIds,
          pricingOverrides,
        });
      } else {
        // Fallback: use legacy services if new catalog not available
        const legacyServices = config.active_services || [];
        setOfferings([]);
        setSelectedOfferings(new Set());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load service offerings');
    } finally {
      setLoading(false);
    }
  }, [propertyId, unitId]);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const toggleOffering = async (offeringId: string) => {
    const offering = offerings.find((o) => o.id === offeringId);
    const newSelected = new Set(selectedOfferings);
    if (newSelected.has(offeringId)) {
      newSelected.delete(offeringId);
      // Deactivate pricing
      const params = new URLSearchParams({ propertyId, offeringId });
      if (unitId) params.append('unitId', unitId);
      await fetch(`/api/service-pricing?${params.toString()}`, {
        method: 'DELETE',
      });
    } else {
      newSelected.add(offeringId);
      // Create pricing record (will use defaults)
      const rentBasis =
        offering?.billing_basis === 'percent_rent' ? 'scheduled' : undefined;
      await fetch('/api/service-pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_id: propertyId,
          unit_id: unitId || null,
          offering_id: offeringId,
          billing_basis: offering?.billing_basis || 'per_property',
          billing_frequency: offering?.default_freq || 'monthly',
          bill_on: offering?.bill_on || 'calendar_day',
          rent_basis: rentBasis,
        }),
      });
    }
    setSelectedOfferings(newSelected);
    onConfigChange?.({
      selectedOfferings: Array.from(newSelected),
      pricingOverrides,
    });
  };

  const updatePricingOverride = async (
    offeringId: string,
    updates: Partial<ServicePricingConfig>,
  ) => {
    const offering = offerings.find((o) => o.id === offeringId);
    if (!offering) return;

    const currentPricing = offering.pricing;
    const rentBasis =
        (updates.billing_basis || offering.billing_basis) === 'percent_rent'
          ? updates.rent_basis || currentPricing?.rent_basis || 'scheduled'
          : updates.rent_basis;
    const newPricing = {
      ...currentPricing,
      ...updates,
      property_id: propertyId,
      unit_id: unitId || null,
      offering_id: offeringId,
      rent_basis: rentBasis,
    };

    await fetch('/api/service-pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPricing),
    });

    setPricingOverrides({
      ...pricingOverrides,
      [offeringId]: updates,
    });

    onConfigChange?.({
      selectedOfferings: Array.from(selectedOfferings),
      pricingOverrides: {
        ...pricingOverrides,
        [offeringId]: updates,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground text-sm">Loading service offerings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-destructive bg-destructive/10 rounded-md border p-4">
        <div className="text-destructive text-sm">
          <strong>Error:</strong> {error}
        </div>
        <button
          onClick={loadOfferings}
          className="text-destructive hover:text-destructive/80 mt-2 text-sm underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Group offerings by category
  const offeringsByCategory = offerings.reduce(
    (acc, offering) => {
      const category = offering.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(offering);
      return acc;
    },
    {} as Record<string, OfferingWithPricing[]>,
  );

  const categoryOrder = [
    'Financial Management',
    'Property Care',
    'Resident Services',
    'Compliance & Legal',
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Service Offerings</h3>
        <button
          onClick={() => setEditing(!editing)}
          className="text-primary hover:text-primary/80 text-sm"
        >
          {editing ? 'Done' : 'Edit'}
        </button>
      </div>

      {servicePlan && (
        <div className="bg-muted rounded-md p-3">
          <div className="text-sm font-medium">Current Plan: {servicePlan}</div>
          {servicePlan === 'Basic' || servicePlan === 'Full' ? (
            <div className="text-muted-foreground mt-1 text-xs">
              Services included in this plan are automatically selected. You can add additional
              services.
            </div>
          ) : (
            <div className="text-muted-foreground mt-1 text-xs">
              Select individual services for this{' '}
              {servicePlan === 'Custom' ? 'custom' : 'a-la-carte'} plan.
            </div>
          )}
        </div>
      )}

      {categoryOrder.map((category) => {
        const categoryOfferings = offeringsByCategory[category] || [];
        if (categoryOfferings.length === 0) return null;

        return (
          <div key={category} className="space-y-3">
            <h4 className="text-foreground text-sm font-semibold">{category}</h4>
            <div className="space-y-2">
              {categoryOfferings.map((offering) => {
                const isSelected = selectedOfferings.has(offering.id);
                const pricing = offering.pricing || offering.defaultPricing;

                return (
                  <div
                    key={offering.id}
                    className={`rounded-md border p-3 ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {editing &&
                            (servicePlan === 'A-la-carte' || servicePlan === 'Custom') && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleOffering(offering.id)}
                                className="text-primary focus:ring-primary h-4 w-4 rounded border-gray-300"
                              />
                            )}
                          <div>
                            <div className="text-foreground font-medium">{offering.name}</div>
                            {offering.description && (
                              <div className="text-muted-foreground mt-1 text-xs">
                                {offering.description}
                              </div>
                            )}
                          </div>
                        </div>
                        {pricing && (
                          <div className="text-muted-foreground mt-2 text-xs">
                            <div>
                              Pricing: {pricing.rate ? formatCurrency(pricing.rate) : 'N/A'} /{' '}
                              {pricing.frequency || offering.defaultPricing?.frequency}
                            </div>
                            {pricing.min_amount && (
                              <div>Min: {formatCurrency(pricing.min_amount)}</div>
                            )}
                            {pricing.max_amount && (
                              <div>Max: {formatCurrency(pricing.max_amount)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Show any remaining categories */}
      {Object.keys(offeringsByCategory)
        .filter((cat) => !categoryOrder.includes(cat))
        .map((category) => {
          const categoryOfferings = offeringsByCategory[category] || [];
          if (categoryOfferings.length === 0) return null;

          return (
            <div key={category} className="space-y-3">
              <h4 className="text-foreground text-sm font-semibold">{category}</h4>
              <div className="space-y-2">
                {categoryOfferings.map((offering) => {
                  const isSelected = selectedOfferings.has(offering.id);
                  return (
                    <div
                      key={offering.id}
                      className={`rounded-md border p-3 ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <div className="text-foreground font-medium">{offering.name}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}
