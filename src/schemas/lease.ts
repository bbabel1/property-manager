import { z } from "zod";

// Lease status enum
const LeaseStatusEnum = z.enum([
  'DRAFT',
  'ACTIVE',
  'EXPIRED',
  'TERMINATED',
  'RENEWED',
  'PENDING_SIGNATURE'
]);

// Lease type enum
const LeaseTypeEnum = z.enum([
  'RESIDENTIAL',
  'COMMERCIAL',
  'SHORT_TERM',
  'LONG_TERM',
  'MONTH_TO_MONTH'
]);

// Rent cycle enum
const RentCycleEnum = z.enum([
  'MONTHLY',
  'WEEKLY',
  'BIWEEKLY',
  'QUARTERLY',
  'ANNUALLY'
]);

export const LeaseCreateSchema = z.object({
  // Basic lease information
  propertyId: z.string().min(1, "Property is required"),
  unitId: z.string().min(1, "Unit is required"),
  tenantId: z.string().min(1, "Tenant is required"),
  
  // Lease details
  leaseNumber: z.string().min(1, "Lease number is required").max(50),
  leaseType: LeaseTypeEnum,
  status: LeaseStatusEnum.default('DRAFT'),
  
  // Dates
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  signedDate: z.string().optional(),
  
  // Financial terms
  monthlyRent: z.number().min(0, "Monthly rent must be 0 or greater"),
  securityDeposit: z.number().min(0, "Security deposit must be 0 or greater").optional(),
  petDeposit: z.number().min(0).optional(),
  rentCycle: RentCycleEnum.default('MONTHLY'),
  
  // Buildium integration
  buildiumLeaseId: z.number().optional(),
  
  // Additional terms
  lateFeeAmount: z.number().min(0).optional(),
  lateFeePercentage: z.number().min(0).max(100).optional(),
  gracePeriodDays: z.number().min(0).max(30).optional(),
  
  // Notes and documents
  notes: z.string().max(2000).optional(),
  specialTerms: z.string().max(2000).optional()
});

export const LeaseUpdateSchema = LeaseCreateSchema.partial();

export const LeaseQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  propertyId: z.string().optional(),
  unitId: z.string().optional(),
  tenantId: z.string().optional(),
  status: LeaseStatusEnum.optional(),
  leaseType: LeaseTypeEnum.optional(),
  startDateFrom: z.string().optional(),
  startDateTo: z.string().optional(),
  endDateFrom: z.string().optional(),
  endDateTo: z.string().optional(),
  search: z.string().optional(),
  minRent: z.coerce.number().min(0).optional(),
  maxRent: z.coerce.number().min(0).optional()
});

export const LeaseWithDetailsQuerySchema = z.object({
  includeProperty: z.coerce.boolean().optional().default(false),
  includeUnit: z.coerce.boolean().optional().default(false),
  includeTenant: z.coerce.boolean().optional().default(false),
  includePayments: z.coerce.boolean().optional().default(false)
});

// Schema for lease renewal
export const LeaseRenewalSchema = z.object({
  originalLeaseId: z.string().min(1, "Original lease ID is required"),
  newStartDate: z.string().min(1, "New start date is required"),
  newEndDate: z.string().min(1, "New end date is required"),
  newMonthlyRent: z.number().min(0, "New monthly rent must be 0 or greater").optional(),
  newSecurityDeposit: z.number().min(0).optional(),
  notes: z.string().max(2000).optional()
});

// Schema for lease termination
export const LeaseTerminationSchema = z.object({
  leaseId: z.string().min(1, "Lease ID is required"),
  terminationDate: z.string().min(1, "Termination date is required"),
  reason: z.string().min(1, "Termination reason is required").max(500),
  notes: z.string().max(2000).optional()
});

// Schema for lease signature
export const LeaseSignatureSchema = z.object({
  leaseId: z.string().min(1, "Lease ID is required"),
  signedDate: z.string().min(1, "Signed date is required"),
  signedBy: z.string().min(1, "Signer name is required").max(255),
  signatureMethod: z.enum(['DIGITAL', 'PHYSICAL', 'ELECTRONIC']).optional()
});

export type LeaseCreateInput = z.infer<typeof LeaseCreateSchema>;
export type LeaseUpdateInput = z.infer<typeof LeaseUpdateSchema>;
export type LeaseQueryInput = z.infer<typeof LeaseQuerySchema>;
export type LeaseWithDetailsQueryInput = z.infer<typeof LeaseWithDetailsQuerySchema>;
export type LeaseRenewalInput = z.infer<typeof LeaseRenewalSchema>;
export type LeaseTerminationInput = z.infer<typeof LeaseTerminationSchema>;
export type LeaseSignatureInput = z.infer<typeof LeaseSignatureSchema>;

// Export enums for use in components
export { LeaseStatusEnum, LeaseTypeEnum, RentCycleEnum };
