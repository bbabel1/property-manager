'use client';

import { useMemo } from 'react';
import CompactServiceCard from './CompactServiceCard';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ServiceOffering, ServicePricingConfig, ServicePricingPreview } from '@/lib/management-service';

interface OfferingWithPricing extends ServiceOffering {
  isSelected: boolean;
  isIncluded: boolean;
  isOptional: boolean;
  pricing?: ServicePricingConfig;
  defaultPricing?: ServicePricingPreview;
}

interface ServicesListProps {
  offerings: OfferingWithPricing[];
  searchQuery: string;
  categoryFilter: string;
  statusFilter: string;
  selectedOfferings: Set<string>;
  pendingToggles: Set<string>;
  selectedServiceId: string | null;
  isEditMode: boolean;
  onToggle: (offeringId: string) => void;
  onSelect: (offeringId: string) => void;
  onEditPricing?: (offeringId: string) => void;
  onConfigureRules?: (offeringId: string) => void;
  onOverrideUnitLevel?: (offeringId: string) => void;
}

export default function ServicesList({
  offerings,
  searchQuery,
  categoryFilter,
  statusFilter,
  selectedOfferings,
  pendingToggles,
  selectedServiceId,
  isEditMode,
  onToggle,
  onSelect,
  onEditPricing,
  onConfigureRules,
  onOverrideUnitLevel,
}: ServicesListProps) {
  const toPricingPreview = (pricing?: ServicePricingConfig): ServicePricingPreview | undefined => {
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
  };

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

  // Group by category
  const groupedByCategory = useMemo(() => {
    const grouped = new Map<string, OfferingWithPricing[]>();
    filteredOfferings.forEach((offering) => {
      const category = offering.category || 'Other';
      if (!grouped.has(category)) {
        grouped.set(category, []);
      }
      grouped.get(category)!.push(offering);
    });
    return grouped;
  }, [filteredOfferings]);

  const categoryOrder = [
    'Financial Management',
    'Property Care',
    'Resident Services',
    'Compliance & Legal',
  ];

  const sortedCategories = useMemo(() => {
    const ordered: string[] = [];
    const others: string[] = [];

    categoryOrder.forEach((cat) => {
      if (groupedByCategory.has(cat)) {
        ordered.push(cat);
      }
    });

    groupedByCategory.forEach((_, category) => {
      if (!categoryOrder.includes(category)) {
        others.push(category);
      }
    });

    return [...ordered, ...others.sort()];
  }, [groupedByCategory]);

  if (filteredOfferings.length === 0) {
    return (
      <div className="text-muted-foreground py-6 text-center text-sm">
        No services match your filters.
      </div>
    );
  }

  return (
    <Accordion type="multiple" defaultValue={sortedCategories.slice(0, 2)} className="space-y-2">
      {sortedCategories.map((category) => {
        const categoryOfferings = groupedByCategory.get(category)!;
        const enabledCount = categoryOfferings.filter((o) => o.isSelected).length;
        
        return (
          <AccordionItem key={category} value={category} className="border-none">
            <AccordionTrigger className="py-2 text-sm font-medium hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <span>{category}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {enabledCount}/{categoryOfferings.length} enabled
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-1.5 pt-2">
                {categoryOfferings.map((offering) => (
                  <CompactServiceCard
                    key={offering.id}
                    offering={{
                      id: offering.id,
                      name: offering.name,
                      isSelected: offering.isSelected,
                      isIncluded: offering.isIncluded,
                      pricing: toPricingPreview(offering.pricing),
                      defaultPricing: offering.defaultPricing,
                    }}
                    isEditMode={isEditMode}
                    isPending={pendingToggles.has(offering.id)}
                    isActive={selectedServiceId === offering.id}
                    onToggle={() => onToggle(offering.id)}
                    onClick={() => onSelect(offering.id)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
