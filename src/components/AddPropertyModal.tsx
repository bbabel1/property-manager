'use client';

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Building,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  FileText,
  Home,
  MapPin,
  Send,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, LargeDialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AddressAutocomplete from './HybridAddressAutocomplete';
import { mapGoogleCountryToEnum } from '@/lib/utils';
import { fetchWithSupabaseAuth } from '@/lib/supabase/fetch';
import CreateBankAccountModal from '@/components/CreateBankAccountModal';
import { PropertyCreateSchema, type PropertyCreateInput } from '@/schemas/property';
import type { BankAccountSummary } from '@/components/forms/types';
import DraftAssignmentServicesEditor, {
  INITIAL_DRAFT_SERVICE_ASSIGNMENT,
  type DraftServiceAssignment,
} from '@/components/services/DraftAssignmentServicesEditor';
import { Checkbox } from '@/ui/checkbox';
import { Body, Heading, Label } from '@/ui/typography';
import {
  OwnerSignerSection,
  BulkUnitCreator,
  AgreementReviewPanel,
  AgreementTemplateSelector,
  BuildiumReadinessChecklist,
} from '@/components/onboarding';
import type { Signer } from '@/components/onboarding/OwnerSignerSection';
import { Step1ManagementScope } from '@/components/onboarding';
import type { UnitRow } from '@/components/onboarding/BulkUnitCreator';

export interface AddPropertyFormData {
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
    clientRowId?: string;
    ownershipPercentage: number;
    disbursementPercentage: number;
    primary: boolean;
    status?: string | null;
    saved?: boolean;
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

type PropertyEntryMode = 'new' | 'existing';

type ExistingPropertyOption = {
  id: string;
  name: string;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  propertyType?: string | null;
  serviceAssignment?: string | null;
  managementScope?: string | null;
};

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

// Onboarding mode uses a simplified flow focused on getting to agreement sending
const ONBOARDING_STEPS = [
  { id: 1, title: 'Management Scope', icon: Building },
  { id: 2, title: 'Property Type', icon: Building },
  { id: 3, title: 'Property Details', icon: MapPin },
  { id: 4, title: 'Owners & Signers', icon: Users },
  { id: 5, title: 'Units', icon: Home },
  { id: 6, title: 'Review & Send', icon: Send },
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
    description: 'Recommended—stored in state for later use.',
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
  onboardingMode = false,
  resumeOnboarding,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  startInTour?: boolean;
  /** When true, uses simplified onboarding flow with early draft persistence and agreement sending */
  onboardingMode?: boolean;
  /** Optional resume payload from existing onboarding draft */
  resumeOnboarding?: {
    onboardingId: string;
    propertyId: string;
    property?: {
      name?: string | null;
      addressLine1?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      country?: string | null;
      propertyType?: string | null;
      serviceAssignment?: string | null;
    };
    signers?: Signer[];
    owners?: Array<{
      id: string;
      name: string;
      clientRowId?: string;
      ownershipPercentage: number;
      disbursementPercentage: number;
      primary: boolean;
    }>;
    units?: UnitRow[];
  };
}) {
  // Determine which steps to use based on mode
  const activeSteps = onboardingMode ? ONBOARDING_STEPS : STEPS;
  const totalSteps = activeSteps.length;
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
  const [propertyEntryMode, setPropertyEntryMode] = useState<PropertyEntryMode>('new');
  const [existingProperties, setExistingProperties] = useState<ExistingPropertyOption[]>([]);
  const [existingPropertiesLoading, setExistingPropertiesLoading] = useState(false);
  const [selectedExistingPropertyId, setSelectedExistingPropertyId] = useState<string>('');

  // Onboarding mode state
  const [onboardingId, setOnboardingId] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [signers, setSigners] = useState<Signer[]>([]);
  const [onboardingUnits, setOnboardingUnits] = useState<UnitRow[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [selectedTemplateName, setSelectedTemplateName] = useState<string | undefined>();
  const [agreementSending, setAgreementSending] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'offline' | 'error'>('idle');
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveRetryRef = useRef(0);
  const latestAutosavePayloadRef = useRef<Record<string, unknown> | null>(null);
  const autosaveInFlightRef = useRef<AbortController | null>(null);
  const [draftCreationAttempted, setDraftCreationAttempted] = useState(false);

  const ensureOwnerClientRowIds = useCallback(
    (
      ownersList: AddPropertyFormData['owners'],
    ): { ownersWithIds: AddPropertyFormData['owners']; updated: boolean } => {
      let updated = false;
      const ownersWithIds = ownersList.map((owner) => {
        if (owner.clientRowId) return owner;
        updated = true;
        return { ...owner, clientRowId: crypto.randomUUID() };
      });
      return { ownersWithIds, updated };
    },
    [],
  );

  const remapSignersToOwners = useCallback(
    (signersList: Signer[], ownersList: AddPropertyFormData['owners']): Signer[] => {
      if (!ownersList.length) {
        return signersList.map((signer) => ({
          ...signer,
          ownerClientRowId: undefined,
        }));
      }

      const { ownersWithIds } = ensureOwnerClientRowIds(ownersList);
      const ownerIds = new Set(ownersWithIds.map((o) => o.id));
      const ownerClientRowIds = new Set(
        ownersWithIds.map((o) => o.clientRowId).filter(Boolean) as string[],
      );
      const defaultOwner = ownersWithIds.find((o) => o.primary) || ownersWithIds[0];

      return signersList.map((signer) => {
        if (signer.ownerClientRowId && ownerClientRowIds.has(signer.ownerClientRowId)) {
          return signer;
        }

        if (signer.ownerId && ownerIds.has(signer.ownerId)) {
          const ownerMatch = ownersWithIds.find((o) => o.id === signer.ownerId);
          if (ownerMatch?.clientRowId) {
            return { ...signer, ownerClientRowId: ownerMatch.clientRowId };
          }
        }

        if (defaultOwner?.clientRowId) {
          return {
            ...signer,
            ownerClientRowId: defaultOwner.clientRowId,
            ownerId: defaultOwner.id ?? signer.ownerId,
          };
        }

        return signer;
      });
    },
    [ensureOwnerClientRowIds],
  );

  const setSignersWithOwnerMapping = useCallback(
    (nextSigners: Signer[]) => {
      setSigners(remapSignersToOwners(nextSigners, formData.owners));
    },
    [formData.owners, remapSignersToOwners],
  );

  const loadExistingProperties = useCallback(async () => {
    if (!onboardingMode) return;
    setExistingPropertiesLoading(true);
    try {
      const res = await fetchWithSupabaseAuth('/api/properties?page=1&pageSize=100&status=Active', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`Failed to load properties (${res.status})`);
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
      setExistingProperties(
        list.map((p: Record<string, unknown>) => ({
          id: String(p.id),
          name: String(p.name || 'Unnamed property'),
          addressLine1: (p.addressLine1 ?? p.address_line1 ?? null) as string | null | undefined,
          city: (p.city ?? null) as string | null | undefined,
          state: (p.state ?? null) as string | null | undefined,
          postalCode: (p.postalCode ?? p.postal_code ?? null) as string | null | undefined,
          country: (p.country ?? null) as string | null | undefined,
          propertyType: (p.propertyType ?? p.property_type ?? null) as string | null | undefined,
          serviceAssignment: (p.serviceAssignment ?? p.service_assignment ?? null) as
            | string
            | null
            | undefined,
          managementScope: (p.managementScope ?? p.management_scope ?? null) as
            | string
            | null
            | undefined,
        })),
      );
    } catch (e) {
      console.warn('Failed to load existing properties', e);
    } finally {
      setExistingPropertiesLoading(false);
    }
  }, [onboardingMode]);

  const handleExistingPropertySelect = useCallback(
    async (propertyIdValue: string) => {
      setSelectedExistingPropertyId(propertyIdValue);
      if (!propertyIdValue) {
        if (!onboardingId) {
          setPropertyId(null);
        }
        return;
      }

      const option = existingProperties.find((p) => p.id === propertyIdValue);
      if (option) {
        setFormData((prev) => ({
          ...prev,
          propertyType: option.propertyType || prev.propertyType,
          name: option.name || prev.name,
          addressLine1: option.addressLine1 || prev.addressLine1,
          city: option.city || prev.city,
          state: option.state || prev.state,
          postalCode: option.postalCode || prev.postalCode,
          country: option.country || prev.country,
          service_assignment: option.serviceAssignment || prev.service_assignment,
          management_scope: option.managementScope || prev.management_scope,
        }));
      }

      setPropertyId(propertyIdValue);

      try {
        const res = await fetchWithSupabaseAuth(`/api/properties/${propertyIdValue}/details`);
        if (!res.ok) return;
        const detail = await res.json();
        setFormData((prev) => ({
          ...prev,
          propertyType:
            (detail?.property_type as string | undefined) ??
            (detail?.propertyType as string | undefined) ??
            prev.propertyType,
          name: (detail?.name as string | undefined) ?? prev.name,
          addressLine1: (detail?.address_line1 as string | undefined) ?? prev.addressLine1,
          addressLine2: (detail?.address_line2 as string | undefined) ?? prev.addressLine2,
          city: (detail?.city as string | undefined) ?? prev.city,
          state: (detail?.state as string | undefined) ?? prev.state,
          postalCode: (detail?.postal_code as string | undefined) ?? prev.postalCode,
          country: (detail?.country as string | undefined) ?? prev.country,
          borough: (detail?.borough as string | undefined) ?? prev.borough,
          neighborhood: (detail?.neighborhood as string | undefined) ?? prev.neighborhood,
          service_assignment:
            (detail?.service_assignment as string | undefined) ?? prev.service_assignment,
          management_scope:
            (detail?.management_scope as string | undefined) ?? prev.management_scope,
        }));
      } catch (err) {
        console.warn('Failed to hydrate existing property', err);
      }
    },
    [existingProperties, onboardingId, setFormData],
  );

  const canProceed = (step: number, data: AddPropertyFormData) => {
    if (onboardingMode) {
      // Onboarding mode validation
      switch (step) {
        case 1:
          return !!data.service_assignment;
        case 2:
          return !!data.propertyType;
        case 3: {
          if (propertyEntryMode === 'existing') {
            return !!selectedExistingPropertyId;
          }
          return (
            !!data.addressLine1 &&
            !!data.city &&
            !!data.state &&
            !!data.postalCode &&
            !!data.country
          );
        }
        case 4: {
          // Owners & Signers: need at least one owner and one signer email
          const total = (data.owners || []).reduce(
            (sum, o) => sum + (Number(o.ownershipPercentage) || 0),
            0,
          );
          const hasOwners = (data.owners || []).length > 0 && total === 100;
          const hasSigners = signers.length > 0;
          return hasOwners && hasSigners;
        }
        case 5: {
          // Units: at least one unit with a number
          return onboardingUnits.some((u) => (u.unitNumber || '').trim().length > 0);
        }
        case 6: {
          // Review & Send: all previous steps must be complete and template selected
          return !!selectedTemplateId && signers.length > 0;
        }
        default:
          return true;
      }
    }

    // Standard mode validation
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

  useEffect(() => {
    if (!isOpen) {
      setPropertyEntryMode('new');
      setSelectedExistingPropertyId('');
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
        const ownersRes = await fetchWithSupabaseAuth('/api/owners');
        if (!ownersRes.ok) {
          console.warn('Owners fetch non-OK', ownersRes.status);
          setOwners([]);
          return;
        }
        const ownersJson = await ownersRes.json().catch(() => []);

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

  useEffect(() => {
    if (!isOpen || !onboardingMode) return;
    if (propertyEntryMode !== 'existing') return;
    if (existingProperties.length > 0 || existingPropertiesLoading) return;
    void loadExistingProperties();
  }, [
    existingProperties.length,
    existingPropertiesLoading,
    isOpen,
    loadExistingProperties,
    onboardingMode,
    propertyEntryMode,
  ]);

  // When resuming an onboarding draft, hydrate basic fields and IDs
  useEffect(() => {
    if (!isOpen || !onboardingMode || !resumeOnboarding) return;
    setOnboardingId(resumeOnboarding.onboardingId);
    setPropertyId(resumeOnboarding.propertyId);
    setSignersWithOwnerMapping(resumeOnboarding.signers || []);
    setDraftCreationAttempted(true);
    setFormData((prev) => ({
      ...prev,
      propertyType: resumeOnboarding.property?.propertyType || prev.propertyType,
      name: resumeOnboarding.property?.name || prev.name,
      addressLine1: resumeOnboarding.property?.addressLine1 || prev.addressLine1,
      city: resumeOnboarding.property?.city || prev.city,
      state: resumeOnboarding.property?.state || prev.state,
      postalCode: resumeOnboarding.property?.postalCode || prev.postalCode,
      country: resumeOnboarding.property?.country || prev.country,
      service_assignment: resumeOnboarding.property?.serviceAssignment || prev.service_assignment,
      owners:
        resumeOnboarding.owners && resumeOnboarding.owners.length > 0
          ? resumeOnboarding.owners.map((owner) => ({
              ...owner,
              clientRowId: owner.clientRowId || crypto.randomUUID(),
              saved: true,
            }))
          : prev.owners,
    }));
    if (resumeOnboarding.units && resumeOnboarding.units.length > 0) {
      setOnboardingUnits(
        resumeOnboarding.units.map((unit) => ({
          ...unit,
          clientRowId: unit.clientRowId || crypto.randomUUID(),
          saved: true,
        })),
      );
    }
  }, [isOpen, onboardingMode, resumeOnboarding]);

  // Reset draft creation flag when modal closes
  useEffect(() => {
    if (!isOpen) {
      setDraftCreationAttempted(false);
    }
  }, [isOpen]);

  // Ensure owners always carry a stable clientRowId
  useEffect(() => {
    if (formData.owners.some((o) => !o.clientRowId)) {
      setFormData((prev) => {
        const { ownersWithIds, updated } = ensureOwnerClientRowIds(prev.owners);
        return updated ? { ...prev, owners: ownersWithIds } : prev;
      });
    }
  }, [formData.owners, ensureOwnerClientRowIds]);

  // Keep signer → owner association aligned to stable keys
  useEffect(() => {
    setSigners((prev) => {
      const mapped = remapSignersToOwners(prev, formData.owners);
      const changed =
        mapped.length !== prev.length ||
        mapped.some((signer, idx) => signer !== prev[idx]);
      return changed ? mapped : prev;
    });
  }, [formData.owners, remapSignersToOwners]);

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

  const computedOnboardingProgress = useMemo(() => {
    if (!onboardingMode) return undefined;
    const stepProgress = Math.max(
      10,
      Math.min(90, Math.round((currentStep / ONBOARDING_STEPS.length) * 90)),
    );
    return stepProgress;
  }, [onboardingMode, currentStep]);

  const currentStagePayload = useMemo(() => {
    if (!onboardingMode || !onboardingId) return null;
    const basePayload: Record<string, unknown> = {
        currentStage: {
          step: currentStep,
          property: {
            entryMode: propertyEntryMode,
            existingPropertyId: selectedExistingPropertyId || null,
            propertyType: formData.propertyType,
            name: formData.name,
            addressLine1: formData.addressLine1,
            addressLine2: formData.addressLine2,
            city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: formData.country,
          borough: formData.borough,
          neighborhood: formData.neighborhood,
        },
        owners: formData.owners,
        signers,
        units: onboardingUnits,
      },
    };
    if (typeof computedOnboardingProgress === 'number') {
      basePayload.progress = computedOnboardingProgress;
    }
    return basePayload;
  }, [
    onboardingMode,
    onboardingId,
    currentStep,
    propertyEntryMode,
    selectedExistingPropertyId,
    formData.propertyType,
    formData.name,
    formData.addressLine1,
    formData.addressLine2,
    formData.city,
    formData.state,
    formData.postalCode,
    formData.country,
    formData.borough,
    formData.neighborhood,
    formData.owners,
    signers,
    onboardingUnits,
    computedOnboardingProgress,
  ]);

  const performAutosave = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!onboardingId) return;
      latestAutosavePayloadRef.current = payload;
      autosaveRetryRef.current = 0;
      autosaveInFlightRef.current?.abort();
      const controller = new AbortController();
      autosaveInFlightRef.current = controller;

      const save = async (attempt: number) => {
        try {
          setAutosaveStatus('saving');
          setAutosaveError(null);
          const response = await fetchWithSupabaseAuth(`/api/onboarding/${onboardingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal,
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error?.message || 'Autosave failed');
          }

          setAutosaveStatus('saved');
          setAutosaveError(null);
          autosaveRetryRef.current = 0;
        } catch (err) {
          const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
          if (controller.signal.aborted) return;
          if (offline) {
            setAutosaveStatus('offline');
          } else {
            setAutosaveStatus('error');
            setAutosaveError(err instanceof Error ? err.message : 'Autosave failed');
          }

          const nextAttempt = attempt + 1;
          if (nextAttempt <= 3) {
            const backoffMs = Math.min(30000, 2000 * 2 ** attempt);
            autosaveRetryRef.current = nextAttempt;
            autosaveTimerRef.current = setTimeout(() => save(nextAttempt), backoffMs);
          }
        }
      };

      autosaveTimerRef.current = setTimeout(() => save(autosaveRetryRef.current), 800);
    },
    [onboardingId],
  );

  const scheduleAutosave = useCallback(
    (payload: Record<string, unknown> | null) => {
      if (!payload || !onboardingId) return;
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
      performAutosave(payload);
    },
    [onboardingId, performAutosave],
  );

  useEffect(() => {
    if (!currentStagePayload) return;
    scheduleAutosave(currentStagePayload);
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [currentStagePayload, scheduleAutosave]);

  useEffect(() => {
    const handleOnline = () => {
      if (autosaveStatus === 'offline' && latestAutosavePayloadRef.current && onboardingId) {
        scheduleAutosave(latestAutosavePayloadRef.current);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [autosaveStatus, onboardingId, scheduleAutosave]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
      autosaveInFlightRef.current?.abort();
    };
  }, []);

  const handleNext = async () => {
    if (onboardingMode) {
      // Handle onboarding-specific step transitions
      if (currentStep === 3 && !onboardingId) {
        // Create property + onboarding draft after address capture
        await createOnboardingDraft();
      } else if (currentStep === 4 && onboardingId) {
        // Save owners to API
        await saveOnboardingOwners();
      } else if (currentStep === 5 && onboardingId) {
        // Save units to API
        await saveOnboardingUnits();
      }
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      if (onboardingMode) {
        await handleSendAgreement();
      } else {
        handleSubmit();
      }
    }
  };

  // Onboarding API functions
  const createOnboardingDraft = async (opts?: { fromBlur?: boolean }) => {
    if (propertyEntryMode === 'existing') {
      if (!selectedExistingPropertyId) return;
      try {
        setDraftCreationAttempted(true);
        if (!opts?.fromBlur) setSubmitting(true);
        setSubmitError(null);
        const response = await fetchWithSupabaseAuth('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyId: selectedExistingPropertyId }),
        });

        if (response.status === 409) {
          const data = await response.json();
          const shouldResume =
            typeof window === 'undefined'
              ? true
              : window.confirm('A draft already exists for this property. Resume draft?');
          if (shouldResume && data.existingOnboardingId) {
            setOnboardingId(data.existingOnboardingId);
            setPropertyId(data.existingPropertyId || selectedExistingPropertyId);
            setSubmitSuccess('Resumed existing onboarding draft for this property.');
          } else {
            setSubmitError('A draft already exists for this property.');
          }
          setDraftCreationAttempted(true);
          return;
        }

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || 'Failed to create onboarding draft');
        }

        const data = await response.json();
        setOnboardingId(data.onboarding.id);
        setPropertyId(data.property.id);
        setDraftCreationAttempted(true);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Failed to create draft');
      } finally {
        if (!opts?.fromBlur) setSubmitting(false);
      }
      return;
    }

    const requiredBasics =
      formData.propertyType &&
      formData.addressLine1 &&
      formData.city &&
      formData.state &&
      formData.postalCode &&
      formData.country;
    if (!requiredBasics) return;
    try {
      setDraftCreationAttempted(true);
      if (!opts?.fromBlur) setSubmitting(true);
      setSubmitError(null);
      const response = await fetchWithSupabaseAuth('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyType: formData.propertyType,
          name: formData.name || `${formData.addressLine1}, ${formData.city}`,
          addressLine1: formData.addressLine1,
          addressLine2: formData.addressLine2 || undefined,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: formData.country,
          borough: formData.borough,
          neighborhood: formData.neighborhood,
          latitude: formData.latitude,
          longitude: formData.longitude,
          serviceAssignment: formData.service_assignment || 'Property Level',
          managementScope: formData.management_scope || 'Building',
        }),
      });

      if (response.status === 409) {
        const data = await response.json();
        const shouldResume =
          typeof window === 'undefined' ? true : window.confirm('A draft already exists for this address. Resume draft?');
        if (shouldResume && data.existingOnboardingId) {
          setOnboardingId(data.existingOnboardingId);
          setPropertyId(data.existingPropertyId);
          setSubmitSuccess('Resumed existing onboarding draft for this address.');
        } else {
          setSubmitError('A draft already exists for this address.');
        }
        setDraftCreationAttempted(true);
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create onboarding draft');
      }

      const data = await response.json();
      setOnboardingId(data.onboarding.id);
      setPropertyId(data.property.id);
      setDraftCreationAttempted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create draft');
    } finally {
      if (!opts?.fromBlur) setSubmitting(false);
    }
  };

  const saveOnboardingOwners = async () => {
    if (!onboardingId) return;
    try {
      setSubmitting(true);
      const { ownersWithIds, updated } = ensureOwnerClientRowIds(formData.owners);
      if (updated) {
        setFormData((prev) => ({ ...prev, owners: ownersWithIds }));
      }

      const remappedSigners = remapSignersToOwners(signers, ownersWithIds);
      const signersChanged =
        remappedSigners.length !== signers.length ||
        remappedSigners.some((s, idx) => s !== signers[idx]);
      if (signersChanged) {
        setSigners(remappedSigners);
      }

      const ownersById = new Map(ownersWithIds.map((owner) => [owner.id, owner]));
      const signerByClientRowId = new Map<string, Signer>();
      remappedSigners.forEach((signer) => {
        if (signer.ownerClientRowId) {
          signerByClientRowId.set(signer.ownerClientRowId, signer);
          return;
        }
        if (signer.ownerId) {
          const owner = ownersById.get(signer.ownerId);
          if (owner?.clientRowId) {
            signerByClientRowId.set(owner.clientRowId, { ...signer, ownerClientRowId: owner.clientRowId });
          }
        }
      });

      const ownersPayload = ownersWithIds.map((o) => {
        const signer = o.clientRowId ? signerByClientRowId.get(o.clientRowId) : undefined;
        return {
          clientRowId: o.clientRowId as string,
          ownerId: o.id,
          ownershipPercentage: o.ownershipPercentage,
          disbursementPercentage: o.disbursementPercentage,
          primary: o.primary,
          signerEmail: signer?.email,
          signerName: signer?.name,
        };
      });

      const response = await fetchWithSupabaseAuth(`/api/onboarding/${onboardingId}/owners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owners: ownersPayload }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save owners');
      }

      setFormData((prev) => ({
        ...prev,
        owners: prev.owners.map((owner) => ({
          ...owner,
          saved: true,
        })),
      }));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save owners');
    } finally {
      setSubmitting(false);
    }
  };

  const saveOnboardingUnits = async (unitsToSave?: UnitRow[]) => {
    if (!onboardingId) return;
    const units = unitsToSave ?? onboardingUnits;
    try {
      setSubmitting(true);
      const unitsPayload = units
        .filter((u) => u.unitNumber.trim())
        .map((u) => ({
          clientRowId: u.clientRowId,
          unitNumber: u.unitNumber,
          unitBedrooms: u.unitBedrooms,
          unitBathrooms: u.unitBathrooms,
          unitSize: u.unitSize,
          description: u.description,
        }));

      const response = await fetchWithSupabaseAuth(`/api/onboarding/${onboardingId}/units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ units: unitsPayload }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save units');
      }

      // Mark saved state locally
      setOnboardingUnits(
        units.map((u) => ({
          ...u,
          saved: true,
          error: undefined,
        })),
      );
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save units');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendAgreement = async () => {
    if (!propertyId || !selectedTemplateId) return;
    try {
      setAgreementSending(true);
      setSubmitError(null);

      // First finalize the onboarding
      if (onboardingId) {
        const finalizeRes = await fetchWithSupabaseAuth(`/api/onboarding/${onboardingId}/finalize`, {
          method: 'POST',
        });
        if (!finalizeRes.ok) {
          const data = await finalizeRes.json();
          throw new Error(data.error || 'Failed to finalize onboarding');
        }
      }

      // Then send the agreement
      const response = await fetchWithSupabaseAuth('/api/agreements/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          onboardingId,
          propertyId,
          recipients: signers.map((s) => ({ email: s.email, name: s.name })),
          templateId: selectedTemplateId,
          templateName: selectedTemplateName,
        }),
      });

      if (response.status === 409) {
        const data = await response.json();
        const recipients = (data.recipients || []).map((r: any) => r.email || '').join(', ');
        const confirmResend = window.confirm(
          `Agreement already sent to ${recipients || 'these recipients'} at ${data.sentAt}. Resend anyway?`,
        );
        if (!confirmResend) {
          setSubmitError(`Agreement already sent: ${data.sentAt}`);
          return;
        }
        // If user chooses to resend, drop idempotency by adding a noise param
        const retry = await fetchWithSupabaseAuth('/api/agreements/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            onboardingId,
            propertyId,
            recipients: signers.map((s) => ({ email: s.email, name: s.name })),
            templateId: selectedTemplateId,
            templateName: selectedTemplateName,
            webhookPayload: { ...{ retry: true }, timestamp: new Date().toISOString() },
          }),
        });
        if (!retry.ok) {
          const retryData = await retry.json();
          throw new Error(retryData.error || 'Failed to send agreement');
        }
        setSubmitSuccess('Agreement resent successfully!');
        onClose();
        if (onSuccess) onSuccess();
        router.push(`/properties/${propertyId}`);
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send agreement');
      }

      setSubmitSuccess('Agreement sent successfully!');
      onClose();
      if (onSuccess) onSuccess();
      router.push(`/properties/${propertyId}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to send agreement');
    } finally {
      setAgreementSending(false);
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

      const response = await fetchWithSupabaseAuth(url, {
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

            const assignmentRes = await fetchWithSupabaseAuth('/api/services/assignments', {
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
              const servicesRes = await fetchWithSupabaseAuth('/api/services/assignment-services', {
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
      const clientRowId = crypto.randomUUID();
      const newOwner = {
        id: ownerId,
        name,
        clientRowId,
        ownershipPercentage: 100,
        disbursementPercentage: 100,
        primary: formData.owners.length === 0, // First owner is primary
      };
      const nextOwners = [...formData.owners, newOwner];
      setFormData((prev) => ({
        ...prev,
        owners: nextOwners,
      }));
      setSigners((prev) => remapSignersToOwners(prev, nextOwners));
    }
  };

  const removeOwner = (ownerId: string) => {
    const nextOwners = formData.owners.filter((o) => o.id !== ownerId);
    setFormData((prev) => ({
      ...prev,
      owners: nextOwners,
    }));
    setSigners((prev) => remapSignersToOwners(prev, nextOwners));
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

  const inlineUnitsContent = useMemo(() => {
    const shouldCollectInline =
      onboardingMode || formData.management_scope === 'Unit' || propertyEntryMode === 'existing';
    if (!shouldCollectInline) return null;
    if (onboardingMode) {
      return (
        <BulkUnitCreator
          units={onboardingUnits}
          onUnitsChange={setOnboardingUnits}
          onSaveUnits={saveOnboardingUnits}
          disabled={!onboardingId}
          isSaving={submitting}
        />
      );
    }
    return <Step4UnitDetails formData={formData} setFormData={setFormData} />;
  }, [
    formData,
    propertyEntryMode,
    onboardingMode,
    onboardingUnits,
    onboardingId,
    saveOnboardingUnits,
    submitting,
    setOnboardingUnits,
    setFormData,
  ]);

  const nextEnabled = !submitting && stepReady;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <LargeDialogContent
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
        className="bg-card border-border/80"
      >
        {/* Header */}
        <DialogHeader className="border-border border-b p-6">
          <DialogTitle>
            <Heading as="h3" size="h4">
              {onboardingMode ? 'New Onboarding' : 'Add New Property'}
            </Heading>
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="border-border border-b px-6 py-4">
          {isTourActive ? (
            <div className="mb-3 flex justify-end">
              <Body as="span" tone="muted" size="xs">
                {stepReady ? 'Next is ready' : 'Complete this step to unlock Next'}
              </Body>
            </div>
          ) : null}
          <div className="flex items-center gap-0 w-full">
            {activeSteps.map((step, index) => (
              <Fragment key={step.id}>
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border ${
                    currentStep >= step.id
                      ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  <Label as="span" size="sm" className="text-current">
                    {currentStep > step.id ? '✓' : step.id}
                  </Label>
                </div>
                {index < activeSteps.length - 1 && (
                  <div className="mx-2 h-px flex-1 bg-border" aria-hidden />
                )}
              </Fragment>
            ))}
          </div>
          <Body as="div" size="xs" tone="muted" className="mt-2">
            Step {currentStep} of {totalSteps} · {activeSteps.find((s) => s.id === currentStep)?.title}
          </Body>
        </div>

        {/* Step Content */}
        <div className={`p-5 md:p-6${isTourActive ? 'pb-24' : ''}`}>
          {submitError && (
            <div className="bg-destructive/10 border-destructive/20 mb-4 rounded-md border p-3">
              <Body as="p" size="sm" className="text-destructive">
                {submitError}
              </Body>
            </div>
          )}
          {submitSuccess && (
            <div className="bg-success/10 border-success/20 mb-4 rounded-md border p-3">
              <Body as="p" size="sm" className="text-success">
                {submitSuccess}
              </Body>
            </div>
          )}
          {onboardingMode && onboardingId && (
            <div className="mb-3 flex items-center justify-between rounded-md border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
              <span>
                Autosave:{' '}
                {autosaveStatus === 'saving'
                  ? 'Saving...'
                  : autosaveStatus === 'saved'
                    ? 'Saved'
                    : autosaveStatus === 'offline'
                      ? 'Offline - will retry'
                      : autosaveStatus === 'error'
                        ? 'Needs retry'
                        : 'Idle'}
              </span>
              {autosaveError && (
                <span className="text-destructive">Last error: {autosaveError}</span>
              )}
            </div>
          )}
          {isTourActive && showTourIntro && (
            <TourIntroCard onStart={startTourNow} onSkip={dismissTour} />
          )}
          {isTourActive && !showTourIntro && (
            <GuidedStepTip config={TOUR_STEPS[currentStep]} ready={stepReady} />
          )}
          {currentStep === 1 && onboardingMode && (
            <Step1ManagementScope formData={formData} setFormData={setFormData} />
          )}

          {currentStep === 1 && !onboardingMode && (
            <Step1PropertyType
              formData={formData}
              setFormData={setFormData}
              onboardingMode={onboardingMode}
            />
          )}

          {currentStep === 2 && onboardingMode && (
            <Step1PropertyType
              formData={formData}
              setFormData={setFormData}
              onboardingMode={onboardingMode}
            />
          )}

          {currentStep === (onboardingMode ? 3 : 2) && (
            <Step2PropertyDetails
              formData={formData}
              setFormData={setFormData}
              onboardingMode={onboardingMode}
              onboardingId={onboardingId}
              draftCreationAttempted={draftCreationAttempted}
              onPostalBlur={() => void createOnboardingDraft({ fromBlur: true })}
              inlineUnitsContent={inlineUnitsContent}
              propertyEntryMode={propertyEntryMode}
              onPropertyEntryModeChange={(mode) => {
                setPropertyEntryMode(mode);
                if (mode === 'new') {
                  setSelectedExistingPropertyId('');
                  if (!onboardingId) {
                    setPropertyId(null);
                  }
                }
              }}
              existingProperties={existingProperties}
              existingPropertiesLoading={existingPropertiesLoading}
              selectedExistingPropertyId={selectedExistingPropertyId}
              onSelectExistingProperty={handleExistingPropertySelect}
            />
          )}

          {currentStep === (onboardingMode ? 4 : 3) && !onboardingMode && (
            <Step3Ownership
              formData={formData}
              setFormData={setFormData}
              addOwner={addOwner}
              removeOwner={removeOwner}
              updateOwnerPercentage={updateOwnerPercentage}
              setPrimaryOwner={setPrimaryOwner}
            />
          )}

          {currentStep === (onboardingMode ? 4 : 3) && onboardingMode && (
          <Step3OwnersAndSigners
            formData={formData}
            setFormData={setFormData}
            addOwner={addOwner}
            removeOwner={removeOwner}
            updateOwnerPercentage={updateOwnerPercentage}
            setPrimaryOwner={setPrimaryOwner}
            signers={signers}
            onSignersChange={setSignersWithOwnerMapping}
          />
        )}

          {currentStep === (onboardingMode ? 5 : 4) && !onboardingMode && (
            formData.management_scope === 'Unit' ? (
              <div className="border-border bg-muted/30 rounded-lg border p-4 text-sm text-muted-foreground">
                Units were collected in Property Details for unit-level management.
              </div>
            ) : (
              <Step4UnitDetails formData={formData} setFormData={setFormData} />
            )
          )}

          {currentStep === (onboardingMode ? 5 : 4) && onboardingMode && (
            formData.management_scope === 'Unit' ? (
              <div className="border-border bg-muted/30 rounded-lg border p-4 text-sm text-muted-foreground">
                Units were collected in Property Details for unit-level management.
              </div>
            ) : (
              <Step4OnboardingUnits
                units={onboardingUnits}
                onUnitsChange={setOnboardingUnits}
                onSaveUnits={saveOnboardingUnits}
                isSaving={submitting}
              />
            )
          )}

          {currentStep === (onboardingMode ? 6 : 5) && !onboardingMode && (
            <Step5ManagementServices
              formData={formData}
              setFormData={setFormData}
              serviceDraft={serviceDraft}
              setServiceDraft={setServiceDraft}
            />
          )}

          {currentStep === (onboardingMode ? 6 : 5) && onboardingMode && (
            <Step5ReviewAndSend
              formData={formData}
              signers={signers}
              units={onboardingUnits}
              selectedTemplateId={selectedTemplateId}
              onTemplateChange={(id, name) => {
                setSelectedTemplateId(id);
                setSelectedTemplateName(name);
              }}
              onEditStep={setCurrentStep}
              propertyId={propertyId}
            />
          )}

          {currentStep === 6 && !onboardingMode && (
            <Step6BankAccount formData={formData} setFormData={setFormData} />
          )}

          {currentStep === 7 && !onboardingMode && (
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
            {!onboardingMode && currentStep === totalSteps && (
              <Label as="label" tone="muted" size="sm" className="flex items-center gap-2 select-none">
                <Checkbox
                  className={`h-4 w-4 ${FOCUS_RING}`}
                  checked={syncToBuildium}
                  onChange={(e) => setSyncToBuildium(e.target.checked)}
                />
                Create this property in Buildium
              </Label>
            )}
            <Button
              type="button"
              onClick={handleNext}
              disabled={!nextEnabled || agreementSending}
              className={`${FOCUS_RING} min-h-[44px]`}
            >
              {submitting || agreementSending
                ? 'Saving...'
                : currentStep === totalSteps
                  ? onboardingMode
                    ? 'Send Agreement'
                    : 'Create Property'
                  : 'Next'}
            </Button>
          </div>
        </div>
      </LargeDialogContent>
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
            <Badge variant="outline" className="uppercase tracking-wide">
              Step {config.id} / {TOTAL_STEPS}
            </Badge>
            <Badge variant={ready ? 'success' : 'outline'}>
              {ready ? 'Ready for Next' : 'Finish required items'}
            </Badge>
          </div>
          <div>
            <Heading as="h4" size="h6">
              {config.title}
            </Heading>
            <Body as="p" tone="muted" size="sm">
              {config.description}
            </Body>
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {config.bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-2">
                <CheckCircle2
                  className={`mt-0.5 h-4 w-4 ${ready ? 'text-success' : 'text-primary'}`}
                />
                <Body as="span" size="sm">
                  {bullet}
                </Body>
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
              <Badge variant="outline" className="uppercase tracking-wide">
                Step {config.id}/{TOTAL_STEPS}
              </Badge>
            </div>
            <Label as="p" size="sm">
              {config.title}
            </Label>
            <Body as="p" tone="muted" size="xs">
              {config.description}
            </Body>
            <ul className="space-y-1">
              {config.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <CheckCircle2
                    className={`mt-0.5 h-4 w-4 ${ready ? 'text-success' : 'text-primary'}`}
                  />
                  <Body as="span" size="xs">
                    {bullet}
                  </Body>
                </li>
              ))}
            </ul>
            <Body as="p" tone="muted" size="xs">
              {ready ? 'Next is highlighted.' : 'Complete these to enable Next.'}
            </Body>
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
            <Heading as="h4" size="h5">
              Guided tour: Add Property
            </Heading>
            <Body as="span" tone="muted" size="xs">
              {TOTAL_STEPS} steps
            </Body>
          </div>
          <Body as="p" tone="muted" size="sm">
            Quick checklist before you start. These match the required fields the modal already
            validates.
          </Body>
          <div className="grid gap-2 sm:grid-cols-2">
            {PRE_TOUR_REQUIREMENTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="border-border/70 bg-background flex items-center gap-2 rounded-md border px-2 py-2"
                >
                  <Icon className="text-primary h-4 w-4" />
                  <Body as="span" size="sm">
                    {item.label}
                  </Body>
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
            <Body as="span" tone="muted" size="xs">
              Next highlights once the checklist for each step is done.
            </Body>
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
  onboardingMode,
}: {
  formData: AddPropertyFormData;
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>;
  onboardingMode?: boolean;
}) {
  const CurrentIcon = STEPS[0].icon;
  const showManagementScope = !onboardingMode;

  const handleSelectType = (type: string) => {
    setFormData((prev) => {
      const next: AddPropertyFormData = { ...prev, propertyType: type };
      if (!prev.service_assignment) {
        next.service_assignment = 'Property Level';
      }
      if (!prev.management_scope) {
        next.management_scope = 'Building';
      }
      return next;
    });
  };


  return (
    <div className="text-center">
      <CurrentIcon className="text-primary mx-auto mb-2 h-12 w-12" />
      <Heading as="h3" size="h4" className="mb-1">
        Property Type
      </Heading>
      <Body as="p" tone="muted" size="sm" className="mb-4">
        What type of property are you adding?
      </Body>

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
                onClick={() => handleSelectType(type)}
              >
                <Building
                  className={`h-5 w-5 ${selected ? 'text-primary-foreground' : 'text-muted-foreground'}`}
                />
                <Label as="span" size="sm" className={selected ? 'text-primary-foreground' : ''}>
                  {type}
                </Label>
              </Button>
            );
          })}
        </div>
      </div>

      {showManagementScope && (
        <div className="mx-auto mt-6 max-w-2xl space-y-2 rounded-lg border border-dashed border-border/70 bg-muted/40 p-4 text-left">
          <Label size="sm" className="font-semibold">
            Management scope
          </Label>
          <Body size="xs" tone="muted">
            Choose how you manage services and setup: once for the property or separately per unit.
          </Body>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={formData.service_assignment === 'Property Level' ? 'default' : 'outline'}
              className={`h-12 justify-start ${FOCUS_RING}`}
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  service_assignment: 'Property Level',
                  management_scope: 'Building',
                }))
              }
            >
              <div className="text-left">
                <Label size="sm">Property level</Label>
                <Body size="xs" tone="muted">
                  Configure services once for the whole building.
                </Body>
              </div>
            </Button>
            <Button
              type="button"
              variant={formData.service_assignment === 'Unit Level' ? 'default' : 'outline'}
              className={`h-12 justify-start ${FOCUS_RING}`}
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  service_assignment: 'Unit Level',
                  management_scope: 'Unit',
                }))
              }
            >
              <div className="text-left">
                <Label size="sm">Unit level</Label>
                <Body size="xs" tone="muted">
                  Configure services separately for each unit.
                </Body>
              </div>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Step 2: Property Details
function Step2PropertyDetails({
  formData,
  setFormData,
  onboardingMode,
  onboardingId,
  draftCreationAttempted,
  onPostalBlur,
  inlineUnitsContent,
  propertyEntryMode,
  onPropertyEntryModeChange,
  existingProperties,
  existingPropertiesLoading,
  selectedExistingPropertyId,
  onSelectExistingProperty,
}: {
  formData: AddPropertyFormData;
  setFormData: Dispatch<SetStateAction<AddPropertyFormData>>;
  onboardingMode?: boolean;
  onboardingId?: string | null;
  draftCreationAttempted?: boolean;
  onPostalBlur?: () => void;
  inlineUnitsContent?: React.ReactNode;
  propertyEntryMode: PropertyEntryMode;
  onPropertyEntryModeChange: (mode: PropertyEntryMode) => void;
  existingProperties: ExistingPropertyOption[];
  existingPropertiesLoading?: boolean;
  selectedExistingPropertyId?: string;
  onSelectExistingProperty: (propertyId: string) => void;
}) {
  const CurrentIcon = STEPS[1].icon;

  return (
    <div>
      <div className="mb-4 text-center">
        <CurrentIcon className="text-primary mx-auto mb-2 h-12 w-12" />
        <Heading as="h3" size="h4" className="mb-1">
          Property Details
        </Heading>
        <Body as="p" tone="muted" size="sm">
          Enter the property address and basic information
        </Body>
      </div>

      {onboardingMode ? (
        <div className="mx-auto mb-4 flex max-w-3xl flex-wrap items-center justify-center gap-2 md:max-w-4xl">
          <Button
            type="button"
            size="sm"
            variant={propertyEntryMode === 'new' ? 'default' : 'outline'}
            onClick={() => onPropertyEntryModeChange('new')}
          >
            Create new property
          </Button>
          <Button
            type="button"
            size="sm"
            variant={propertyEntryMode === 'existing' ? 'default' : 'outline'}
            onClick={() => onPropertyEntryModeChange('existing')}
          >
            Select existing property
          </Button>
        </div>
      ) : null}

      <div className="mx-auto max-w-3xl space-y-4 md:max-w-4xl">
        {onboardingMode && propertyEntryMode === 'existing' ? (
          <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label as="label" size="sm">
                  Choose an existing property
                </Label>
                <Body size="xs" tone="muted">
                  We will use the saved address; add units for this property below.
                </Body>
              </div>
              {existingPropertiesLoading ? (
                <Body size="xs" tone="muted">
                  Loading…
                </Body>
              ) : null}
            </div>
            <Select
              value={selectedExistingPropertyId || ''}
              onValueChange={(value) => onSelectExistingProperty(value)}
              disabled={existingPropertiesLoading}
            >
              <SelectTrigger className={`h-10 w-full ${FOCUS_RING}`}>
                <SelectValue placeholder="Select property" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Select property</SelectItem>
                {existingProperties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                    {p.city ? ` — ${p.city}${p.state ? `, ${p.state}` : ''}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {propertyEntryMode === 'new' && (
          <>
            <div>
              <Label as="label" htmlFor="add-property-street" className="mb-1 block" size="sm">
                Street Address *
              </Label>
              <AddressAutocomplete
                id="add-property-street"
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label as="label" className="mb-1 block" size="sm">
                  City *
                </Label>
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
                <Label as="label" className="mb-1 block" size="sm">
                  State *
                </Label>
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
                <Label as="label" className="mb-1 block" size="sm">
                  ZIP Code *
                </Label>
                <input
                  type="text"
                  value={formData.postalCode}
                  onChange={(e) => setFormData((prev) => ({ ...prev, postalCode: e.target.value }))}
                  onBlur={() => {
                    if (onboardingMode && !onboardingId && !draftCreationAttempted) {
                      onPostalBlur?.();
                    }
                  }}
                  autoComplete="postal-code"
                  className={`border-border bg-background text-foreground placeholder:text-muted-foreground h-10 w-full rounded-lg border px-3 ${FOCUS_RING}`}
                  placeholder="Enter ZIP code"
                />
              </div>
              <div>
                <Label as="label" htmlFor="add-property-country" className="mb-1 block" size="sm">
                  Country *
                </Label>
                <Select
                  value={formData.country || EMPTY_OPTION_VALUE}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      country: value === EMPTY_OPTION_VALUE ? '' : value,
                    }))
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
              <Label as="label" className="mb-1 block" size="sm">
                Description
              </Label>
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
          </>
        )}

        {inlineUnitsContent && (
          <div className="mt-6 space-y-3 rounded-lg border border-dashed border-border/70 bg-muted/30 p-4">
            <Heading as="h4" size="h6">
              Units
            </Heading>
            <Body size="sm" tone="muted">
              {propertyEntryMode === 'existing'
                ? 'You selected an existing property, so add units for it here.'
                : 'Add units for this onboarding now so the later Units step is review-only.'}
            </Body>
            {inlineUnitsContent}
          </div>
        )}
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
      const res = await fetchWithSupabaseAuth('/api/csrf', { credentials: 'include' });
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
        const res = await fetchWithSupabaseAuth('/api/owners');
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
      const res = await fetchWithSupabaseAuth('/api/owners', {
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
        <Heading as="h3" size="h4" className="mb-2">
          Ownership
        </Heading>
        <Body as="p" tone="muted" size="sm">
          Select the owners related to this property
        </Body>
      </div>

      <div className="space-y-4">
        <div>
          <Label
            as="label"
            htmlFor="add-property-owner-select"
            className="mb-1 block"
            size="sm"
          >
            Add Owners *
          </Label>
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
          <SelectTrigger className="h-10 w-full">
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
            <Heading as="h4" size="h6" className="mb-3">
              Create New Owner
            </Heading>
            {err && (
              <Body as="p" size="sm" className="text-destructive mb-2">
                {err}
              </Body>
            )}
            {!err && (csrfLoading || !csrfToken) && (
              <Body as="p" tone="muted" size="sm" className="mb-2">
                Preparing security token…
              </Body>
            )}
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label as="label" size="xs" tone="muted" className="mb-1 block">
                  First Name *
                </Label>
                <input
                  className={`border-border bg-background h-9 w-full rounded border px-2 ${FOCUS_RING}`}
                  value={createFirst}
                  onChange={(e) => setCreateFirst(e.target.value)}
                  placeholder="e.g., John"
                />
              </div>
              <div>
                <Label as="label" size="xs" tone="muted" className="mb-1 block">
                  Last Name *
                </Label>
                <input
                  className={`border-border bg-background h-9 w-full rounded border px-2 ${FOCUS_RING}`}
                  value={createLast}
                  onChange={(e) => setCreateLast(e.target.value)}
                  placeholder="e.g., Smith"
                />
              </div>
              <div className="sm:col-span-2">
                <Label as="label" size="xs" tone="muted" className="mb-1 block">
                  Email *
                </Label>
                <input
                  className={`border-border bg-background h-9 w-full rounded border px-2 ${FOCUS_RING}`}
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="e.g., john.smith@example.com"
                />
              </div>
              <div className="sm:col-span-2">
                <Label as="label" size="xs" tone="muted" className="mb-1 block">
                  Phone
                </Label>
                <input
                  className={`border-border bg-background h-9 w-full rounded border px-2 ${FOCUS_RING}`}
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  placeholder="e.g., (555) 123-4567"
                />
              </div>
              <div>
                <Label as="label" size="xs" tone="muted" className="mb-1 block">
                  Ownership %
                </Label>
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
                <Label as="label" size="xs" tone="muted" className="mb-1 block">
                  Disbursement %
                </Label>
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
                <Label
                  as="label"
                  size="xs"
                  tone="muted"
                  className="inline-flex items-center gap-2"
                >
                  <Checkbox
                    className={FOCUS_RING}
                    checked={createPrimary}
                    onChange={(e) => setCreatePrimary(e.target.checked)}
                  />
                  Primary
                </Label>
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
            <Heading as="h4" size="h6" className="mb-2">
              Selected Owners
            </Heading>
            <div className="border-border overflow-hidden rounded-lg border">
              <table className="w-full">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-2 text-left">
                      <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                        Owner
                      </Label>
                    </th>
                    <th className="px-4 py-2 text-center">
                      <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                        Ownership %
                      </Label>
                    </th>
                    <th className="px-4 py-2 text-center">
                      <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                        Disbursement %
                      </Label>
                    </th>
                    <th className="px-4 py-2 text-center">
                      <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                        Primary
                      </Label>
                    </th>
                    <th className="px-4 py-2 text-center">
                      <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                        Status
                      </Label>
                    </th>
                    <th className="px-4 py-2 text-right">
                      <Label as="span" size="xs" tone="muted" className="uppercase tracking-wide">
                        Action
                      </Label>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {formData.owners.map((owner) => (
                    <tr key={owner.id} className="border-border border-t">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Label as="span" size="sm">
                            {owner.name || 'Unnamed Owner'}
                          </Label>
                          {String(owner.status || '').toLowerCase() === 'new' && (
                            <Badge variant="default">
                              New Owner
                            </Badge>
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
                          className={`border-border bg-background w-24 rounded border px-2 py-1 leading-tight ${FOCUS_RING}`}
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
                          className={`border-border bg-background w-24 rounded border px-2 py-1 leading-tight ${FOCUS_RING}`}
                          min={0}
                          max={100}
                          step={1}
                          aria-label={`Disbursement percentage for ${owner.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Checkbox
                          className={FOCUS_RING}
                          checked={!!owner.primary}
                          onChange={() => setPrimaryOwner(owner.id)}
                          aria-label={`Set ${owner.name} as primary owner`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={owner.saved ? 'secondary' : 'outline'} className="text-xs">
                          {owner.saved ? 'Saved' : 'Draft'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOwner(owner.id)}
                          className={`${FOCUS_RING} px-0`}
                          aria-label={`Remove ${owner.name} from property`}
                        >
                          Remove
                        </Button>
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
                  <Body as="p" size="sm" className="text-destructive">
                    Ownership total is {total}%. It must equal 100% to continue.
                  </Body>
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
        <Heading as="h3" size="h4" className="mb-2">
          Management Services
        </Heading>
        <Body as="p" tone="muted" size="sm">
          Configure management scope, assignment level, and the property’s service plan.
        </Body>
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label
                as="label"
                htmlFor="add-property-management-scope"
                className="mb-1 block"
                size="sm"
              >
                Management Scope *
              </Label>
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
              <Label
                as="label"
                htmlFor="add-property-service-assignment"
                className="mb-1 block"
                size="sm"
              >
                Service Assignment *
              </Label>
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
            <Label as="p" size="sm">
              Unit Level assignments
            </Label>
            <Body as="p" tone="muted" size="sm" className="mt-1">
              This property is set to Unit Level service assignments. You’ll configure the service
              plan and services on each unit after the property is created.
            </Body>
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
        const res = await fetchWithSupabaseAuth('/api/gl-accounts/bank-accounts');
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
        <Heading as="h3" size="h4" className="mb-2">
          Bank Account
        </Heading>
        <Body as="p" tone="muted" size="sm">
          Select the operating bank account for this property
        </Body>
      </div>

      <div className="space-y-4">
        <div>
          <Label
            as="label"
            htmlFor="add-property-operating-account"
            className="mb-1 block"
            size="sm"
          >
            Operating Bank Account *
          </Label>
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
          <Label
            as="label"
            htmlFor="add-property-trust-account"
            className="mb-1 block"
            size="sm"
          >
            Deposit Trust Account
          </Label>
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
          <Label as="label" className="mb-1 block" size="sm">
            Reserve Amount
          </Label>
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
        const res = await fetchWithSupabaseAuth('/api/staff');
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

  const ownerNames = formData.owners.map((o) => o.name).filter(Boolean).join(', ');
  const primaryOwnerName = formData.owners.find((o) => o.primary)?.name;

  return (
    <div>
      <div className="mb-6 text-center">
        <CurrentIcon className="text-primary mx-auto mb-4 h-16 w-16" />
        <Heading as="h3" size="h4" className="mb-2">
          Property Manager
        </Heading>
        <Body as="p" tone="muted" size="sm">
          Assign a property manager
        </Body>
      </div>

      <div className="space-y-6">
        <div>
          <Label
            as="label"
            htmlFor="add-property-manager"
            className="mb-1 block"
            size="sm"
          >
            Property Manager
          </Label>
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
          <Heading as="h4" size="h6" className="mb-3">
            Property Summary
          </Heading>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Body as="span" size="sm" tone="muted">
                Property:
              </Body>
              <Label as="span" size="sm">
                {formData.name || 'Not specified'}
              </Label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Body as="span" size="sm" tone="muted">
                Type:
              </Body>
              {formData.propertyType ? (
                <Badge variant="outline">{formData.propertyType}</Badge>
              ) : (
                <Body as="span" size="sm" tone="muted">
                  Not selected
                </Body>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Body as="span" size="sm" tone="muted">
                Status:
              </Body>
              <Label as="span" size="sm">{formData.status || 'Active'}</Label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Body as="span" size="sm" tone="muted">
                Address:
              </Body>
              <Label as="span" size="sm">
                {formData.addressLine1 || 'Not specified'}
              </Label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Body as="span" size="sm" tone="muted">
                Country:
              </Body>
              <Label as="span" size="sm">
                {formData.country || 'Not specified'}
              </Label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Body as="span" size="sm" tone="muted">
                Year Built:
              </Body>
              <Label as="span" size="sm">
                {formData.yearBuilt || 'Not specified'}
              </Label>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Body as="span" size="sm" tone="muted">
                Owners:
              </Body>
              {formData.owners.length ? (
                <Label as="span" size="sm">{ownerNames}</Label>
              ) : (
                <Body as="span" size="sm" tone="muted">
                  None selected
                </Body>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Body as="span" size="sm" tone="muted">
                Primary Owner:
              </Body>
              {primaryOwnerName ? (
                <Label as="span" size="sm">
                  {primaryOwnerName}
                </Label>
              ) : (
                <Body as="span" size="sm" tone="muted">
                  None selected
                </Body>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Body as="span" size="sm" tone="muted">
                Bank Account:
              </Body>
              {formData.operatingBankAccountName || formData.operatingBankAccountId ? (
                <Label as="span" size="sm">
                  {formData.operatingBankAccountName || formData.operatingBankAccountId}
                </Label>
              ) : (
                <Body as="span" size="sm" tone="muted">
                  None selected
                </Body>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <Body as="span" size="sm" tone="muted">
                Deposit Trust:
              </Body>
              {formData.depositTrustAccountId ? (
                <Label as="span" size="sm">{formData.depositTrustAccountId}</Label>
              ) : (
                <Body as="span" size="sm" tone="muted">
                  None selected
                </Body>
              )}
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
        <Heading as="h3" size="h4" className="mb-2">
          Unit Details
        </Heading>
        <Body as="p" tone="muted" size="sm">
          Add details for each unit in this property
        </Body>
      </div>

      <div className="space-y-4">
        {formData.units.map((u, idx) => (
          <div key={idx} className="border-border bg-card rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <Label as="span" size="sm">
                Unit {idx + 1}
              </Label>
              {formData.units.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeUnit(idx)}
                  className={`${FOCUS_RING} px-0 text-destructive hover:text-destructive`}
                  aria-label={`Remove unit ${idx + 1}`}
                >
                  Remove
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4">
              {/* Unit Number */}
              <div>
                <Label as="label" size="sm" className="mb-1 block">
                  Unit Number *
                </Label>
                <input
                  value={u.unitNumber}
                  onChange={(e) => updateUnit(idx, { unitNumber: e.target.value })}
                  className={`border-border bg-background h-8 w-full rounded-md border px-3 text-sm ${FOCUS_RING}`}
                  placeholder="e.g., 101, A, 1"
                />
              </div>
              {/* Bedrooms */}
              <div>
                <Label as="label" size="sm" className="mb-1 block">
                  Bedrooms
                </Label>
                <div className="border-border divide-border flex divide-x overflow-hidden rounded-md border">
                  {BEDROOMS.map((b) => {
                    const selected = (u.unitBedrooms || '') === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => updateUnit(idx, { unitBedrooms: b })}
                        className={`flex-1 py-1.5 text-center ${selected ? 'bg-primary/10 text-primary' : 'bg-background hover:bg-muted text-foreground'} ${FOCUS_RING}`}
                        aria-label={`Select ${b} bedrooms for unit ${idx + 1}`}
                      >
                        <Body as="span" size="sm">
                          {b}
                        </Body>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Bathrooms */}
              <div>
                <Label as="label" size="sm" className="mb-1 block">
                  Bathrooms
                </Label>
                <div className="border-border divide-border flex divide-x overflow-hidden rounded-md border">
                  {BATHROOMS.map((b) => {
                    const selected = (u.unitBathrooms || '') === b;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => updateUnit(idx, { unitBathrooms: b })}
                        className={`flex-1 py-1.5 text-center ${selected ? 'bg-primary/10 text-primary' : 'bg-background hover:bg-muted text-foreground'} ${FOCUS_RING}`}
                        aria-label={`Select ${b} bathrooms for unit ${idx + 1}`}
                      >
                        <Body as="span" size="sm">
                          {b}
                        </Body>
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Description */}
              <div>
                <Label as="label" size="sm" className="mb-1 block">
                  Description
                </Label>
                <textarea
                  value={u.description || ''}
                  onChange={(e) => updateUnit(idx, { description: e.target.value || undefined })}
                  rows={2}
                  className={`border-border bg-background w-full rounded-md border px-3 py-1.5 text-sm leading-tight ${FOCUS_RING}`}
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

// Onboarding Mode: Step 3 - Owners & Signers
function Step3OwnersAndSigners({
  formData,
  setFormData,
  addOwner,
  removeOwner,
  updateOwnerPercentage,
  setPrimaryOwner,
  signers,
  onSignersChange,
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
  signers: Signer[];
  onSignersChange: (signers: Signer[]) => void;
}) {
  const CurrentIcon = Users;
  const defaultOwnerClientRowId =
    formData.owners.find((o) => o.primary)?.clientRowId || formData.owners[0]?.clientRowId;

  return (
    <div>
      <div className="mb-6 text-center">
        <CurrentIcon className="text-primary mx-auto mb-4 h-16 w-16" />
        <Heading as="h3" size="h4" className="mb-2">
          Owners & Signers
        </Heading>
        <Body as="p" tone="muted" size="sm">
          Add property owners and specify who will sign the agreement
        </Body>
      </div>

      <div className="space-y-6">
        {/* Reuse the existing ownership selection UI */}
        <Step3Ownership
          formData={formData}
          setFormData={setFormData}
          addOwner={addOwner}
          removeOwner={removeOwner}
          updateOwnerPercentage={updateOwnerPercentage}
          setPrimaryOwner={setPrimaryOwner}
        />

        {/* Add signer section */}
        <div className="border-border rounded-lg border p-4">
          <OwnerSignerSection
            signers={signers}
            onSignersChange={onSignersChange}
            defaultOwnerClientRowId={defaultOwnerClientRowId}
          />
        </div>
      </div>
    </div>
  );
}

// Onboarding Mode: Step 4 - Units (Bulk Creator)
function Step4OnboardingUnits({
  units,
  onUnitsChange,
  onSaveUnits,
  isSaving,
}: {
  units: UnitRow[];
  onUnitsChange: (units: UnitRow[]) => void;
  onSaveUnits: (units: UnitRow[]) => Promise<void>;
  isSaving: boolean;
}) {
  const CurrentIcon = Home;

  return (
    <div>
      <div className="mb-6 text-center">
        <CurrentIcon className="text-primary mx-auto mb-4 h-16 w-16" />
        <Heading as="h3" size="h4" className="mb-2">
          Units
        </Heading>
        <Body as="p" tone="muted" size="sm">
          Add units to your property. You can add more details later.
        </Body>
      </div>

      <BulkUnitCreator
        units={units}
        onUnitsChange={onUnitsChange}
        onSaveUnits={onSaveUnits}
        isSaving={isSaving}
      />
    </div>
  );
}

// Onboarding Mode: Step 5 - Review & Send Agreement
function Step5ReviewAndSend({
  formData,
  signers,
  units,
  selectedTemplateId,
  onTemplateChange,
  onEditStep,
  propertyId,
}: {
  formData: AddPropertyFormData;
  signers: Signer[];
  units: UnitRow[];
  selectedTemplateId?: string;
  onTemplateChange: (templateId: string, templateName: string) => void;
  onEditStep: (step: number) => void;
  propertyId?: string | null;
}) {
  const CurrentIcon = Send;

  const reviewProperty = {
    id: propertyId || 'temporary-property-id',
    name: formData.name || `${formData.addressLine1}, ${formData.city || formData.postalCode}`,
    addressLine1: formData.addressLine1,
    addressLine2: formData.addressLine2,
    city: formData.city || '',
    state: formData.state || '',
    postalCode: formData.postalCode,
    country: formData.country,
    propertyType: formData.propertyType,
  };

  const reviewOwners = formData.owners.map((owner, idx) => ({
    id: owner.id || `owner-${idx}`,
    name: owner.name,
    ownershipPercentage: owner.ownershipPercentage,
    primary: owner.primary,
  }));

  const reviewSigners = signers.map((signer) => ({
    email: signer.email,
    name: signer.name,
  }));

  const reviewUnits = units
    .filter((unit) => unit.unitNumber.trim())
    .map((unit, idx) => ({
      id: unit.clientRowId || `${unit.unitNumber || 'unit'}-${idx}`,
      unitNumber: unit.unitNumber,
      unitBedrooms: unit.unitBedrooms || null,
      unitBathrooms: unit.unitBathrooms || null,
    }));

  return (
    <div>
      <div className="mb-6 text-center">
        <CurrentIcon className="text-primary mx-auto mb-4 h-16 w-16" />
        <Heading as="h3" size="h4" className="mb-2">
          Review & Send Agreement
        </Heading>
        <Body as="p" tone="muted" size="sm">
          Review your property details and send the management agreement
        </Body>
      </div>

      <div className="space-y-6">
        <AgreementReviewPanel
          property={reviewProperty}
          owners={reviewOwners}
          signers={reviewSigners}
          units={reviewUnits}
          onEditStep={onEditStep}
        />

        <div className="border-border rounded-lg border p-4">
          <AgreementTemplateSelector
            onTemplateChange={onTemplateChange}
            selectedTemplateId={selectedTemplateId}
          />
        </div>

        <div className="border-border bg-muted/30 rounded-lg border p-4">
          <Heading as="h4" size="h6" className="mb-2">
            Recipients
          </Heading>
          <Body as="p" tone="muted" size="sm" className="mb-3">
            The agreement will be sent to the following signers:
          </Body>
          <div className="space-y-2">
            {signers.map((signer) => (
              <div key={signer.clientRowId} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <Body as="span" size="sm">
                  {signer.name} ({signer.email})
                </Body>
              </div>
            ))}
          </div>
        </div>

        {propertyId ? (
          <div className="border-border rounded-lg border p-4">
            <Heading as="h4" size="h6" className="mb-2">
              Buildium readiness
            </Heading>
            <Body as="p" tone="muted" size="sm" className="mb-3">
              Check required fields before syncing to Buildium (optional).
            </Body>
            <BuildiumReadinessChecklist propertyId={propertyId} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
