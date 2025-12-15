'use client';

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
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
import AddressAutocomplete from './HybridAddressAutocomplete';
import { mapGoogleCountryToEnum } from '@/lib/utils';
import CreateBankAccountModal from '@/components/CreateBankAccountModal';
import { PropertyCreateSchema, type PropertyCreateInput } from '@/schemas/property';
import type { BankAccountSummary } from '@/components/forms/types';

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
  // Management/Service/Fee fields (Step 4 with banking)
  management_scope?: 'Building' | 'Unit';
  service_assignment?: 'Property Level' | 'Unit Level';
  service_plan?: 'Full' | 'Basic' | 'A-la-carte';
  active_services?: (
    | 'Rent Collection'
    | 'Maintenance'
    | 'Turnovers'
    | 'Compliance'
    | 'Bill Pay'
    | 'Condition Reports'
    | 'Renewals'
  )[];
  fee_assignment?: 'Building' | 'Unit';
  fee_type?: 'Percentage' | 'Flat Rate';
  fee_percentage?: number;
  management_fee?: number;
  billing_frequency?: 'Annual' | 'Monthly';

  // Step 6: Property Manager
  propertyManagerId?: string;
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
  management_scope: undefined,
  service_assignment: undefined,
  service_plan: undefined,
  active_services: [],
  fee_assignment: undefined,
  fee_type: undefined,
  fee_percentage: undefined,
  management_fee: undefined,
  billing_frequency: undefined,
  propertyManagerId: '',
};

const STEPS = [
  { id: 1, title: 'Property Type', icon: Building },
  { id: 2, title: 'Property Details', icon: MapPin },
  { id: 3, title: 'Ownership', icon: Users },
  { id: 4, title: 'Unit Details', icon: Home },
  { id: 5, title: 'Bank Account', icon: DollarSign },
  { id: 6, title: 'Property Manager', icon: UserCheck },
];

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
    title: 'Bank account & management',
    description: 'Select an operating bank account and set management scope/plan.',
    icon: DollarSign,
    bullets: [
      'Operating bank account is required',
      'Choose fee assignment (Building or Unit)',
      'Management scope, service assignment, and plan are required',
      'If fee assignment is Building, fee type + amount + billing are required',
    ],
  },
  6: {
    id: 6,
    title: 'Assign property manager',
    description: 'Optional but recommended—stored in state for later use.',
    icon: UserCheck,
    bullets: [
      'Pick a manager or leave blank',
      'Finish confirms and routes to your properties list',
    ],
    optional: true,
  },
};

const PRE_TOUR_REQUIREMENTS = [
  { label: 'Property address ready', icon: MapPin },
  { label: 'Owners total 100%', icon: Users },
  { label: 'At least one unit number', icon: Home },
  { label: 'Operating bank account', icon: DollarSign },
  { label: 'Management scope, plan, and service assignment', icon: ClipboardList },
  { label: 'Fee assignment/type + billing when Building', icon: AlertCircle },
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

type OwnerOption = { id: string; name: string; status?: string | null };
type BankAccountOption = Pick<
  BankAccountSummary,
  'id' | 'name' | 'account_number' | 'routing_number'
>;
type StaffOption = { id: string; displayName: string };

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
        // Require Operating Bank Account, Management Scope, Service Assignment, Service Plan
        const hasOp =
          !!data.operatingBankAccountId && String(data.operatingBankAccountId).trim().length > 0;
        const hasMgmtScope =
          !!data.management_scope && String(data.management_scope).trim().length > 0;
        const hasServiceAssign =
          !!data.service_assignment && String(data.service_assignment).trim().length > 0;
        const hasServicePlan = !!data.service_plan && String(data.service_plan).trim().length > 0;

        // Fees: when Fee Assignment = Building, require all fee fields
        const requiresFees = data.fee_assignment === 'Building';
        const hasFeeAssignment =
          !!data.fee_assignment && String(data.fee_assignment).trim().length > 0;
        const hasFeeType =
          !requiresFees || (!!data.fee_type && String(data.fee_type).trim().length > 0);
        const requirePct = requiresFees && data.fee_type === 'Percentage';
        const requireFlat = requiresFees && data.fee_type === 'Flat Rate';
        const hasFeePct =
          !requirePct ||
          (data.fee_percentage !== undefined &&
            data.fee_percentage !== null &&
            String(data.fee_percentage).trim() !== '');
        const hasMgmtFee =
          !requireFlat ||
          (data.management_fee !== undefined &&
            data.management_fee !== null &&
            String(data.management_fee).trim() !== '');
        const hasBillingFreq =
          !requiresFees ||
          (!!data.billing_frequency && String(data.billing_frequency).trim().length > 0);

        return (
          hasOp &&
          hasMgmtScope &&
          hasServiceAssign &&
          hasServicePlan &&
          hasFeeAssignment &&
          hasFeeType &&
          hasFeePct &&
          hasMgmtFee &&
          hasBillingFreq
        );
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

  // Auto-select all active services when Service Plan is 'Full'
  useEffect(() => {
    if (formData.service_plan === 'Full') {
      const allServices = [
        'Rent Collection',
        'Maintenance',
        'Turnovers',
        'Compliance',
        'Bill Pay',
        'Condition Reports',
        'Renewals',
      ] as const;
      if ((formData.active_services || []).length !== allServices.length) {
        setFormData((prev) => ({ ...prev, active_services: [...allServices] as const }));
      }
    }
  }, [formData.service_plan, formData.active_services]);

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

  const stepReady = canProceed(currentStep, formData);

  const handleNext = () => {
    if (currentStep < 6) {
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

      onClose();
      if (onSuccess) onSuccess();
      // Reset form to initial shape for the next open
      setFormData(INITIAL_FORM_DATA);
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
        className="bg-card border-border/80 max-h-[90vh] w-[680px] max-w-[680px] overflow-y-auto rounded-none border p-0 shadow-2xl sm:rounded-2xl"
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
            Follow the same six steps as the modal: Property Type → Details → Ownership → Unit
            Details → Bank Account → Property Manager.
          </p>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="border-border border-b px-6 py-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                Step {currentStep} of 6
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

          {currentStep === 5 && <Step4BankAccount formData={formData} setFormData={setFormData} />}

          {currentStep === 6 && (
            <Step5PropertyManager formData={formData} setFormData={setFormData} />
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
            {currentStep === 6 && (
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
              {submitting ? 'Saving...' : currentStep === 6 ? 'Create Property' : 'Next'}
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
                Step {config.id} / 6
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
                Step {config.id}/6
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
            <span className="text-muted-foreground text-xs">6 steps</span>
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
            <select
              id="add-property-country"
              value={formData.country}
              onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
              autoComplete="country-name"
              className={`border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="add-property-status"
            className="text-foreground mb-1 block text-sm font-medium"
          >
            Status
          </label>
          <select
            id="add-property-status"
            value={formData.status}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, status: e.target.value as 'Active' | 'Inactive' }))
            }
            className={`border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
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
          <select
            id="add-property-owner-select"
            onChange={(e) => {
              handleSelectOwner(e.target.value);
              e.target.value = '';
            }}
            className={`border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
          >
            <option value="">Choose owners to add...</option>
            <option value="create-new-owner">+ Create new owner…</option>
            {ownerList.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
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

// Step 4: Bank Account
function Step4BankAccount({
  formData,
  setFormData,
}: {
  formData: AddPropertyFormData;
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>;
}) {
  const CurrentIcon = STEPS[4].icon;
  const [accounts, setAccounts] = useState<BankAccountOption[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createTarget, setCreateTarget] = useState<'operating' | 'trust' | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/bank-accounts?revealNumbers=false');
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
                routing_number: account.routing_number ? String(account.routing_number) : null,
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
          <select
            id="add-property-operating-account"
            value={formData.operatingBankAccountId || ''}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'create-new') {
                setCreateTarget('operating');
                setShowCreate(true);
                return;
              }
              if (!value) {
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
            className={`border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
          >
            <option value="">Select account...</option>
            <option value="create-new">+ Create new account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.account_number ? ` (...${a.account_number})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="add-property-trust-account"
            className="text-foreground mb-1 block text-sm font-medium"
          >
            Deposit Trust Account
          </label>
          <select
            id="add-property-trust-account"
            value={formData.depositTrustAccountId || ''}
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'create-new') {
                setCreateTarget('trust');
                setShowCreate(true);
                return;
              }
              setFormData({ ...formData, depositTrustAccountId: value });
            }}
            className={`border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
          >
            <option value="">Select account...</option>
            <option value="create-new">+ Create new account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.account_number ? ` (...${a.account_number})` : ''}
              </option>
            ))}
          </select>
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

        {/* Selected account summary modules removed per request */}

        {/* Management & Services */}
        <div className="border-border mt-6 border-t pt-6">
          <h4 className="text-foreground mb-3 font-medium">Management & Services</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="add-property-management-scope"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Management Scope *
              </label>
              <select
                id="add-property-management-scope"
                value={formData.management_scope || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    management_scope: (e.target.value || undefined) as
                      | 'Building'
                      | 'Unit'
                      | undefined,
                  })
                }
                className={`border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
              >
                <option value="">Select scope...</option>
                <option value="Building">Building (manage entire property)</option>
                <option value="Unit">Unit (manage specific units)</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="add-property-service-assignment"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Service Assignment *
              </label>
              <select
                id="add-property-service-assignment"
                value={formData.service_assignment || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    service_assignment: (e.target.value || undefined) as
                      | 'Property Level'
                      | 'Unit Level'
                      | undefined,
                  })
                }
                className={`border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
              >
                <option value="">Select level...</option>
                <option value="Property Level">Property Level</option>
                <option value="Unit Level">Unit Level</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="add-property-service-plan"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Service Plan *
              </label>
              <select
                id="add-property-service-plan"
                value={formData.service_plan || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    service_plan: (e.target.value || undefined) as
                      | 'Full'
                      | 'Basic'
                      | 'A-la-carte'
                      | undefined,
                  })
                }
                className={`border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
              >
                <option value="">Select plan...</option>
                <option value="Full">Full</option>
                <option value="Basic">Basic</option>
                <option value="A-la-carte">A-la-carte</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-foreground mb-1 block text-sm font-medium">
                Active Services
              </label>
              <div className="border-border bg-background grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
                {(
                  [
                    'Rent Collection',
                    'Maintenance',
                    'Turnovers',
                    'Compliance',
                    'Bill Pay',
                    'Condition Reports',
                    'Renewals',
                  ] as const
                ).map((svc) => {
                  const checked = (formData.active_services || []).includes(svc);
                  return (
                    <label key={svc} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className={FOCUS_RING}
                        checked={checked}
                        onChange={(e) => {
                          const curr = new Set(formData.active_services || []);
                          if (e.target.checked) curr.add(svc);
                          else curr.delete(svc);
                          setFormData({
                            ...formData,
                            active_services: Array.from(curr) as typeof formData.active_services,
                          });
                        }}
                      />
                      <span>{svc}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                Select the active management services for this property.
              </p>
            </div>
          </div>
        </div>

        {/* Fees */}
        <div className="border-border mt-6 border-t pt-6">
          <h4 className="text-foreground mb-3 font-medium">Management Fees</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="add-property-fee-assignment"
                className="text-foreground mb-1 block text-sm font-medium"
              >
                Fee Assignment *
              </label>
              <select
                id="add-property-fee-assignment"
                value={formData.fee_assignment || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    fee_assignment: (e.target.value || undefined) as
                      | 'Building'
                      | 'Unit'
                      | undefined,
                  })
                }
                className={`border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
              >
                <option value="">Select assignment...</option>
                <option value="Building">Building</option>
                <option value="Unit">Unit</option>
              </select>
            </div>
            {formData.fee_assignment === 'Building' && (
              <>
                <div>
                  <label
                    htmlFor="add-property-fee-type"
                    className="text-foreground mb-1 block text-sm font-medium"
                  >
                    Fee Type *
                  </label>
                  <select
                    id="add-property-fee-type"
                    value={formData.fee_type || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        fee_type: (e.target.value || undefined) as
                          | 'Percentage'
                          | 'Flat Rate'
                          | undefined,
                      })
                    }
                    className={`border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
                  >
                    <option value="">Select type...</option>
                    <option value="Percentage">Percentage of rent</option>
                    <option value="Flat Rate">Flat Rate</option>
                  </select>
                </div>
                {formData.fee_type === 'Percentage' && (
                  <div>
                    <label className="text-foreground mb-1 block text-sm font-medium">
                      Fee Percentage *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={formData.fee_percentage ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fee_percentage:
                              e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        className={`border-border bg-background text-foreground placeholder:text-muted-foreground h-9 w-full rounded-md border px-3 pr-10 text-sm ${FOCUS_RING}`}
                        placeholder="e.g., 8"
                        step="0.01"
                        min={0}
                        max={100}
                      />
                      <span className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2">
                        %
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Enter 0–100 (e.g., 8 for 8%).
                    </p>
                  </div>
                )}
                {formData.fee_type === 'Flat Rate' && (
                  <div>
                    <label className="text-foreground mb-1 block text-sm font-medium">
                      Management Fee *
                    </label>
                    <div className="relative">
                      <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2">
                        $
                      </span>
                      <input
                        type="number"
                        value={formData.management_fee ?? ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            management_fee:
                              e.target.value === '' ? undefined : Number(e.target.value),
                          })
                        }
                        className={`border-border bg-background text-foreground placeholder:text-muted-foreground h-9 w-full rounded-md border pr-3 pl-8 text-sm ${FOCUS_RING}`}
                        placeholder="e.g., 0.00"
                        step="0.01"
                        min={0}
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label
                    htmlFor="add-property-billing-frequency"
                    className="text-foreground mb-1 block text-sm font-medium"
                  >
                    Billing Frequency *
                  </label>
                  <select
                    id="add-property-billing-frequency"
                    value={formData.billing_frequency || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        billing_frequency: (e.target.value || undefined) as
                          | 'Monthly'
                          | 'Annual'
                          | undefined,
                      })
                    }
                    className={`border-border bg-background text-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
                  >
                    <option value="">Select frequency...</option>
                    <option value="Monthly">Monthly</option>
                    <option value="Annual">Annual</option>
                  </select>
                </div>
              </>
            )}
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
              routing_number: newAccount.routing_number ? String(newAccount.routing_number) : null,
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

// Step 5: Property Manager
function Step5PropertyManager({
  formData,
  setFormData,
}: {
  formData: AddPropertyFormData;
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>;
}) {
  const CurrentIcon = STEPS[5].icon;
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
          <select
            id="add-property-manager"
            value={formData.propertyManagerId}
            onChange={(e) => setFormData({ ...formData, propertyManagerId: e.target.value })}
            className={`border-input bg-background text-foreground w-full rounded-md border px-3 py-2 ${FOCUS_RING}`}
          >
            <option value="">Choose a manager...</option>
            {staff.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
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
