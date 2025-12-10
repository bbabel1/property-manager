'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ManagementServiceConfig, ServiceOffering } from '@/lib/management-service';
import { ServicePricingConfig } from '@/lib/service-pricing';
import { formatCurrency } from '@/lib/transactions/formatting';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  LargeDialogContent,
} from '@/components/ui/dialog';
import { Search, X } from 'lucide-react';
import { toast } from 'sonner';
import ServiceDetailView from '@/components/property/services/ServiceDetailView';

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

export default function ServiceOfferingConfig({
  propertyId,
  unitId,
  servicePlan,
  onConfigChange,
}: ServiceOfferingConfigProps) {
  const [offerings, setOfferings] = useState<OfferingWithPricing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOfferings, setSelectedOfferings] = useState<Set<string>>(new Set());
  const [pricingOverrides, setPricingOverrides] = useState<
    Record<string, Partial<ServicePricingConfig>>
  >({});
  const [pendingToggles, setPendingToggles] = useState<Set<string>>(new Set());
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedServiceForDetail, setSelectedServiceForDetail] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const onConfigChangeRef = useRef(onConfigChange);
  
  // Update ref when callback changes
  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);

  const loadOfferings = useCallback(async () => {
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

      // Fetch service configuration
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

      // Use all offerings from catalog, or fallback to config.service_offerings
      const offeringsToProcess = allOfferings.length > 0 ? allOfferings : (config.service_offerings || []);

      // Process offerings
      if (offeringsToProcess.length > 0) {
        const processedOfferings: OfferingWithPricing[] = offeringsToProcess.map(
          (offering) => {
            const pricing = pricingByOffering.get(offering.id);
            // Only use pricing data from API, not local state
            const isSelected = pricing?.is_active === true;
            const isIncluded = includedOfferingIds.has(offering.id);

            return {
              ...offering,
              isSelected: isSelected || isIncluded,
              isIncluded,
              isOptional: !isIncluded,
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

        // Group by category and sort
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

        const categoryOrder = [
          'Financial Management',
          'Property Care',
          'Resident Services',
          'Compliance & Legal',
        ];
        const sortedOfferings: OfferingWithPricing[] = [];
        categoryOrder.forEach((category) => {
          if (grouped[category]) {
            sortedOfferings.push(...grouped[category]);
          }
        });
        Object.keys(grouped).forEach((category) => {
          if (!categoryOrder.includes(category)) {
            sortedOfferings.push(...grouped[category]);
          }
        });

        setOfferings(sortedOfferings);
        const selectedIds = sortedOfferings.filter((o) => o.isSelected).map((o) => o.id);
        setSelectedOfferings(new Set(selectedIds));
        // Only call onConfigChange after initial load, not on every render
        onConfigChangeRef.current?.({
          selectedOfferings: selectedIds,
          pricingOverrides: {},
        });
      } else {
        setOfferings([]);
        setSelectedOfferings(new Set());
        onConfigChangeRef.current?.({
          selectedOfferings: [],
          pricingOverrides: {},
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load service offerings');
    } finally {
      setLoading(false);
    }
  }, [propertyId, unitId, servicePlan]);

  useEffect(() => {
    loadOfferings();
  }, [loadOfferings]);

  const handleRowClick = (offeringId: string, event: React.MouseEvent) => {
    // Don't open dialog if clicking on checkbox
    if ((event.target as HTMLElement).closest('button, [role="checkbox"]')) {
      return;
    }
    setSelectedServiceForDetail(offeringId);
    setIsDetailDialogOpen(true);
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
        if (unitId) params.append('unitId', unitId);
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
            unit_id: unitId || null,
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
      onConfigChange?.({
        selectedOfferings: Array.from(nextSelection),
        pricingOverrides,
      });
      await loadOfferings();
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

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(offerings.map((o) => o.category || 'Other'));
    return Array.from(cats).sort();
  }, [offerings]);

  // Filter offerings
  const filteredOfferings = useMemo(() => {
    return offerings.filter((offering) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          offering.name.toLowerCase().includes(query) ||
          (offering.description || '').toLowerCase().includes(query) ||
          (offering.category || '').toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Category filter
      if (categoryFilter !== 'all') {
        if ((offering.category || 'Other') !== categoryFilter) return false;
      }

      // Status filter
      if (statusFilter === 'enabled') {
        if (!selectedOfferings.has(offering.id)) return false;
      } else if (statusFilter === 'disabled') {
        if (selectedOfferings.has(offering.id)) return false;
      } else if (statusFilter === 'included') {
        if (!offering.isIncluded) return false;
      }

      return true;
    });
  }, [offerings, searchQuery, categoryFilter, statusFilter, selectedOfferings]);

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
          aria-label="Retry loading service offerings"
        >
          Retry
        </button>
      </div>
    );
  }

  if (offerings.length === 0) {
    return (
      <div className="text-muted-foreground py-6 text-center text-sm">
        No service offerings available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="service-search" className="sr-only">
            Search services
          </label>
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            id="service-search"
            type="search"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Search services"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <label htmlFor="category-filter" className="sr-only">
            Filter by category
          </label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            aria-label="Filter by category"
            title="Filter by category"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            aria-label="Filter by status"
            title="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="included">Included in Plan</option>
          </select>
        </div>
      </div>

      {/* Service Plan Info */}
      {servicePlan && (
        <div className="bg-muted rounded-md p-3">
          <div className="text-sm font-medium">Current Plan: {servicePlan}</div>
          <div className="text-muted-foreground mt-1 text-xs">
            {servicePlan === 'Basic' || servicePlan === 'Full'
              ? 'Services included in this plan are automatically selected. You can add or remove services.'
              : `Select individual services for this ${servicePlan === 'Custom' ? 'custom' : 'a-la-carte'} plan.`}
          </div>
        </div>
      )}

      {/* Results Count */}
      <div className="text-muted-foreground text-sm">
        Showing {filteredOfferings.length} of {offerings.length} services
      </div>

      {/* Table */}
      <div className="border-border rounded-lg border">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-background">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox
                    checked={
                      filteredOfferings.length > 0 &&
                      filteredOfferings.every((o) => selectedOfferings.has(o.id))
                    }
                    onCheckedChange={(checked) => {
                      filteredOfferings.forEach((offering) => {
                        if (checked && !selectedOfferings.has(offering.id)) {
                          toggleOffering(offering.id);
                        } else if (!checked && selectedOfferings.has(offering.id)) {
                          toggleOffering(offering.id);
                        }
                      });
                    }}
                    aria-label="Select all services"
                  />
                </TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Pricing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOfferings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-6 text-center">
                    No services match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                filteredOfferings.map((offering) => {
                  const isSelected = selectedOfferings.has(offering.id);
                  const pricing = offering.pricing || offering.defaultPricing;
                  const isIncludedInPlan = offering.isIncluded;
                  const isPending = pendingToggles.has(offering.id);

                  return (
                    <TableRow
                      key={offering.id}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/5 dark:bg-primary/10' : ''
                      } ${isPending ? 'opacity-50' : ''}`}
                      onClick={(e) => handleRowClick(offering.id, e)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          disabled={isPending}
                          onCheckedChange={() => toggleOffering(offering.id)}
                          aria-label={`Select ${offering.name}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{offering.name}</div>
                          {offering.description && (
                            <div className="text-muted-foreground text-xs line-clamp-2">
                              {offering.description}
                            </div>
                          )}
                          {actionErrors[offering.id] && (
                            <div className="text-destructive text-xs">{actionErrors[offering.id]}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {offering.category || 'Other'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isIncludedInPlan && (
                            <Badge variant="secondary" className="text-xs">
                              Included
                            </Badge>
                          )}
                          {isSelected && !isIncludedInPlan && (
                            <Badge variant="default" className="text-xs">
                              Enabled
                            </Badge>
                          )}
                          {!isSelected && (
                            <Badge variant="outline" className="text-xs">
                              Disabled
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {pricing ? (
                          <div className="space-y-1 text-sm">
                            <div className="font-medium">
                              {pricing.rate !== null && pricing.rate !== undefined
                                ? formatCurrency(pricing.rate)
                                : 'N/A'}{' '}
                              <span className="text-muted-foreground text-xs">
                                / {pricing.frequency || offering.defaultPricing?.frequency || 'N/A'}
                              </span>
                            </div>
                            {(pricing.min_amount || pricing.max_amount) && (
                              <div className="text-muted-foreground text-xs">
                                {pricing.min_amount && `Min: ${formatCurrency(pricing.min_amount)}`}
                                {pricing.min_amount && pricing.max_amount && ' • '}
                                {pricing.max_amount && `Max: ${formatCurrency(pricing.max_amount)}`}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not configured</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Service Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <LargeDialogContent className="max-h-[90vh]">
          {selectedServiceForDetail && (() => {
            const selectedOffering = offerings.find((o) => o.id === selectedServiceForDetail);
            if (!selectedOffering) return null;

            return (
              <>
                <DialogHeader>
                  <DialogTitle>{selectedOffering.name}</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                  <ServiceDetailView
                    offering={{
                      id: selectedOffering.id,
                      name: selectedOffering.name,
                      description: selectedOffering.description,
                      category: selectedOffering.category,
                      isSelected: selectedOffering.isSelected,
                      isIncluded: selectedOffering.isIncluded,
                      pricing: selectedOffering.pricing
                        ? {
                            rate: selectedOffering.pricing.rate,
                            frequency: selectedOffering.pricing.billing_frequency,
                            min_amount: selectedOffering.pricing.min_amount,
                            max_amount: selectedOffering.pricing.max_amount,
                            billing_basis: selectedOffering.pricing.billing_basis,
                            effective_start: selectedOffering.pricing.effective_start,
                            effective_end: selectedOffering.pricing.effective_end,
                          }
                        : undefined,
                      defaultPricing: selectedOffering.defaultPricing,
                    }}
                    propertyId={propertyId}
                    isEditMode={true}
                    onEdit={() => {
                      // Edit mode is already enabled
                    }}
                    onDisable={() => {
                      toggleOffering(selectedOffering.id);
                      setIsDetailDialogOpen(false);
                    }}
                    onDuplicate={() => {
                      toast.info('Duplicate functionality coming soon');
                    }}
                    onPricingSave={async (pricingData) => {
                      try {
                        const response = await fetch('/api/service-pricing', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            ...pricingData,
                            property_id: propertyId,
                            unit_id: unitId || null,
                            offering_id: selectedOffering.id,
                          }),
                        });
                        if (!response.ok) {
                          throw new Error('Failed to save pricing');
                        }
                        toast.success('Pricing updated successfully');
                        await loadOfferings();
                        setIsDetailDialogOpen(false);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : 'Failed to save pricing');
                        throw err;
                      }
                    }}
                    onRefresh={loadOfferings}
                  />
                </div>
              </>
            );
          })()}
        </LargeDialogContent>
      </Dialog>
    </div>
  );
}
