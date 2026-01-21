import { z } from 'zod';

// Onboarding status enum values
export const OnboardingStatusEnum = z.enum([
  'DRAFT',
  'OWNERS_ADDED',
  'UNITS_ADDED',
  'READY_TO_SEND',
  'AGREEMENT_SENT',
  'READY_FOR_BUILDIUM',
  'BUILDIUM_SYNCED',
  'BUILDIUM_SYNC_FAILED',
  // Legacy values from original enum
  'IN_PROGRESS',
  'PENDING_APPROVAL',
  'OVERDUE',
  'COMPLETED',
]);

export type OnboardingStatus = z.infer<typeof OnboardingStatusEnum>;

// POST /api/onboarding - Create property + onboarding stub
const OnboardingCreateNewSchema = z.object({
  propertyType: z.enum([
    'Condo',
    'Co-op',
    'Condop',
    'Rental Building',
    'Multi-Family',
    'Townhouse',
  ]),
  name: z.string().max(127).optional(),
  addressLine1: z.string().min(1, 'Address is required').max(100),
  addressLine2: z.string().max(100).optional().nullable(),
  addressLine3: z.string().max(100).optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  postalCode: z.string().min(1, 'Postal code is required').max(20),
  country: z.string().min(1, 'Country is required'),
  borough: z.string().max(100).optional().nullable(),
  neighborhood: z.string().max(100).optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  serviceAssignment: z.enum(['Property Level', 'Unit Level']).optional(),
  managementScope: z.enum(['Building', 'Unit']).optional(),
});

const OnboardingCreateExistingSchema = z.object({
  propertyId: z.string().uuid(),
});

export const OnboardingCreateSchema = z.union([
  OnboardingCreateNewSchema,
  OnboardingCreateExistingSchema,
]);

export type OnboardingCreateRequest = z.infer<typeof OnboardingCreateSchema>;

// PATCH /api/onboarding/:id - Autosave draft state
export const OnboardingUpdateSchema = z.object({
  currentStage: z.record(z.string(), z.unknown()).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  status: OnboardingStatusEnum.optional(),
});

export type OnboardingUpdateRequest = z.infer<typeof OnboardingUpdateSchema>;

// POST /api/onboarding/:id/owners - Upsert/delete owners
export const OnboardingOwnerSchema = z.object({
  clientRowId: z.string().uuid(),
  ownerId: z.string().uuid().optional(),
  ownerPayload: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      isCompany: z.boolean().optional(),
      companyName: z.string().optional(),
      primaryEmail: z.string().email().optional(),
      primaryPhone: z.string().optional(),
    })
    .optional(),
  ownershipPercentage: z.number().min(0).max(100),
  disbursementPercentage: z.number().min(0).max(100).optional(),
  primary: z.boolean().optional(),
  signerEmail: z.string().email().optional().nullable(),
  signerName: z.string().optional().nullable(),
  deleted: z.boolean().optional(),
});

export const OnboardingOwnersSchema = z.object({
  owners: z.array(OnboardingOwnerSchema),
});

export type OnboardingOwnerInput = z.infer<typeof OnboardingOwnerSchema>;
export type OnboardingOwnersRequest = z.infer<typeof OnboardingOwnersSchema>;

// POST /api/onboarding/:id/units - Upsert/delete units
export const OnboardingUnitSchema = z.object({
  clientRowId: z.string().uuid(),
  unitNumber: z.string().min(1, 'Unit number is required').max(30),
  unitBedrooms: z.string().max(20).optional().nullable(),
  unitBathrooms: z.string().max(20).optional().nullable(),
  unitSize: z.number().int().positive().optional().nullable(),
  description: z.string().optional().nullable(),
  deleted: z.boolean().optional(),
});

export const OnboardingUnitsSchema = z.object({
  units: z.array(OnboardingUnitSchema),
});

export type OnboardingUnitInput = z.infer<typeof OnboardingUnitSchema>;
export type OnboardingUnitsRequest = z.infer<typeof OnboardingUnitsSchema>;

// POST /api/agreements/send - Send agreement
export const AgreementRecipientSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.string().optional(),
});

export const AgreementSendSchema = z.object({
  onboardingId: z.string().uuid().optional(),
  propertyId: z.string().uuid(),
  recipients: z.array(AgreementRecipientSchema).min(1, 'At least one recipient is required'),
  templateId: z.string().uuid().optional(),
  templateName: z.string().optional(),
  webhookPayload: z.record(z.string(), z.unknown()).optional(),
});

export type AgreementRecipient = z.infer<typeof AgreementRecipientSchema>;
export type AgreementSendRequest = z.infer<typeof AgreementSendSchema>;

// Response types
export type OnboardingResponse = {
  id: string;
  propertyId: string;
  orgId: string;
  status: OnboardingStatus;
  progress: number;
  currentStage: Record<string, unknown>;
  normalizedAddressKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OnboardingCreateResponse = {
  property: {
    id: string;
    name: string;
    addressLine1: string;
    city: string | null;
    state: string | null;
    postalCode: string;
    country: string;
  };
  onboarding: OnboardingResponse;
};

export type AgreementSendResponse = {
  logId: string;
  status: 'sent' | 'failed';
  sentAt?: string;
  errorMessage?: string;
};

// Allowed status transitions (server-enforced)
export const ALLOWED_STATUS_TRANSITIONS: Record<OnboardingStatus, OnboardingStatus[]> = {
  DRAFT: ['OWNERS_ADDED', 'AGREEMENT_SENT'], // Fast path allowed
  OWNERS_ADDED: ['UNITS_ADDED', 'DRAFT'], // Can go back
  UNITS_ADDED: ['READY_TO_SEND', 'OWNERS_ADDED'], // Can go back
  READY_TO_SEND: ['AGREEMENT_SENT', 'UNITS_ADDED'], // Can go back
  AGREEMENT_SENT: ['READY_FOR_BUILDIUM'],
  READY_FOR_BUILDIUM: ['BUILDIUM_SYNCED', 'BUILDIUM_SYNC_FAILED'],
  BUILDIUM_SYNCED: [],
  BUILDIUM_SYNC_FAILED: ['READY_FOR_BUILDIUM'], // Retry
  // Legacy statuses
  IN_PROGRESS: ['COMPLETED', 'PENDING_APPROVAL', 'OVERDUE'],
  PENDING_APPROVAL: ['COMPLETED', 'IN_PROGRESS'],
  OVERDUE: ['IN_PROGRESS', 'COMPLETED'],
  COMPLETED: [],
};

export function isValidStatusTransition(
  currentStatus: OnboardingStatus,
  newStatus: OnboardingStatus,
): boolean {
  if (currentStatus === newStatus) return true; // No change is always valid
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? [];
  return allowed.includes(newStatus);
}
