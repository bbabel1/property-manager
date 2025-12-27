'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info } from 'lucide-react';
import ManagementServiceCard from '@/components/property/ManagementServiceCard';

interface UnitServicesTabProps {
  propertyId: string;
  unitId: string;
  unit: {
    id: string;
    unit_number?: string | null;
    unit_name?: string | null;
  };
  property: {
    id: string;
    name?: string;
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
  const assignmentLevel = (property.service_assignment || 'Property Level') as
    | 'Property Level'
    | 'Unit Level';
  const isPropertyLevel = assignmentLevel === 'Property Level';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-foreground text-2xl font-bold">Unit Service Configuration</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Configure service offerings and pricing for {unitLabel}.
        </p>
      </div>

      {/* Info Banner */}
      {isPropertyLevel && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div className="text-sm text-blue-900">
              <p className="mb-1 font-medium">Property-Level Assignment</p>
              <p>
                This property uses property-level service assignment. Services are configured on the
                property Services page and are view-only here.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="text-sm">
          Assignment Level: {assignmentLevel}
        </Badge>
      </div>

      {isPropertyLevel ? (
        <ManagementServiceCard
          propertyId={propertyId}
          readOnly
          title="Property Services (View-only)"
          subtitle="This property is configured at the property level."
        />
      ) : (
        <ManagementServiceCard
          propertyId={propertyId}
          unitId={unitId}
          title="Unit Services"
          subtitle={`Configure plan and services for ${unitLabel}.`}
        />
      )}
    </div>
  );
}
