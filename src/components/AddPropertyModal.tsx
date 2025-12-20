'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Building,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Home,
  MapPin,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AddressAutocomplete from './HybridAddressAutocomplete';
import { mapGoogleCountryToEnum } from '@/lib/utils';
import CreateBankAccountModal from '@/components/CreateBankAccountModal';
import { PropertyCreateSchema, type PropertyCreateInput } from '@/schemas/property';
import type { BankAccountSummary } from '@/components/forms/types';
import DraftAssignmentServicesEditor, {
  INITIAL_DRAFT_SERVICE_ASSIGNMENT,
  type DraftServiceAssignment,
} from '@/components/services/DraftAssignmentServicesEditor';

interface AddPropertyFormData {
  // Step 1: Property Type
  propertyType: string;

  // Step 2: Property Details
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  yearBuilt?: string;
  structureDescription?: string;
  status?: 'Active' | 'Inactive';
  // Location extras
  borough?: string;
  neighborhood?: string;
  longitude?: number;
  latitude?: number;
  locationVerified?: boolean;

  // Step 3: Ownership
  owners: Array<{
    id: string;
    name: string;
    ownershipPercentage: number;
    disbursementPercentage: number;
    primary: boolean;
    status?: string | null;
  }>;

  // Step 4: Units
  units: Array<{
    unitNumber: string;
    unitBedrooms?: string;
    unitBathrooms?: string;
    unitSize?: number;
    description?: string;
  }>;

  // Step 5: Bank Account
  operatingBankAccountId?: string;
  operatingBankAccountName?: string;
  depositTrustAccountId?: string;
  reserve?: number;

  // Step 6: Property Manager
  propertyManagerId?: string;

  // Legacy management/service fields (kept for compatibility)
  management_scope?: string | null;
  service_assignment?: string | null;
  service_plan?: string | null;
  active_services?: string[] | string | null;
  included_services?: string[] | string | null;
}

// Single source of truth for an empty form
const INITIAL_FORM_DATA: AddPropertyFormData = {
  propertyType: '',
  name: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
  yearBuilt: '',
  structureDescription: '',
  status: 'Active',
  borough: '',
  neighborhood: '',
  longitude: undefined,
  latitude: undefined,
  locationVerified: false,
  owners: [],
  units: [{ unitNumber: '' }],
  operatingBankAccountId: '',
  operatingBankAccountName: '',
  depositTrustAccountId: '',
  reserve: 0,
  propertyManagerId: '',
  management_scope: null,
  service_assignment: null,
  service_plan: null,
  active_services: null,
  included_services: null,
};

const STEPS = [
  { id: 1, title: 'Property Type', icon: Building },
  { id: 2, title: 'Property Details', icon: MapPin },
  { id: 3, title: 'Ownership', icon: Users },
  { id: 4, title: 'Unit Details', icon: Home },
  { id: 5, title: 'Management Services', icon: ClipboardList },
  { id: 6, title: 'Bank Account', icon: DollarSign },
  { id: 7, title: 'Property Manager', icon: UserCheck },
];

const TOTAL_STEPS = STEPS.length;

type TourStepConfig = {
  id: number;
  title: string;
  description: string;
  icon: LucideIcon;
  bullets: string[];
  optional?: boolean;
};

const TOUR_STEPS: Record<number, TourStepConfig> = {
  1: {
    id: 1,
    title: 'Choose a property type',
    description: 'Pick the property type to unlock the rest of the flow.',
    icon: Building,
    bullets: ['Required to proceed', 'Matches the Property Type step title'],
  },
  2: {
    id: 2,
    title: 'Enter property details',
    description: 'Name, address, city/state/postal code, and country are required.',
    icon: MapPin,
    bullets: [
      'Use the address autocomplete for faster fill',
      'All fields must be completed to enable Next',
    ],
  },
  3: {
    id: 3,
    title: 'Add owners',
    description: 'Add owners until ownership totals 100%.',
    icon: Users,
    bullets: [
      'Include at least one owner',
      'Ownership % must add up to 100% or Next stays disabled',
    ],
  },
  4: {
    id: 4,
    title: 'Add units',
    description: 'Add at least one unit number; blank rows do not count.',
    icon: Home,
    bullets: ['Unit number is required for each unit', 'Use “Add Another Unit” to add more'],
  },
  5: {
    id: 5,
    title: 'Configure management services',
    description: 'Set management scope, assignment level, and configure a service plan + services.',
    icon: ClipboardList,
    bullets: [
      'Management scope is required',
      'Choose assignment level (Property or Unit)',
      'If Property Level, configure plan + services',
    ],
  },
  6: {
    id: 6,
    title: 'Select a bank account',
    description: 'Operating bank account is required; trust account and reserve are optional.',
    icon: DollarSign,
    bullets: ['Operating bank account is required', 'Reserve amount is optional'],
  },
  7: {
    id: 7,
    title: 'Assign property manager',
    description: 'Optional but recommended—stored in state for later use.',
    icon: UserCheck,
    bullets: ['Pick a manager or leave blank', 'Finish creates the property and routes to it'],
    optional: true,
  },
};

const PRE_TOUR_REQUIREMENTS = [
  { label: 'Property address ready', icon: MapPin },
  { label: 'Owners total 100%', icon: Users },
  { label: 'At least one unit number', icon: Home },
  { label: 'Management services configured', icon: ClipboardList },
  { label: 'Operating bank account', icon: DollarSign },
  { label: 'Property manager (optional)', icon: UserCheck },
];

const PROPERTY_TYPES = ['Condo', 'Co-op', 'Condop', 'Rental Building', 'Multi-Family', 'Townhouse'];

const COUNTRIES = [
  'United States',
  'Canada',
  'United Kingdom',
  'Australia',
  'Germany',
  'France',
  'Japan',
  'China',
  'India',
  'Brazil',
];

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const EMPTY_OPTION_VALUE = '__empty__';

type OwnerOption = { id: string; name: string; status?: string | null };
type BankAccountOption = Pick<
  BankAccountSummary,
  'id' | 'name' | 'account_number' | 'routing_number'
>;
type StaffOption = { id: string; displayName: string };

function coerceLegacyServicePlan(
  serviceAssignment: string | null | undefined,
  planName: string | null | undefined,
): 'Full' | 'Basic' | 'A-la-carte' | 'Custom' | null {
  const assignment = String(serviceAssignment || '').trim();
  if (assignment === 'Unit Level') return 'Custom';
  const normalized = String(planName || '')
    .trim()
    .toLowerCase();
  if (normalized === 'full') return 'Full';
  if (normalized === 'basic') return 'Basic';
  if (normalized === 'a-la-carte' || normalized === 'a la carte' || normalized === 'alacarte')
    return 'A-la-carte';
  if (normalized === 'custom') return 'Custom';
  return planName ? 'Custom' : null;
}

export default function AddPropertyModal({
  isOpen,
  onClose,
  onSuccess,
  startInTour = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  startInTour?: boolean;
}) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<AddPropertyFormData>(INITIAL_FORM_DATA);
  const [serviceDraft, setServiceDraft] = useState<DraftServiceAssignment>(
    INITIAL_DRAFT_SERVICE_ASSIGNMENT,
  );
  const [syncToBuildium, setSyncToBuildium] = useState(true);
  const [isTourActive, setIsTourActive] = useState<boolean>(!!startInTour);
  const [showTourIntro, setShowTourIntro] = useState<boolean>(!!startInTour);

  // Options fetched from API
  const [owners, setOwners] = useState<OwnerOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const canProceed = (step: number, data: AddPropertyFormData) => {
    switch (step) {
      case 1:
        return !!data.propertyType;
      case 2:
        return (
          !!data.name &&
          !!data.addressLine1 &&
          !!data.city &&
          !!data.state &&
          !!data.postalCode &&
          !!data.country
        );
      case 3: {
        const total = (data.owners || []).reduce(
          (sum, o) => sum + (Number(o.ownershipPercentage) || 0),
          0,
        );
        return (data.owners || []).length > 0 && total === 100;
      }
      case 4: {
        return (data.units || []).some((u) => (u.unitNumber || '').trim().length > 0);
      }
      case 5: {
        const hasMgmtScope = !!data.management_scope;
        const hasServiceAssignment = !!data.service_assignment;
        const needsPropertyLevelPlan = data.service_assignment === 'Property Level';
        const hasConfiguredPlan = !needsPropertyLevelPlan
          ? true
          : serviceDraft.configured && !!serviceDraft.plan_id;

        return (
          hasMgmtScope &&
          hasServiceAssignment &&
          hasConfiguredPlan
        );
      }
      case 6: {
        const hasOp =
          !!data.operatingBankAccountId && String(data.operatingBankAccountId).trim().length > 0;
        return hasOp;
      }
      default:
        return true;
    }
  };

  useEffect(() => {
    if (isOpen && startInTour) {
      setIsTourActive(true);
      setShowTourIntro(true);
      setCurrentStep(1);
    }
  }, [isOpen, startInTour]);

  useEffect(() => {
    if (!isOpen) {
      setIsTourActive(false);
      setShowTourIntro(false);
    }
  }, [isOpen]);

  const startTourNow = () => {
    setIsTourActive(true);
    setShowTourIntro(false);
    setCurrentStep(1);
  };

  const dismissTour = () => {
    setIsTourActive(false);
    setShowTourIntro(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const fetchOptions = async () => {
      try {
        const ownersRes = await fetch('/api/owners');
        if (!ownersRes.ok) throw new Error('Failed to load owners');
        const ownersJson = await ownersRes.json();

        if (cancelled) return;
        setOwners(
          ownersJson.map((o: unknown) => {
            const owner = o as Record<string, unknown>;
            const label =
              owner.displayName ||
              owner.name ||
              `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() ||
              `${owner.first_name ?? ''} ${owner.last_name ?? ''}`.trim() ||
              owner.companyName ||
              owner.company_name ||
              'Unnamed Owner';
            const status = owner.status || owner.owner_status || null;
            return { id: String(owner.id), name: String(label), status: String(status) };
          }),
        );
      } catch (e) {
        console.error('Failed to load owners:', e);
      }
    };
    fetchOptions();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Auto-calculate property name from Street Address and Primary Owner
  useEffect(() => {
    const address = (formData.addressLine1 || '').trim();
    const primaryOwner = (formData.owners || []).find((o) => o.primary);
    const ownerName = (primaryOwner?.name || '').trim();
    const computed = ownerName ? (address ? `${address} | ${ownerName}` : ownerName) : address;
    if ((computed || '') !== (formData.name || '')) {
      setFormData((prev) => ({ ...prev, name: computed }));
    }
  }, [formData.addressLine1, formData.owners, formData.name]);

  useEffect(() => {
    const next = coerceLegacyServicePlan(formData.service_assignment, serviceDraft.plan_name);
    if (next && next !== formData.service_plan) {
      setFormData((prev) => ({ ...prev, service_plan: next }));
    }
  }, [formData.service_assignment, formData.service_plan, serviceDraft.plan_name]);

  const stepReady = canProceed(currentStep, formData);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(null);

      // Validate with Zod before submit
      const parsed = PropertyCreateSchema.safeParse({
        propertyType: formData.propertyType,
        name: formData.name,
        addressLine1: formData.addressLine1,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
        country: formData.country,
        yearBuilt: formData.yearBuilt || undefined,
        structureDescription: formData.structureDescription || undefined,
        management_scope: formData.management_scope,
        service_assignment: formData.service_assignment,
        service_plan: formData.service_plan,
        owners: formData.owners,
        operatingBankAccountId: formData.operatingBankAccountId || undefined,
        reserve: formData.reserve || undefined,
        propertyManagerId: formData.propertyManagerId || undefined,
      } as PropertyCreateInput);

      if (!parsed.success) {
        const msg = parsed.error.issues.map((e) => e.message).join('\n');
        throw new Error(msg || 'Please correct the form errors');
      }

      // Submit the form data to your API
      const url = syncToBuildium ? '/api/properties?syncToBuildium=true' : '/api/properties';
      const { operatingBankAccountName, ...submitPayload } = formData;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitPayload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create property');
      }

      const result = await response.json();
      console.log('Property created successfully:', result);
      setSubmitSuccess('Property created successfully');

      const propertyId: string | undefined = result?.property?.id;
      const destination = propertyId ? `/properties/${propertyId}` : '/properties';

      if (propertyId) {
        try {
          if (
            formData.service_assignment === 'Property Level' &&
            serviceDraft.configured &&
            serviceDraft.plan_id
          ) {
            const isALaCarte =
              String(serviceDraft.plan_name || '')
                .trim()
                .toLowerCase() === 'a-la-carte';

            const assignmentPayload = {
              property_id: propertyId,
              plan_id: serviceDraft.plan_id,
              plan_fee_amount: isALaCarte ? null : serviceDraft.resolved_plan_fee_amount,
              plan_fee_percent: isALaCarte ? 0 : serviceDraft.resolved_plan_fee_percent,
              plan_fee_frequency: isALaCarte
                ? 'Monthly'
                : serviceDraft.plan_fee_frequency || 'Monthly',
            };

            const assignmentRes = await fetch('/api/services/assignments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(assignmentPayload),
            });
            const assignmentJson = await assignmentRes.json().catch(() => ({}));
            if (!assignmentRes.ok) {
              throw new Error(
                assignmentJson?.error?.message ||
                  assignmentJson?.error ||
                  'Failed to save service plan assignment',
              );
            }
            const assignmentId = String(assignmentJson?.data?.id || '');
            if (!assignmentId) throw new Error('Service assignment could not be determined.');

            const servicesPayload = isALaCarte
              ? Object.entries(serviceDraft.a_la_carte_selections)
                  .filter(([, v]) => v.selected)
                  .map(([offeringId, row]) => ({
                    offering_id: offeringId,
                    is_active: row.is_active ?? true,
                    override_amount: Boolean(row.override),
                    override_frequency: Boolean(row.override),
                    amount: row.override ? row.amount : null,
                    frequency: row.override ? row.frequency : null,
                  }))
              : Object.entries(serviceDraft.included_service_active_overrides)
                  .filter(([, isActive]) => isActive === false)
                  .map(([offeringId]) => ({
                    offering_id: offeringId,
                    is_active: false,
                    override_amount: false,
                    override_frequency: false,
                    amount: null,
                    frequency: null,
                  }));

            if (servicesPayload.length) {
              const servicesRes = await fetch('/api/services/assignment-services', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignment_id: assignmentId, services: servicesPayload }),
              });
              const servicesJson = await servicesRes.json().catch(() => ({}));
              if (!servicesRes.ok) {
                throw new Error(
                  servicesJson?.error?.message ||
                    servicesJson?.error ||
                    'Failed to save selected services',
                );
              }
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to assign services';
          console.error('Service assignment error:', message);
          setSubmitSuccess(
            `Property created successfully (services assignment failed: ${message})`,
          );
        }
      }

      onClose();
      if (onSuccess) onSuccess();
      // Reset form to initial shape for the next open
      setFormData(INITIAL_FORM_DATA);
      setServiceDraft(INITIAL_DRAFT_SERVICE_ASSIGNMENT);
      setSyncToBuildium(true);
      setCurrentStep(1);

      router.push(destination);
    } catch (error) {
      console.error('Error creating property:', error);
      setSubmitError(
        error instanceof Error ? error.message : 'Failed to create property. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const addOwner = (ownerId: string, ownerName?: string) => {
    // Prefer name passed from the Step 3 list; fall back to parent-fetched owners
    const fallback = owners.find((o) => o.id === ownerId);
    const name = ownerName || fallback?.name;
    if (name && !formData.owners.find((o) => o.id === ownerId)) {
      setFormData((prev) => ({
        ...prev,
        owners: [
          ...prev.owners,
          {
            id: ownerId,
            name,
            ownershipPercentage: 100,
            disbursementPercentage: 100,
            primary: prev.owners.length === 0, // First owner is primary
          },
        ],
      }));
    }
  };

  const removeOwner = (ownerId: string) => {
    setFormData((prev) => ({
      ...prev,
      owners: prev.owners.filter((o) => o.id !== ownerId),
    }));
  };

  const updateOwnerPercentage = (
    ownerId: string,
    field: 'ownershipPercentage' | 'disbursementPercentage',
    value: number,
  ) => {
    setFormData((prev) => ({
      ...prev,
      owners: prev.owners.map((o) => (o.id === ownerId ? { ...o, [field]: value } : o)),
    }));
  };

  const setPrimaryOwner = (ownerId: string) => {
    // Toggle behavior: if the clicked owner is already primary, uncheck all; otherwise set as sole primary
    setFormData((prev) => {
      const current = prev.owners.find((o) => o.id === ownerId)?.primary;
      const owners = current
        ? prev.owners.map((o) => ({ ...o, primary: false }))
        : prev.owners.map((o) => ({ ...o, primary: o.id === ownerId }));
      return { ...prev, owners };
    });
  };

  const nextEnabled = !submitting && stepReady;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onInteractOutside={(e: Event) => {
          const event = e as CustomEvent;
          const orig = event?.detail?.originalEvent as Event | undefined;
          const target = (orig?.target as HTMLElement) || (event.target as HTMLElement);
          if (
            target &&
            (target.closest?.('.pac-container') || target.classList?.contains('pac-item'))
          ) {
            e.preventDefault();
          }
        }}
        className="bg-card border-border/80 max-h-[90vh] w-fit max-w-[800px] overflow-y-auto rounded-none border p-0 shadow-2xl sm:rounded-2xl"
      >
        {/* Header */}
        <DialogHeader className="border-border border-b p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <DialogTitle className="text-foreground text-xl font-semibold">
              Add New Property
            </DialogTitle>
            <Button
              type="button"
              size="sm"
              variant={isTourActive ? 'secondary' : 'outline'}
              onClick={() => {
                setIsTourActive(true);
                setShowTourIntro(true);
              }}
              className={`${FOCUS_RING} flex items-center gap-2`}
            >
              <Sparkles className="h-4 w-4" />
              {isTourActive ? 'Tour active' : 'Start guided tour'}
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">
            Follow the same seven steps as the modal: Property Type → Details → Ownership → Unit
            Details → Management Services → Bank Account → Property Manager.
          </p>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="border-border border-b px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                Step {currentStep} of {TOTAL_STEPS}
              </span>
              <span className="text-foreground text-sm font-semibold">
                {STEPS[currentStep - 1]?.title}
              </span>
            </div>
            {isTourActive ? (
              <span className="text-muted-foreground text-xs">
                {stepReady ? 'Next is ready' : 'Complete this step to unlock Next'}
              </span>
            ) : null}
          </div>
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    currentStep >= step.id
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-input text-muted-foreground'
                  }`}
                >
                  {currentStep > step.id ? (
                    <span className="text-sm">✓</span>
                  ) : (
                    <span className="text-sm">{step.id}</span>
                  )}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 w-16 ${
                      currentStep > step.id ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className={`p-5 md:p-6${isTourActive ? 'pb-24' : ''}`}>
          {submitError && (
            <div className="bg-destructive/10 border-destructive/20 mb-4 rounded-md border p-3">
              <p className="text-destructive text-sm">{submitError}</p>
            </div>
          )}
          {submitSuccess && (
            <div className="bg-success/10 border-success/20 mb-4 rounded-md border p-3">
              <p className="text-success text-sm">{submitSuccess}</p>
            </div>
          )}
          {isTourActive && showTourIntro && (
            <TourIntroCard onStart={startTourNow} onSkip={dismissTour} />
          )}
          {isTourActive && !showTourIntro && (
            <GuidedStepTip config={TOUR_STEPS[currentStep]} ready={stepReady} />
          )}
          {currentStep === 1 && <Step1PropertyType formData={formData} setFormData={setFormData} />}

          {currentStep === 2 && (
            <Step2PropertyDetails formData={formData} setFormData={setFormData} />
          )}

          {currentStep === 3 && (
            <Step3Ownership
              formData={formData}
              setFormData={setFormData}
              addOwner={addOwner}
              removeOwner={removeOwner}
              updateOwnerPercentage={updateOwnerPercentage}
              setPrimaryOwner={setPrimaryOwner}
            />
          )}

          {currentStep === 4 && <Step4UnitDetails formData={formData} setFormData={setFormData} />}

          {currentStep === 5 && (
            <Step5ManagementServices
              formData={formData}
              setFormData={setFormData}
              serviceDraft={serviceDraft}
              setServiceDraft={setServiceDraft}
            />
          )}

          {currentStep === 6 && <Step6BankAccount formData={formData} setFormData={setFormData} />}

          {currentStep === 7 && (
            <Step7PropertyManager formData={formData} setFormData={setFormData} />
          )}
        </div>

        {/* Navigation */}
        <div className="border-border flex items-center justify-between border-t p-6">
          <Button
            type="button"
            variant="ghost"
            onClick={handlePrevious}
            disabled={currentStep === 1}
            className={FOCUS_RING}
          >
            Previous
          </Button>

          <div className="flex items-center gap-4">
            {currentStep === TOTAL_STEPS && (
              <label className="text-muted-foreground flex items-center gap-2 text-sm select-none">
                <input
                  type="checkbox"
                  className={`border-border h-4 w-4 rounded ${FOCUS_RING}`}
                  checked={syncToBuildium}
                  onChange={(e) => setSyncToBuildium(e.target.checked)}
                />
                Create this property in Buildium
              </label>
            )}
            <Button
              type="button"
              onClick={handleNext}
              disabled={!nextEnabled}
              className={`${FOCUS_RING} min-h-[44px] ${nextEnabled ? 'shadow-primary/30 shadow-lg' : ''}`}
            >
              {submitting ? 'Saving...' : currentStep === TOTAL_STEPS ? 'Create Property' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GuidedStepTip({ config, ready }: { config: TourStepConfig; ready: boolean }) {
  if (!config) return null;
  const Icon = config.icon;
  return (
    <div className="mb-4">
      <div className="border-border bg-muted/40 hidden items-start gap-3 rounded-xl border p-4 shadow-sm sm:flex">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-full border ${ready ? 'border-success/40 bg-success/10 text-success' : 'border-primary/30 bg-primary/10 text-primary'}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase">
                Step {config.id} / {TOTAL_STEPS}
              </span>
              {config.optional ? (
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]">
                  Optional
                </span>
              ) : null}
            </div>
            <span className={`text-xs ${ready ? 'text-success' : 'text-muted-foreground'}`}>
              {ready ? 'Ready for Next' : 'Finish required items'}
            </span>
          </div>
          <div>
            <h4 className="text-foreground text-sm font-semibold">{config.title}</h4>
            <p className="text-muted-foreground text-sm">{config.description}</p>
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {config.bullets.map((bullet) => (
              <li key={bullet} className="text-foreground flex items-start gap-2 text-sm">
                <CheckCircle2
                  className={`mt-0.5 h-4 w-4 ${ready ? 'text-success' : 'text-primary'}`}
                />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Mobile bottom-sheet hint */}
      <div className="border-border bg-background/95 sticky bottom-0 z-20 mt-3 rounded-t-2xl border px-4 py-3 shadow-[0_-12px_28px_rgba(0,0,0,0.12)] backdrop-blur sm:hidden">
        <div className="flex items-start gap-3">
          <div
            className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-full border ${ready ? 'border-success/40 bg-success/10 text-success' : 'border-primary/30 bg-primary/10 text-primary'}`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
                Step {config.id}/{TOTAL_STEPS}
              </span>
              {config.optional ? (
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px]">
                  Optional
                </span>
              ) : null}
            </div>
            <p className="text-foreground text-sm font-semibold">{config.title}</p>
            <p className="text-muted-foreground text-xs">{config.description}</p>
            <ul className="space-y-1">
              {config.bullets.map((bullet) => (
                <li key={bullet} className="text-foreground flex items-start gap-2 text-xs">
                  <CheckCircle2
                    className={`mt-0.5 h-4 w-4 ${ready ? 'text-success' : 'text-primary'}`}
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground text-[11px]">
              {ready ? 'Next is highlighted.' : 'Complete these to enable Next.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TourIntroCard({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="border-primary/30 bg-primary/5 mb-4 rounded-xl border p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-full">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-foreground text-base font-semibold">Guided tour: Add Property</h4>
            <span className="text-muted-foreground text-xs">{TOTAL_STEPS} steps</span>
          </div>
          <p className="text-muted-foreground text-sm">
            Quick checklist before you start. These match the required fields the modal already
            validates.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRE_TOUR_REQUIREMENTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="border-border/70 bg-background flex items-center gap-2 rounded-md border px-2 py-2"
                >
                  <Icon className="text-primary h-4 w-4" />
                  <span className="text-foreground text-sm">{item.label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={onStart} className={`${FOCUS_RING} min-h-[44px]`}>
              Start tour
            </Button>
            <Button size="sm" variant="ghost" onClick={onSkip} className={FOCUS_RING}>
              Skip tour
            </Button>
            <span className="text-muted-foreground text-xs">
              Next highlights once the checklist for each step is done.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 1: Property Type
function Step1PropertyType({
  formData,
  setFormData,
}: {
  formData: AddPropertyFormData;
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>;
}) {
  const CurrentIcon = STEPS[0].icon;

  return (
    <div className="text-center">
      <CurrentIcon className="text-primary mx-auto mb-2 h-12 w-12" />
      <h3 className="text-foreground mb-1 text-xl font-semibold">Property Type</h3>
      <p className="text-muted-foreground mb-4">What type of property are you adding?</p>

      <div className="mx-auto max-w-3xl md:max-w-4xl">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PROPERTY_TYPES.map((type) => {
            const selected = formData.propertyType === type;
            return (
              <Button
                key={type}
                type="button"
                variant={selected ? 'default' : 'outline'}
                className={`h-14 flex-col justify-center gap-1 md:h-16 ${selected ? 'bg-primary text-primary-foreground' : 'bg-card'} transition-colors ${FOCUS_RING}`}
                onClick={() => setFormData({ ...formData, propertyType: type })}
              >
                <Building
                  className={`h-5 w-5 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                />
                <span
                  className={`text-sm ${selected ? 'text-primary-foreground' : 'text-foreground'}`}
                >
                  {type}
                </span>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Step 2: Property Details
function Step2PropertyDetails({
  formData,
  setFormData,
}: {
  formData: AddPropertyFormData;
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>;
}) {
  const CurrentIcon = STEPS[1].icon;

  return (
    <div>
      <div className="mb-4 text-center">
        <CurrentIcon className="text-primary mx-auto mb-2 h-12 w-12" />
        <h3 className="text-foreground mb-1 text-xl font-semibold">Property Details</h3>
        <p className="text-muted-foreground">Enter the property address and basic information</p>
      </div>

      <div className="mx-auto max-w-3xl space-y-4 md:max-w-4xl">
        <div>
          <label className="text-foreground mb-1 block text-sm font-medium">Street Address *</label>
          <AddressAutocomplete
            value={formData.addressLine1}
            onChange={(value) => setFormData((prev) => ({ ...prev, addressLine1: value }))}
            onPlaceSelect={(place) => {
              const mappedCountry = mapGoogleCountryToEnum(place.country);
              setFormData((prev) => ({
                ...prev,
                addressLine1: place.address,
                city: place.city,
                state: place.state,
                postalCode: place.postalCode,
                country: mappedCountry,
                borough: place.borough || prev.borough,
                neighborhood: place.neighborhood || prev.neighborhood,
                longitude: place.longitude ?? prev.longitude,
                latitude: place.latitude ?? prev.latitude,
                locationVerified: true,
              }));
            }}
            placeholder="e.g., 123 Main Street"
            required
            autoComplete="street-address"
            className={FOCUS_RING}
          />
        </div>

        <div>
          <label className="text-foreground mb-1 block text-sm font-medium">
            Address Line 2 (Optional)
          </label>
          <input
            type="text"
            value={formData.addressLine2}
            onChange={(e) => setFormData((prev) => ({ ...prev, addressLine2: e.target.value }))}
            autoComplete="address-line2"
            className={`border-border bg-background text-foreground placeholder:text-muted-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
            placeholder="Apartment, suite, unit, building, floor, etc."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">City *</label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
              autoComplete="address-level2"
              className={`border-border bg-background text-foreground placeholder:text-muted-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
              placeholder="Enter city"
            />
          </div>
          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">State *</label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
              autoComplete="address-level1"
              className={`border-border bg-background text-foreground placeholder:text-muted-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
              placeholder="Enter state"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">ZIP Code *</label>
            <input
              type="text"
              value={formData.postalCode}
              onChange={(e) => setFormData((prev) => ({ ...prev, postalCode: e.target.value }))}
              autoComplete="postal-code"
              className={`border-border bg-background text-foreground placeholder:text-muted-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
              placeholder="Enter ZIP code"
            />
          </div>
          <div>
            <label
              htmlFor="add-property-country"
              className="text-foreground mb-1 block text-sm font-medium"
          >
            Country *
          </label>
          <Select
            value={formData.country || EMPTY_OPTION_VALUE}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, country: value === EMPTY_OPTION_VALUE ? '' : value }))
            }
          >
            <SelectTrigger className={`h-10 w-full ${FOCUS_RING}`}>
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_OPTION_VALUE}>Select country</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <label
            htmlFor="add-property-status"
            className="text-foreground mb-1 block text-sm font-medium"
          >
            Status
          </label>
          <Select
            value={formData.status || ''}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, status: value as 'Active' | 'Inactive' }))
            }
          >
            <SelectTrigger className={`h-10 w-full ${FOCUS_RING}`}>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-foreground mb-1 block text-sm font-medium">
              Year Built (Optional)
            </label>
            <input
              type="text"
              value={formData.yearBuilt}
              onChange={(e) => setFormData((prev) => ({ ...prev, yearBuilt: e.target.value }))}
              className={`border-border bg-background text-foreground placeholder:text-muted-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
              placeholder="e.g., 2008"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-foreground mb-1 block text-sm font-medium">
              Description (Optional)
            </label>
            <textarea
              value={formData.structureDescription}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, structureDescription: e.target.value }))
              }
              className={`border-border bg-background text-foreground placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 ${FOCUS_RING}`}
              rows={3}
              placeholder="Brief description of the property..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// Step 3: Ownership
function Step3Ownership({
  formData,
  setFormData,
  addOwner,
  removeOwner,
  updateOwnerPercentage,
  setPrimaryOwner,
}: {
  formData: AddPropertyFormData;
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>;
  addOwner: (ownerId: string, ownerName?: string) => void;
  removeOwner: (ownerId: string) => void;
  updateOwnerPercentage: (
    ownerId: string,
    field: 'ownershipPercentage' | 'disbursementPercentage',
    value: number,
  ) => void;
  setPrimaryOwner: (ownerId: string) => void;
}) {
  const CurrentIcon = STEPS[2].icon;
  const [ownerList, setOwnerList] = useState<OwnerOption[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [showCreateInline, setShowCreateInline] = useState(false);
  const [createFirst, setCreateFirst] = useState('');
  const [createLast, setCreateLast] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPhone, setCreatePhone] = useState('');
  const [createOwnershipPct, setCreateOwnershipPct] = useState<number>(100);
  const [createDisbursementPct, setCreateDisbursementPct] = useState<number>(100);
  const [createPrimary, setCreatePrimary] = useState<boolean>(false);
  const [creating, setCreating] = useState(false);
  const OWNER_PLACEHOLDER_VALUE = `${EMPTY_OPTION_VALUE}-owner`;
  const [ownerSelectValue, setOwnerSelectValue] = useState(OWNER_PLACEHOLDER_VALUE);
  // CSRF token for POSTs to secured API routes
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [csrfLoading, setCsrfLoading] = useState(true);

  // Fetch CSRF token on mount so we can include it in headers (cookie is httpOnly)
  const fetchCsrf = useCallback(async () => {
    setCsrfLoading(true);
    let token: string | null = null;
    try {
      const res = await fetch('/api/csrf', { credentials: 'include' });
      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        token = typeof j?.token === 'string' ? j.token : null;
      }
    } catch {
      // ignore; UI will show retry affordance through disabled state/error
    } finally {
      setCsrfToken(token);
      setCsrfLoading(false);
    }
    return token;
  }, []);

  useEffect(() => {
    fetchCsrf();
  }, [fetchCsrf]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setErr(null);
        const res = await fetch('/api/owners');
        if (!res.ok) throw new Error('Failed to load owners');
        const data = await res.json();
        if (!cancelled) {
          setOwnerList(
            (Array.isArray(data) ? data : []).map((o: unknown) => {
              const owner = o as Record<string, unknown>;
              const label =
                owner.displayName ||
                owner.name ||
                `${owner.firstName ?? ''} ${owner.lastName ?? ''}`.trim() ||
                `${owner.first_name ?? ''} ${owner.last_name ?? ''}`.trim() ||
                owner.companyName ||
                owner.company_name ||
                'Unnamed Owner';
              return { id: String(owner.id), name: String(label) };
            }),
          );
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Failed to load owners');
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectOwner = async (value: string) => {
    if (!value) return;
    if (value === 'create-new-owner') {
      setShowCreateInline(true);
      setCreateOwnershipPct(100);
      setCreateDisbursementPct(100);
      setCreatePrimary((formData.owners?.length || 0) === 0);
      return;
    }
    const selected = ownerList.find((o) => o.id === value);
    addOwner(value, selected?.name);
  };

  const handleCreateOwner = async () => {
    try {
      setCreating(true);
      setErr(null);
      // Basic validation
      if (!createFirst || !createLast || !createEmail) {
        setErr('First name, last name, and email are required');
        return;
      }
      if (!csrfToken) {
        // Token missing or still loading; proactively refetch and inform user
        await fetchCsrf();
        setErr('Preparing security token. Please try again in a moment.');
        return;
      }
      const csrf = csrfToken;
      const res = await fetch('/api/owners', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify({
          isCompany: false,
          firstName: createFirst,
          lastName: createLast,
          primaryEmail: createEmail,
          primaryPhone: createPhone || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 403) {
          await fetchCsrf();
          throw new Error('Security token expired. Refreshing—please try again.');
        }
        throw new Error(j?.error || 'Failed to create owner');
      }
      const j = await res.json();
      const newOwner = j?.owner;
      if (newOwner?.id) {
        const name =
          newOwner.displayName ||
          `${newOwner.firstName ?? ''} ${newOwner.lastName ?? ''}`.trim() ||
          `${newOwner.first_name ?? ''} ${newOwner.last_name ?? ''}`.trim() ||
          newOwner.companyName ||
          newOwner.company_name ||
          'New Owner';
        // Update dropdown options
        setOwnerList((prev) => [
          { id: newOwner.id, name: name || newOwner.companyName || 'New Owner' },
          ...prev,
        ]);
        // Add to form selections using provided ownership values and primary flag
        setFormData((prev) => {
          const entry = {
            id: String(newOwner.id),
            name: name || newOwner.companyName || 'New Owner',
            ownershipPercentage: Number.isFinite(createOwnershipPct) ? createOwnershipPct : 100,
            disbursementPercentage: Number.isFinite(createDisbursementPct)
              ? createDisbursementPct
              : 100,
            primary: !!createPrimary,
            status: 'new',
          };
          let owners = [...prev.owners, entry];
          if (entry.primary) {
            owners = owners.map((o) => ({ ...o, primary: o.id === entry.id }));
          }
          return { ...prev, owners };
        });
        // Reset form
        setShowCreateInline(false);
        setCreateFirst('');
        setCreateLast('');
        setCreateEmail('');
        setCreatePhone('');
        setCreateOwnershipPct(100);
        setCreateDisbursementPct(100);
        setCreatePrimary(false);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create owner');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="mb-6 text-center">
        <CurrentIcon className="text-primary mx-auto mb-4 h-16 w-16" />
        <h3 className="text-foreground mb-2 text-xl font-semibold">Ownership</h3>
        <p className="text-muted-foreground">Select the owners related to this property</p>
      </div>

      <div className="space-y-4">
        <div>
          <label
          htmlFor="add-property-owner-select"
          className="text-foreground mb-1 block text-sm font-medium"
        >
          Add Owners *
        </label>
        <Select
          value={ownerSelectValue}
          onValueChange={(value) => {
            if (value === OWNER_PLACEHOLDER_VALUE) {
              setOwnerSelectValue(OWNER_PLACEHOLDER_VALUE);
              return;
            }
            handleSelectOwner(value);
            setOwnerSelectValue(OWNER_PLACEHOLDER_VALUE);
          }}
        >
          <SelectTrigger className={`h-10 w-full ${FOCUS_RING}`}>
            <SelectValue placeholder="Choose owners to add..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OWNER_PLACEHOLDER_VALUE}>Choose owners to add...</SelectItem>
            <SelectItem value="create-new-owner">+ Create new owner…</SelectItem>
            {ownerList.map((owner) => (
              <SelectItem key={owner.id} value={owner.id}>
                {owner.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

        {showCreateInline && (
          <div className="border-border bg-muted/10 rounded-lg border p-4">
            <h4 className="mb-3 text-sm font-medium">Create New Owner</h4>
            {err && <p className="text-destructive mb-2 text-sm">{err}</p>}
            {!err && (csrfLoading || !csrfToken) && (
              <p className="text-muted-foreground mb-2 text-sm">Preparing security token…</p>
            )}
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-muted-foreground mb-1 block text-xs">First Name *</label>
                <input
                  className={`border-border bg-background h-9 w-full rounded border px-2 ${FOCUS_RING}`}
                  value={createFirst}
                  onChange={(e) => setCreateFirst(e.target.value)}
                  placeholder="e.g., John"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs">Last Name *</label>
                <input
                  className={`border-border bg-background h-9 w-full rounded border px-2 ${FOCUS_RING}`}
                  value={createLast}
                  onChange={(e) => setCreateLast(e.target.value)}
                  placeholder="e.g., Smith"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-muted-foreground mb-1 block text-xs">Email *</label>
                <input
                  className={`border-border bg-background h-9 w-full rounded border px-2 ${FOCUS_RING}`}
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="e.g., john.smith@example.com"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-muted-foreground mb-1 block text-xs">Phone (Optional)</label>
                <input
                  className={`border-border bg-background h-9 w-full rounded border px-2 ${FOCUS_RING}`}
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  placeholder="e.g., (555) 123-4567"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs">Ownership %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={`border-border bg-background h-9 w-full rounded border px-2 ${FOCUS_RING}`}
                  value={createOwnershipPct}
                  onChange={(e) => setCreateOwnershipPct(Number(e.target.value))}
                  aria-label="Ownership percentage"
                />
              </div>
              <div>
                <label className="text-muted-foreground mb-1 block text-xs">Disbursement %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={`border-border bg-background h-9 w-full rounded border px-2 ${FOCUS_RING}`}
                  value={createDisbursementPct}
                  onChange={(e) => setCreateDisbursementPct(Number(e.target.value))}
                  aria-label="Disbursement percentage"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-muted-foreground inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className={FOCUS_RING}
                    checked={createPrimary}
                    onChange={(e) => setCreatePrimary(e.target.checked)}
                  />
                  Primary
                </label>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={handleCreateOwner}
                disabled={creating || csrfLoading || !csrfToken}
                className={FOCUS_RING}
              >
                {creating ? 'Adding…' : csrfLoading || !csrfToken ? 'Preparing…' : 'Add Owner'}
              </Button>
              <Button
                type="button"
                variant="cancel"
                onClick={() => {
                  setShowCreateInline(false);
                  setErr(null);
                }}
                className={FOCUS_RING}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {formData.owners.length > 0 && (
          <div>
            <h4 className="text-foreground mb-2 text-sm font-medium">Selected Owners</h4>
            <div className="border-border overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Owner</th>
                    <th className="px-4 py-2 text-center font-medium">Ownership %</th>
                    <th className="px-4 py-2 text-center font-medium">Disbursement %</th>
                    <th className="px-4 py-2 text-center font-medium">Primary</th>
                    <th className="px-4 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.owners.map((owner) => (
                    <tr key={owner.id} className="border-border border-t">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{owner.name || 'Unnamed Owner'}</span>
                          {String(owner.status || '').toLowerCase() === 'new' && (
                            <span className="bg-primary/10 text-primary rounded px-2 py-0.5 text-xs">
                              New Owner
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          value={owner.ownershipPercentage}
                          onChange={(e) =>
                            updateOwnerPercentage(
                              owner.id,
                              'ownershipPercentage',
                              Number(e.target.value),
                            )
                          }
                          className={`border-border text-foreground bg-background w-24 rounded border px-2 py-1 text-sm ${FOCUS_RING}`}
                          min={0}
                          max={100}
                          step={1}
                          aria-label={`Ownership percentage for ${owner.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          value={owner.disbursementPercentage}
                          onChange={(e) =>
                            updateOwnerPercentage(
                              owner.id,
                              'disbursementPercentage',
                              Number(e.target.value),
                            )
                          }
                          className={`border-border text-foreground bg-background w-24 rounded border px-2 py-1 text-sm ${FOCUS_RING}`}
                          min={0}
                          max={100}
                          step={1}
                          aria-label={`Disbursement percentage for ${owner.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className={FOCUS_RING}
                          checked={!!owner.primary}
                          onChange={() => setPrimaryOwner(owner.id)}
                          aria-label={`Set ${owner.name} as primary owner`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => removeOwner(owner.id)}
                          className={`text-destructive hover:underline ${FOCUS_RING}`}
                          aria-label={`Remove ${owner.name} from property`}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Ownership total validation */}
            {(() => {
              const total = formData.owners.reduce(
                (s, o) => s + (Number(o.ownershipPercentage) || 0),
                0,
              );
              if (total !== 100) {
                return (
                  <p className="text-destructive mt-2 text-sm">
                    Ownership total is {total}%. It must equal 100% to continue.
                  </p>
                );
              }
              return null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

// Step 5: Management Services
function Step5ManagementServices({
  formData,
  setFormData,
  serviceDraft,
  setServiceDraft,
}: {
  formData: AddPropertyFormData;
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>;
  serviceDraft: DraftServiceAssignment;
  setServiceDraft: Dispatch<SetStateAction<DraftServiceAssignment>>;
}) {
  const CurrentIcon = STEPS[4].icon;
  const isUnitLevel = formData.service_assignment === 'Unit Level';

  return (
    <div>
      <div className="mb-6 text-center">
        <CurrentIcon className="text-primary mx-auto mb-4 h-16 w-16" />
        <h3 className="text-foreground mb-2 text-xl font-semibold">Management Services</h3>
        <p className="text-muted-foreground">
          Configure management scope, assignment level, and the property’s service plan.
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
            htmlFor="add-property-management-scope"
            className="text-foreground mb-1 block text-sm font-medium"
        >
          Management Scope *
        </label>
        <Select
          value={formData.management_scope || EMPTY_OPTION_VALUE}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              management_scope: (value === EMPTY_OPTION_VALUE ? null : value) as
                | 'Building'
                | 'Unit'
                | null,
            })
          }
        >
          <SelectTrigger className={`h-10 w-full ${FOCUS_RING}`}>
            <SelectValue placeholder="Select scope..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_OPTION_VALUE}>Select scope...</SelectItem>
            <SelectItem value="Building">Building</SelectItem>
            <SelectItem value="Unit">Unit</SelectItem>
          </SelectContent>
        </Select>
        </div>

        <div>
          <label
            htmlFor="add-property-service-assignment"
            className="text-foreground mb-1 block text-sm font-medium"
        >
          Service Assignment *
        </label>
        <Select
          value={formData.service_assignment || EMPTY_OPTION_VALUE}
          onValueChange={(value) =>
            setFormData({
              ...formData,
              service_assignment: (value === EMPTY_OPTION_VALUE ? null : value) as
                | 'Property Level'
                | 'Unit Level'
                | null,
            })
          }
        >
          <SelectTrigger className={`h-10 w-full ${FOCUS_RING}`}>
            <SelectValue placeholder="Select assignment..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_OPTION_VALUE}>Select assignment...</SelectItem>
            <SelectItem value="Property Level">Property Level</SelectItem>
            <SelectItem value="Unit Level">Unit Level</SelectItem>
          </SelectContent>
        </Select>
        </div>
      </div>
    </div>

        {isUnitLevel ? (
          <div className="bg-muted/30 rounded-xl border p-4">
            <p className="text-foreground text-sm font-semibold">Unit Level assignments</p>
            <p className="text-muted-foreground mt-1 text-sm">
              This property is set to Unit Level service assignments. You’ll configure the service
              plan and services on each unit after the property is created.
            </p>
          </div>
        ) : (
          <DraftAssignmentServicesEditor draft={serviceDraft} onChange={setServiceDraft} />
        )}
      </div>
    </div>
  );
}

// Step 6: Bank Account
function Step6BankAccount({
  formData,
  setFormData,
}: {
  formData: AddPropertyFormData;
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>;
}) {
  const CurrentIcon = STEPS[5].icon;
  const [accounts, setAccounts] = useState<BankAccountOption[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createTarget, setCreateTarget] = useState<'operating' | 'trust' | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/gl-accounts/bank-accounts');
        if (!res.ok) throw new Error('Failed to load bank accounts');
        const data = await res.json();
        if (!cancelled)
          setAccounts(
            (data || []).map((a: unknown) => {
              const account = a as Record<string, unknown>;
              return {
                id: String(account.id),
                name: String(account.name),
                account_number: account.account_number ? String(account.account_number) : null,
                routing_number: null,
              };
            }),
          );
      } catch (e) {
        console.error('Failed to load bank accounts:', e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!formData.operatingBankAccountId || formData.operatingBankAccountName) return;
    const selected = accounts.find((a) => a.id === formData.operatingBankAccountId);
    if (selected) {
      setFormData((prev) => ({ ...prev, operatingBankAccountName: selected.name }));
    }
  }, [accounts, formData.operatingBankAccountId, formData.operatingBankAccountName, setFormData]);

  return (
    <div>
      <div className="mb-6 text-center">
        <CurrentIcon className="text-primary mx-auto mb-4 h-16 w-16" />
        <h3 className="text-foreground mb-2 text-xl font-semibold">Bank Account</h3>
        <p className="text-muted-foreground">Select the operating bank account for this property</p>
      </div>

      <div className="space-y-4">
        <div>
          <label
            htmlFor="add-property-operating-account"
            className="text-foreground mb-1 block text-sm font-medium"
        >
          Operating Bank Account *
        </label>
        <Select
          value={formData.operatingBankAccountId || EMPTY_OPTION_VALUE}
          onValueChange={(value) => {
            if (value === 'create-new') {
              setCreateTarget('operating');
              setShowCreate(true);
              return;
            }
            if (value === EMPTY_OPTION_VALUE) {
              setFormData({
                ...formData,
                operatingBankAccountId: '',
                operatingBankAccountName: '',
              });
                return;
              }
              const selected = accounts.find((a) => a.id === value);
              setFormData({
                ...formData,
                operatingBankAccountId: value,
                operatingBankAccountName: selected?.name ?? '',
              });
            }}
          >
            <SelectTrigger className={`h-10 w-full ${FOCUS_RING}`}>
              <SelectValue placeholder="Select account..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={EMPTY_OPTION_VALUE}>Select account...</SelectItem>
              <SelectItem value="create-new">+ Create new account…</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                  {a.account_number ? ` (...${a.account_number})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label
            htmlFor="add-property-trust-account"
            className="text-foreground mb-1 block text-sm font-medium"
        >
          Deposit Trust Account
        </label>
        <Select
          value={formData.depositTrustAccountId || EMPTY_OPTION_VALUE}
          onValueChange={(value) => {
            if (value === 'create-new') {
              setCreateTarget('trust');
              setShowCreate(true);
              return;
            }
            setFormData({ ...formData, depositTrustAccountId: value === EMPTY_OPTION_VALUE ? '' : value });
          }}
        >
          <SelectTrigger className={`h-10 w-full ${FOCUS_RING}`}>
            <SelectValue placeholder="Select account..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_OPTION_VALUE}>Select account...</SelectItem>
            <SelectItem value="create-new">+ Create new account…</SelectItem>
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
                {a.account_number ? ` (...${a.account_number})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-foreground mb-1 block text-sm font-medium">Reserve Amount</label>
          <div className="relative">
            <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
              $
            </span>
            <input
              type="number"
              value={formData.reserve}
              onChange={(e) => setFormData({ ...formData, reserve: Number(e.target.value) })}
              className={`border-border bg-background text-foreground placeholder:text-muted-foreground h-9 w-full rounded-md border pr-3 pl-8 text-sm ${FOCUS_RING}`}
              placeholder="e.g., 0.00"
              step="0.01"
              min="0"
            />
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateBankAccountModal
          isOpen={showCreate}
          onClose={() => {
            setShowCreate(false);
            setCreateTarget(null);
          }}
          onSuccess={(newAccount) => {
            const created: BankAccountOption = {
              id: String(newAccount.id),
              name: String(newAccount.name),
              account_number: newAccount.account_number ? String(newAccount.account_number) : null,
              routing_number: null,
            };
            setAccounts((prev) => [
              { ...created },
              ...prev.filter((a) => a.id !== String(newAccount.id)),
            ]);
            if (createTarget === 'operating') {
              setFormData((prev) => ({
                ...prev,
                operatingBankAccountId: String(newAccount.id),
                operatingBankAccountName: String(newAccount.name),
              }));
            } else if (createTarget === 'trust') {
              setFormData((prev) => ({ ...prev, depositTrustAccountId: String(newAccount.id) }));
            }
            setCreateTarget(null);
          }}
        />
      )}
    </div>
  );
}

// Step 7: Property Manager
function Step7PropertyManager({
  formData,
  setFormData,
}: {
  formData: AddPropertyFormData;
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>;
}) {
  const CurrentIcon = STEPS[6].icon;
  const [staff, setStaff] = useState<StaffOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/staff');
        if (!res.ok) {
          // Not fatal if staff table missing; leave list empty
          setStaff([]);
          return;
        }
        const data = await res.json();
        if (!cancelled)
          setStaff(
            (data || []).map((s: unknown) => {
              const staff = s as Record<string, unknown>;
              return {
                id: String(staff.id),
                displayName: String(
                  staff.displayName ||
                    `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim() ||
                    `Staff ${staff.id}`,
                ),
              };
            }),
          );
      } catch (e) {
        console.error('Failed to load staff:', e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="mb-6 text-center">
        <CurrentIcon className="text-primary mx-auto mb-4 h-16 w-16" />
        <h3 className="text-foreground mb-2 text-xl font-semibold">Property Manager</h3>
        <p className="text-muted-foreground">Assign a property manager (optional)</p>
      </div>

      <div className="space-y-6">
        <div>
          <label
          htmlFor="add-property-manager"
          className="text-foreground mb-1 block text-sm font-medium"
        >
          Property Manager (Optional)
        </label>
        <Select
          value={formData.propertyManagerId || EMPTY_OPTION_VALUE}
          onValueChange={(value) =>
            setFormData({ ...formData, propertyManagerId: value === EMPTY_OPTION_VALUE ? '' : value })
          }
        >
          <SelectTrigger className={`h-10 w-full ${FOCUS_RING}`}>
            <SelectValue placeholder="Choose a manager..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_OPTION_VALUE}>Choose a manager...</SelectItem>
            {staff.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

        {/* Property Summary */}
        <div className="bg-muted border-border rounded-lg border p-4">
          <h4 className="text-foreground mb-3 font-medium">Property Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Property:</span>
              <span className="font-medium">{formData.name || 'Not specified'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type:</span>
              <span className="bg-primary/10 text-primary rounded px-2 py-1 text-xs">
                {formData.propertyType || 'Not selected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">{formData.status || 'Active'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Address:</span>
              <span className="font-medium">{formData.addressLine1 || 'Not specified'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Country:</span>
              <span className="font-medium">{formData.country || 'Not specified'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Year Built:</span>
              <span className="font-medium">{formData.yearBuilt || 'Not specified'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Owners:</span>
              <span className="font-medium">
                {formData.owners.map((o) => o.name).join(', ') || 'None selected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Primary Owner:</span>
              <span className="font-medium">
                {formData.owners.find((o) => o.primary)?.name || 'None selected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Bank Account:</span>
              <span className="font-medium">
                {formData.operatingBankAccountName ||
                  formData.operatingBankAccountId ||
                  'None selected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deposit Trust:</span>
              <span className="font-medium">
                {formData.depositTrustAccountId || 'None selected'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// Step 4: Unit Details
function Step4UnitDetails({
  formData,
  setFormData,
}: {
  formData: AddPropertyFormData;
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>;
}) {
  const CurrentIcon = STEPS[3].icon;
  const addUnit = () => {
    setFormData({ ...formData, units: [...formData.units, { unitNumber: '' }] });
  };
  const updateUnit = (idx: number, patch: Partial<AddPropertyFormData['units'][number]>) => {
    const next = formData.units.map((u, i) => (i === idx ? { ...u, ...patch } : u));
    setFormData({ ...formData, units: next });
  };
  const removeUnit = (idx: number) => {
    const next = formData.units.filter((_, i) => i !== idx);
    setFormData({ ...formData, units: next.length ? next : [{ unitNumber: '' }] });
  };

  const BEDROOMS = ['Studio', '1', '2', '3', '4', '5+'];
  const BATHROOMS = ['1', '1.5', '2', '2.5', '3', '3.5', '4+'];

  return (
    <div>
      <div className="mb-6 text-center">
        <CurrentIcon className="text-primary mx-auto mb-4 h-16 w-16" />
        <h3 className="text-foreground mb-2 text-xl font-semibold">Unit Details</h3>
        <p className="text-muted-foreground">Add details for each unit in this property</p>
      </div>

      <div className="space-y-4">
        {formData.units.map((u, idx) => (
          <div key={idx} className="border-border bg-card rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-medium">Unit {idx + 1}</span>
              {formData.units.length > 1 && (
                <button
                  onClick={() => removeUnit(idx)}
                  className={`text-destructive text-sm hover:underline ${FOCUS_RING}`}
                  aria-label={`Remove unit ${idx + 1}`}
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4">
              {/* Unit Number */}
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Unit Number *
                </label>
                <input
                  value={u.unitNumber}
                  onChange={(e) => updateUnit(idx, { unitNumber: e.target.value })}
                  className={`border-border bg-background h-9 w-full rounded-md border px-3 ${FOCUS_RING}`}
                  placeholder="e.g., 101, A, 1"
                />
              </div>
              {/* Bedrooms */}
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">Bedrooms</label>
                <div className="border-border divide-border flex divide-x overflow-hidden rounded-md border">
                  {BEDROOMS.map((b) => {
                    const selected = (u.unitBedrooms || '') === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => updateUnit(idx, { unitBedrooms: b })}
                        className={`flex-1 py-3 text-center text-sm ${selected ? 'bg-primary/10 text-primary' : 'bg-background hover:bg-muted text-foreground'} ${FOCUS_RING}`}
                        aria-label={`Select ${b} bedrooms for unit ${idx + 1}`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Bathrooms */}
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">Bathrooms</label>
                <div className="border-border divide-border flex divide-x overflow-hidden rounded-md border">
                  {BATHROOMS.map((b) => {
                    const selected = (u.unitBathrooms || '') === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => updateUnit(idx, { unitBathrooms: b })}
                        className={`flex-1 py-3 text-center text-sm ${selected ? 'bg-primary/10 text-primary' : 'bg-background hover:bg-muted text-foreground'} ${FOCUS_RING}`}
                        aria-label={`Select ${b} bathrooms for unit ${idx + 1}`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Description */}
              <div>
                <label className="text-foreground mb-1 block text-sm font-medium">
                  Description (Optional)
                </label>
                <textarea
                  value={u.description || ''}
                  onChange={(e) => updateUnit(idx, { description: e.target.value || undefined })}
                  rows={3}
                  className={`border-border bg-background w-full rounded-lg border px-3 py-2 ${FOCUS_RING}`}
                  placeholder="Unit-specific details, amenities, notes..."
                />
              </div>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          onClick={addUnit}
          className={`w-full ${FOCUS_RING}`}
        >
          + Add Another Unit
        </Button>
      </div>
    </div>
  );
}
