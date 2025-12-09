'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ServiceOfferingConfig from '@/components/management/ServiceOfferingConfig';
import BulkPricingModal from '@/components/services/BulkPricingModal';
import PricingHistoryTimeline from '@/components/services/PricingHistoryTimeline';
import { Settings, DollarSign, Calendar } from 'lucide-react';

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

export default function PropertyServicesTab({ propertyId, property }: PropertyServicesTabProps) {
  const [activeTab, setActiveTab] = useState<'services' | 'pricing' | 'history'>('services');
  const [servicePlan] = useState<string | null>(property.service_plan || null);
  const [units, setUnits] = useState<
    Array<{ id: string; unit_number: string | null; unit_name: string | null }>
  >(property.units || []);
  const [selectedOfferingForBulk, setSelectedOfferingForBulk] = useState<string | null>(null);
  const [selectedOfferingForHistory, setSelectedOfferingForHistory] = useState<string | null>(null);

  useEffect(() => {
    // Load units if not provided
    if (!units.length) {
      fetch(`/api/properties/${propertyId}/details`)
        .then((res) => res.json())
        .then((data) => {
          if (data.units) {
            setUnits(data.units);
          }
        })
        .catch(console.error);
    }
  }, [propertyId, units.length]);

  const handleBulkPricingSave = async (
    pricing: Array<{ unitId: string; pricing: Record<string, unknown> }>,
  ) => {
    try {
      // Save each pricing configuration
      const promises = pricing.map((item) =>
        fetch('/api/service-pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.pricing),
        }),
      );

      await Promise.all(promises);
      // Refresh the page or show success message
      alert(`Successfully applied pricing to ${pricing.length} units`);
    } catch (err) {
      console.error('Error saving bulk pricing:', err);
      throw err;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-foreground text-2xl font-bold">Service Configuration</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage service offerings, pricing, and configurations for{' '}
          {property.name || 'this property'}
        </p>
      </div>

      {/* Current Plan Badge */}
      {servicePlan && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            Current Plan: {servicePlan}
          </Badge>
          {property.service_assignment && (
            <Badge variant="outline" className="text-sm">
              {property.service_assignment === 'Property Level' ? 'Property-Level' : 'Unit-Level'}{' '}
              Assignment
            </Badge>
          )}
        </div>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'services' | 'pricing' | 'history')}
      >
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Services
          </TabsTrigger>
          <TabsTrigger value="pricing" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Pricing
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Service Offerings</CardTitle>
              <CardDescription>
                Select and configure service offerings for this property. Changes will apply to all
                units unless overridden at the unit level.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ServiceOfferingConfig
                propertyId={propertyId}
                servicePlan={servicePlan}
                onConfigChange={(config) => {
                  const firstSelected = config.selectedOfferings[0] || null;
                  setSelectedOfferingForBulk(firstSelected);
                  setSelectedOfferingForHistory(firstSelected);
                }}
              />
              {units.length > 0 && selectedOfferingForBulk && (
                <div className="mt-4 border-t pt-4">
                  <BulkPricingModal
                    propertyId={propertyId}
                    offeringId={selectedOfferingForBulk}
                    offeringName="Selected Service"
                    units={units}
                    onSave={handleBulkPricingSave}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Configuration</CardTitle>
              <CardDescription>
                View and manage pricing overrides for service offerings. Effective dates control
                when pricing changes take effect.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-muted-foreground text-sm">
                Pricing management UI coming soon. For now, use the Services tab to configure
                pricing.
                {units.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm font-medium">Bulk Operations</p>
                    <p className="text-xs">
                      Use bulk pricing to apply the same pricing configuration to multiple units at
                      once.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {selectedOfferingForHistory ? (
            <PricingHistoryTimeline
              propertyId={propertyId}
              offeringId={selectedOfferingForHistory}
            />
          ) : (
            <Card>
              <CardContent className="text-muted-foreground py-6 text-center">
                Select a service offering in the Services tab to view pricing history.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
