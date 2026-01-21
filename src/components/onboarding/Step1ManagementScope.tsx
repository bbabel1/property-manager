import type { Dispatch, SetStateAction } from 'react';
import { Building } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Body, Heading, Label } from '@/ui/typography';
import type { AddPropertyFormData } from '@/components/AddPropertyModal';

const FOCUS_RING =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary';

const SCOPE_OPTIONS = [
  {
    value: 'Association',
    description: 'Common areas/association management',
    serviceAssignment: 'Property Level' as const,
    managementScope: 'Building' as const,
  },
  {
    value: 'Rental Unit',
    description: 'Single rental unit managed individually',
    serviceAssignment: 'Unit Level' as const,
    managementScope: 'Unit' as const,
  },
  {
    value: 'Rental Building',
    description: 'Multi-unit building managed together',
    serviceAssignment: 'Property Level' as const,
    managementScope: 'Building' as const,
  },
];

export function Step1ManagementScope({
  formData,
  setFormData,
}: {
  formData: AddPropertyFormData;
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>;
}) {
  const CurrentIcon = Building;
  const selectedScope = SCOPE_OPTIONS.find(
    (o) =>
      formData.management_scope === o.managementScope ||
      formData.service_assignment === o.serviceAssignment,
  );

  return (
    <div className="text-center">
      <CurrentIcon className="text-primary mx-auto mb-2 h-12 w-12" />
      <Heading as="h3" size="h4" className="mb-1">
        Management Scope
      </Heading>
      <Body as="p" tone="muted" size="sm" className="mb-4">
        Choose how this property will be managed.
      </Body>

      <div className="mx-auto grid max-w-3xl grid-cols-1 gap-3 md:grid-cols-3">
        {SCOPE_OPTIONS.map((opt) => {
          const selected = selectedScope?.value === opt.value;
          return (
            <Button
              key={opt.value}
              type="button"
              variant={selected ? 'default' : 'outline'}
              className={`flex h-full w-full flex-col items-start gap-2 rounded-lg border px-4 py-4 text-left shadow-sm transition-colors ${selected ? 'bg-primary text-primary-foreground' : 'bg-card'} ${FOCUS_RING}`}
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  service_assignment: opt.serviceAssignment,
                  management_scope: opt.managementScope,
                }))
              }
            >
              <Label size="sm" className={selected ? 'text-primary-foreground' : ''}>
                {opt.value}
              </Label>
              <Body
                size="xs"
                tone={selected ? 'default' : 'muted'}
                className={selected ? 'text-primary-foreground/80' : ''}
              >
                {opt.description}
              </Body>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
