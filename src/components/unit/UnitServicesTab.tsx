'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ServiceOfferingConfig from '@/components/management/ServiceOfferingConfig';
import { Info } from 'lucide-react';

interface UnitServicesTabProps {
  propertyId: string;
  unitId: string;
  unit: {
    id: string;
    unit_number?: string | null;
    unit_name?: string | null;
    service_plan?: string | null;
  };
  property: {
    id: string;
    name?: string;
    service_plan?: string | null;
    service_assignment?: string | null;
  };
}

export default function UnitServicesTab({
  propertyId,
  unitId,
  unit,
  property,
}: UnitServicesTabProps) {
  const unitLabel = unit.unit_number || unit.unit_name || 'Unit';
  const inheritsFromProperty =
    property.service_assignment === 'Property Level' || !property.service_assignment;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-foreground text-2xl font-bold">Unit Service Configuration</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure service offerings and pricing for {unitLabel}. Unit-level settings override
          property-level defaults.
        </p>
      </div>

      {/* Info Banner */}
      {inheritsFromProperty && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="text-sm text-blue-900">
              <p className="mb-1 font-medium">Property-Level Assignment</p>
              <p>
                This property uses property-level service assignment. Unit-level overrides will
                apply only to this unit. Most services are configured at the property level.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Plan */}
      {unit.service_plan && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            Unit Plan: {unit.service_plan}
          </Badge>
          {property.service_plan && property.service_plan !== unit.service_plan && (
            <Badge variant="outline" className="text-sm">
              Property Plan: {property.service_plan}
            </Badge>
          )}
        </div>
      )}

      {/* Service Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Service Offerings</CardTitle>
          <CardDescription>
            {inheritsFromProperty
              ? 'Override property-level services or configure unit-specific offerings. Changes apply only to this unit.'
              : 'Configure service offerings for this unit. Unit-level settings take precedence over property defaults.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ServiceOfferingConfig
            propertyId={propertyId}
            unitId={unitId}
            servicePlan={unit.service_plan || property.service_plan || null}
            onConfigChange={(config) => {
              console.log('Unit service config changed:', config);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
