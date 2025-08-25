import { z } from "zod";

// Tenant status enum
const TenantStatusEnum = z.enum([
  'ACTIVE',
  'INACTIVE',
  'PROSPECTIVE',
  'FORMER',
  'BLACKLISTED'
]);

// Tenant type enum
const TenantTypeEnum = z.enum([
  'INDIVIDUAL',
  'CORPORATE',
  'GOVERNMENT',
  'NON_PROFIT'
]);

export const TenantCreateSchema = z.object({
  // Basic information
  firstName: z.string().min(1, "First name is required").max(127),
  lastName: z.string().min(1, "Last name is required").max(127),
  isCompany: z.boolean().default(false),
  companyName: z.string().max(255).optional(),
  
  // Contact information
  primaryEmail: z.string().email("Valid email is required").max(255),
  primaryPhone: z.string().max(20).optional(),
  secondaryPhone: z.string().max(20).optional(),
  
  // Address information
  addressLine1: z.string().min(1, "Address is required").max(100),
  addressLine2: z.string().max(100).optional(),
  addressLine3: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(1, "Country is required").max(100),
  
  // Tenant details
  tenantType: TenantTypeEnum.default('INDIVIDUAL'),
  status: TenantStatusEnum.default('PROSPECTIVE'),
  
  // Employment information
  employerName: z.string().max(255).optional(),
  employerPhone: z.string().max(20).optional(),
  monthlyIncome: z.number().min(0).optional(),
  
  // Emergency contact
  emergencyContactName: z.string().max(255).optional(),
  emergencyContactPhone: z.string().max(20).optional(),
  emergencyContactRelationship: z.string().max(100).optional(),
  
  // Additional information
  dateOfBirth: z.string().optional(),
  ssn: z.string().max(20).optional(), // Social Security Number
  driverLicenseNumber: z.string().max(50).optional(),
  driverLicenseState: z.string().max(10).optional(),
  
  // Notes and preferences
  notes: z.string().max(2000).optional(),
  preferences: z.string().max(1000).optional(),
  
  // Buildium integration
  buildiumTenantId: z.number().optional()
});

export const TenantUpdateSchema = TenantCreateSchema.partial();

export const TenantQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: TenantStatusEnum.optional(),
  tenantType: TenantTypeEnum.optional(),
  isCompany: z.coerce.boolean().optional(),
  search: z.string().optional(),
  hasActiveLease: z.coerce.boolean().optional(),
  propertyId: z.string().optional(),
  unitId: z.string().optional()
});

export const TenantWithDetailsQuerySchema = z.object({
  includeLeases: z.coerce.boolean().optional().default(false),
  includePayments: z.coerce.boolean().optional().default(false),
  includeMaintenance: z.coerce.boolean().optional().default(false),
  includeDocuments: z.coerce.boolean().optional().default(false)
});

// Schema for tenant screening
export const TenantScreeningSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required"),
  screeningType: z.enum(['CREDIT_CHECK', 'BACKGROUND_CHECK', 'RENTAL_HISTORY', 'EMPLOYMENT_VERIFICATION']),
  screeningDate: z.string().min(1, "Screening date is required"),
  screeningResult: z.enum(['PASS', 'FAIL', 'PENDING', 'INCONCLUSIVE']),
  screeningScore: z.number().min(300).max(850).optional(), // Credit score range
  notes: z.string().max(2000).optional(),
  screeningReportUrl: z.string().url().optional()
});

// Schema for tenant application
export const TenantApplicationSchema = z.object({
  tenantId: z.string().min(1, "Tenant ID is required"),
  propertyId: z.string().min(1, "Property ID is required"),
  unitId: z.string().min(1, "Unit ID is required"),
  applicationDate: z.string().min(1, "Application date is required"),
  desiredMoveInDate: z.string().min(1, "Desired move-in date is required"),
  monthlyIncome: z.number().min(0, "Monthly income must be 0 or greater"),
  applicationFee: z.number().min(0).optional(),
  applicationStatus: z.enum(['PENDING', 'APPROVED', 'DENIED', 'WITHDRAWN']).default('PENDING'),
  notes: z.string().max(2000).optional()
});

export type TenantCreateInput = z.infer<typeof TenantCreateSchema>;
export type TenantUpdateInput = z.infer<typeof TenantUpdateSchema>;
export type TenantQueryInput = z.infer<typeof TenantQuerySchema>;
export type TenantWithDetailsQueryInput = z.infer<typeof TenantWithDetailsQuerySchema>;
export type TenantScreeningInput = z.infer<typeof TenantScreeningSchema>;
export type TenantApplicationInput = z.infer<typeof TenantApplicationSchema>;

// Export enums for use in components
export { TenantStatusEnum, TenantTypeEnum };
