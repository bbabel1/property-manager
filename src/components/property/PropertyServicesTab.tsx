'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import CollapsibleSummaryStats from './services/CollapsibleSummaryStats';
import RightPanelOverview from './services/RightPanelOverview';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/transactions/formatting';
import { useIsMobile } from '@/components/ui/use-mobile';
import { ManagementServiceConfig, ServiceOffering } from '@/lib/management-service';
import { ServicePricingConfig, ServicePricingPreview } from '@/lib/service-pricing';
import ServicesLeftPanel from './services/ServicesLeftPanel';
import ServicesRightPanel from './services/ServicesRightPanel';
import ServicesList from './services/ServicesList';
import ServiceDetailView from './services/ServiceDetailView';
import MonthlyCostEstimate from './services/MonthlyCostEstimate';
import BulkPricingModal from '@/components/services/BulkPricingModal';
import PricingHistoryTimeline from '@/components/services/PricingHistoryTimeline';
import { calculateMonthlyCost } from '@/lib/services/cost-calculator';

interface PropertyServicesTabProps {
  propertyId: string;
  property: {
    id: string;
    name?: string;
    service_plan?: string | null;
    service_assignment?: string | null;
    units?: Array<{ id: string; unit_number: string | null; unit_name: string | null }>;
  };
}

interface OfferingWithPricing extends ServiceOffering {
  isSelected: boolean;
  isIncluded: boolean;
  isOptional: boolean;
  pricing?: ServicePricingConfig;
  defaultPricing?: ServicePricingPreview;
}

type LeaseForEstimate = {
  id?: number | string;
  unit_id?: string | null;
  property_id?: string | null;
  status?: string | null;
  rent_amount?: number | null;
};

export default function PropertyServicesTab({ propertyId, property }: PropertyServicesTabProps) {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [servicePlan] = useState<string | null>(property.service_plan || null);
  const [units, setUnits] = useState<
    Array<{ id: string; unit_number: string | null; unit_name: string | null }>
  >(property.units || []);

  // State management
  const [offerings, setOfferings] = useState<OfferingWithPricing[]>([]);
  const [pricingConfigs, setPricingConfigs] = useState<ServicePricingConfig[]>([]);
  const [services, setServices] = useState<ServiceOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leases, setLeases] = useState<LeaseForEstimate[]>([]);

  const toPricingPreview = useCallback(
    (pricing?: ServicePricingConfig | null): ServicePricingPreview | undefined => {
      if (!pricing) return undefined;
      return {
        rate: pricing.rate,
        billing_frequency: pricing.billing_frequency,
        min_amount: pricing.min_amount ?? null,
        max_amount: pricing.max_amount ?? null,
        billing_basis: pricing.billing_basis,
        effective_start: pricing.effective_start,
        effective_end: pricing.effective_end,
      };
    },
    [],
  );

  // UI state
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Selection state
  const [selectedOfferings, setSelectedOfferings] = useState<Set<string>>(new Set());
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});

  // Load data
  useEffect(() => {
    loadUnits();
    loadAllData();
  }, [propertyId]);

  const loadUnits = async () => {
    if (!units.length) {
      try {
        const res = await fetch(`/api/properties/${propertyId}/details`);
        const data = await res.json();
        if (data.units) {
          setUnits(data.units);
        }
      } catch (err) {
        console.error('Error loading units:', err);
      }
    }
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all service offerings from catalog
      const catalogResponse = await fetch('/api/services/catalog');
      const catalogResult = await catalogResponse.json();
      if (!catalogResponse.ok) {
        throw new Error(
          catalogResult?.error?.message || catalogResult?.error || 'Failed to load service offerings',
        );
      }
      const allOfferings: ServiceOffering[] = catalogResult.data || [];
      setServices(allOfferings);

      // Fetch service configuration
      const params = new URLSearchParams({ propertyId });
      const configResponse = await fetch(`/api/management-service/config?${params}`);
      const configResult = await configResponse.json();

      if (!configResponse.ok) {
        throw new Error(configResult.error || 'Failed to load service configuration');
      }

      const config: ManagementServiceConfig = configResult.data;

      // Fetch pricing configuration
      const pricingParams = new URLSearchParams({ propertyId });
      const pricingResponse = await fetch(`/api/service-pricing?${pricingParams}`);
      const pricingResult = await pricingResponse.json();
      const pricingConfigsData: ServicePricingConfig[] = pricingResult.data || [];
      setPricingConfigs(pricingConfigsData);

      // Fetch leases for rent-based estimates (filter to active leases tied to this property)
      try {
        const leasesResponse = await fetch(`/api/leases?propertyId=${propertyId}`);
        if (leasesResponse.ok) {
          const leasesResult = await leasesResponse.json();
          const leasesData: LeaseForEstimate[] = Array.isArray(leasesResult)
            ? leasesResult
            : [];
          const activeLeases = leasesData.filter((lease) => {
            const status = typeof lease.status === 'string' ? lease.status.toLowerCase() : '';
            if (status !== 'active') return false;
            const unitId = lease.unit_id ? String(lease.unit_id) : '';
            const propId = lease.property_id ? String(lease.property_id) : '';
            return Boolean(unitId) && propId === propertyId;
          });
          setLeases(activeLeases);
        } else {
          setLeases([]);
        }
      } catch (leaseErr) {
        console.warn('Failed to load leases for monthly estimate:', leaseErr);
        setLeases([]);
      }

      // Map pricing configs by offering_id
      const pricingByOffering = new Map<string, ServicePricingConfig>();
      pricingConfigsData.forEach((pricing) => {
        if (pricing.offering_id) {
          pricingByOffering.set(pricing.offering_id, pricing);
        }
      });

      // Fetch plan mappings to determine included services
      let includedOfferingIds = new Set<string>();
      if (servicePlan) {
        try {
          const planMappingsResponse = await fetch(
            `/api/services/plan-offerings?plan=${servicePlan}`,
          );
          if (planMappingsResponse.ok) {
            const planMappings = await planMappingsResponse.json();
            includedOfferingIds = new Set(
              (planMappings.data || [])
                .filter((m: any) => m.is_included === true)
                .map((m: any) => m.offering_id),
            );
          }
        } catch (err) {
          console.warn('Failed to fetch plan mappings:', err);
        }
      }

      // Process offerings
      if (allOfferings.length > 0) {
        const processedOfferings: OfferingWithPricing[] = allOfferings.map((offering) => {
          const pricing = pricingByOffering.get(offering.id);
          const isSelected = pricing?.is_active === true;
          const isIncluded = includedOfferingIds.has(offering.id);

          return {
            ...offering,
            isSelected: isSelected || isIncluded,
            isIncluded,
            isOptional: !isIncluded,
            pricing: pricing || undefined,
            defaultPricing: {
              rate: offering.default_rate ?? null,
              billing_frequency: offering.default_freq,
              min_amount: offering.min_amount ?? null,
              max_amount: offering.max_amount ?? null,
              billing_basis: offering.billing_basis,
            },
          };
        });

        setOfferings(processedOfferings);
        const selectedIds = processedOfferings.filter((o) => o.isSelected).map((o) => o.id);
        setSelectedOfferings(new Set(selectedIds));
        
        // Auto-select first enabled service on desktop if none selected
        if (!selectedServiceId && processedOfferings.length > 0) {
          const firstEnabled = processedOfferings.find((o) => o.isSelected);
          if (firstEnabled) {
            setSelectedServiceId(firstEnabled.id);
          } else if (processedOfferings.length > 0) {
            // Select first service even if not enabled
            setSelectedServiceId(processedOfferings[0].id);
          }
        }
      } else {
        setOfferings([]);
        setSelectedOfferings(new Set());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load service offerings');
    } finally {
      setLoading(false);
    }
  };

  const toggleOffering = async (offeringId: string) => {
    const offering = offerings.find((o) => o.id === offeringId);
    if (!offering) return;
    if (pendingToggles.has(offeringId)) return;

    const previous = new Set(selectedOfferings);
    const nextSelection = new Set(selectedOfferings);
    const updatedPending = new Set(pendingToggles);
    updatedPending.add(offeringId);
    setPendingToggles(updatedPending);
    setActionErrors((prev) => {
      const copy = { ...prev };
      delete copy[offeringId];
      return copy;
    });

    try {
      if (nextSelection.has(offeringId)) {
        nextSelection.delete(offeringId);
        const params = new URLSearchParams({ propertyId, offeringId });
        const resp = await fetch(`/api/service-pricing?${params.toString()}`, {
          method: 'DELETE',
        });
        if (!resp.ok) {
          throw new Error('Failed to remove pricing');
        }
      } else {
        nextSelection.add(offeringId);
        const rentBasis =
          offering.billing_basis === 'percent_rent' ? 'scheduled' : undefined;
        const resp = await fetch('/api/service-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId,
            unit_id: null,
            offering_id: offeringId,
            billing_basis: offering.billing_basis || 'per_property',
            billing_frequency: offering.default_freq || 'monthly',
            bill_on: offering.bill_on || 'calendar_day',
            rent_basis: rentBasis,
          }),
        });
        if (!resp.ok) {
          throw new Error('Failed to save pricing');
        }
      }

      setSelectedOfferings(nextSelection);
      await loadAllData();
    } catch (err) {
      setSelectedOfferings(previous);
      setActionErrors((prev) => ({
        ...prev,
        [offeringId]:
          err instanceof Error ? err.message : 'An unexpected error occurred while updating.',
      }));
      toast.error(
        err instanceof Error ? err.message : 'Failed to update service offering selection.',
      );
    } finally {
      setPendingToggles((prev) => {
        const copy = new Set(prev);
        copy.delete(offeringId);
        return copy;
      });
    }
  };

  const handleServiceSelect = (offeringId: string) => {
    setSelectedServiceId(offeringId);
    if (isMobile) {
      setIsRightPanelOpen(true);
    }
    // On desktop, the panel is always visible, so we just update the selection
    // The right panel will automatically show the selected service
  };

  // Auto-open right panel on mobile when service is selected
  useEffect(() => {
    if (isMobile && selectedServiceId && !isRightPanelOpen) {
      setIsRightPanelOpen(true);
    }
  }, [isMobile, selectedServiceId, isRightPanelOpen]);

  const handleBulkPricingSave = async (
    pricing: Array<{ unitId: string; pricing: Record<string, unknown> }>,
  ) => {
    try {
      const responses = await Promise.all(
        pricing.map((item) =>
          fetch('/api/service-pricing', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.pricing),
          }),
        ),
      );

      const failed = responses.find((res) => !res.ok);
      if (failed) {
        const message = await failed.text();
        throw new Error(message || 'Failed to save pricing for one or more units.');
      }

      toast.success(`Successfully applied pricing to ${pricing.length} unit${pricing.length === 1 ? '' : 's'}`);
      router.refresh();
      await loadAllData();
    } catch (err) {
      console.error('Error saving bulk pricing:', err);
      const message = err instanceof Error ? err.message : 'Failed to save bulk pricing';
      toast.error(message);
      throw err;
    }
  };

  // Calculate monthly cost estimate
  const costEstimate = useMemo(() => {
    return calculateMonthlyCost(pricingConfigs, services, leases);
  }, [pricingConfigs, services, leases]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(offerings.map((o) => o.category || 'Other'));
    return Array.from(cats).sort();
  }, [offerings]);

  // Get selected service
  const selectedService = useMemo(() => {
    if (!selectedServiceId) return null;
    return offerings.find((o) => o.id === selectedServiceId) || null;
  }, [selectedServiceId, offerings]);

  // Service stats
  const serviceStats = useMemo(() => {
    return {
      totalEnabled: selectedOfferings.size,
      totalMonthlyCost: costEstimate.total,
      selectedOfferings: Array.from(selectedOfferings),
    };
  }, [selectedOfferings, costEstimate]);

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
          onClick={loadAllData}
          className="text-destructive hover:text-destructive/80 mt-2 text-sm underline"
          aria-label="Retry loading service offerings"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Collapsible Summary Stats */}
      <CollapsibleSummaryStats
        totalEnabled={serviceStats.totalEnabled}
        totalMonthlyCost={serviceStats.totalMonthlyCost}
        servicePlan={servicePlan}
        serviceAssignment={property.service_assignment || undefined}
      />

      {/* Two-Panel Layout */}
      <div
        className={`grid gap-6 ${
          isMobile
            ? 'grid-cols-1'
            : 'md:grid-cols-[40%_60%] lg:grid-cols-[30%_70%]'
        }`}
      >
        {/* Left Panel */}
        <div
          className={`flex flex-col ${
            !isMobile ? 'lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]' : ''
          }`}
        >
          <ServicesLeftPanel
            servicePlan={servicePlan}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            categories={categories}
            isEditMode={isEditMode}
            onEditModeToggle={() => setIsEditMode(!isEditMode)}
          >
            {offerings.length === 0 ? (
              <div className="text-muted-foreground py-6 text-center text-sm">
                No service offerings available.
              </div>
            ) : (
              <ServicesList
                offerings={offerings}
                searchQuery={searchQuery}
                categoryFilter={categoryFilter}
                statusFilter={statusFilter}
                selectedOfferings={selectedOfferings}
                pendingToggles={pendingToggles}
                selectedServiceId={selectedServiceId}
                isEditMode={isEditMode}
                onToggle={toggleOffering}
                onSelect={handleServiceSelect}
                onEditPricing={(id) => {
                  setSelectedServiceId(id);
                  if (isMobile) setIsRightPanelOpen(true);
                }}
                onConfigureRules={(id) => {
                  setSelectedServiceId(id);
                  if (isMobile) setIsRightPanelOpen(true);
                }}
                onOverrideUnitLevel={(id) => {
                  // Open bulk pricing modal
                  if (units.length > 0) {
                    // This will be handled by the BulkPricingModal component
                  }
                }}
              />
            )}
          </ServicesLeftPanel>
        </div>

        {/* Right Panel */}
        <ServicesRightPanel
          isMobile={isMobile}
          isOpen={isRightPanelOpen}
          onClose={() => {
            setIsRightPanelOpen(false);
            if (isMobile) {
              setSelectedServiceId(null);
            }
          }}
          hasSelection={selectedServiceId !== null}
        >
          <div className="space-y-4">
            {/* Right Panel Content */}
            {selectedService ? (
              <>
                {/* Floating Monthly Cost Estimate - Only show when service selected */}
                {!isMobile && costEstimate.total > 0 && (
                  <MonthlyCostEstimate estimate={costEstimate} />
                )}
                <ServiceDetailView
                offering={{
                  id: selectedService.id,
                  name: selectedService.name,
                  description: selectedService.description,
                  category: selectedService.category,
                  isSelected: selectedService.isSelected,
                  isIncluded: selectedService.isIncluded,
                  pricing: toPricingPreview(selectedService.pricing),
                  pricingConfig: selectedService.pricing,
                  defaultPricing: selectedService.defaultPricing,
                }}
                propertyId={propertyId}
                isEditMode={isEditMode}
                onEdit={() => {
                  // TODO: Open edit pricing modal
                }}
                onDisable={() => {
                  toggleOffering(selectedService.id);
                }}
                onDuplicate={() => {
                  // TODO: Implement duplicate
                }}
                onPricingSave={async (pricingData) => {
                  try {
                    const response = await fetch('/api/service-pricing', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        ...pricingData,
                        property_id: propertyId,
                        offering_id: selectedService.id,
                      }),
                    });
                    if (!response.ok) {
                      throw new Error('Failed to save pricing');
                    }
                    toast.success('Pricing updated successfully');
                    await loadAllData();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to save pricing');
                    throw err;
                  }
                }}
                onRefresh={loadAllData}
              />
              </>
            ) : (
              <RightPanelOverview
                totalServices={offerings.length}
                enabledCount={serviceStats.totalEnabled}
                onStartEditing={() => setIsEditMode(true)}
              />
            )}

            {/* Bulk Pricing Modal Trigger */}
            {units.length > 0 && selectedServiceId && (
              <div className="flex justify-end">
                <BulkPricingModal
                  propertyId={propertyId}
                  offeringId={selectedServiceId}
                  offeringName={selectedService?.name || 'Selected Service'}
                  units={units}
                  onSave={handleBulkPricingSave}
                />
              </div>
            )}
          </div>
        </ServicesRightPanel>
      </div>
    </div>
  );
}
