import { z } from "zod";

export const OwnerCreateSchema = z.object({
  // Contact information
  firstName: z.string().min(1, "First name is required").max(127),
  lastName: z.string().min(1, "Last name is required").max(127),
  isCompany: z.boolean().default(false),
  companyName: z.string().max(255).optional(),
  primaryEmail: z.string().email("Valid email is required").max(255),
  primaryPhone: z.string().max(20).optional(),
  
  // Address information
  addressLine1: z.string().min(1, "Address is required").max(100),
  addressLine2: z.string().max(100).optional(),
  addressLine3: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(1, "Country is required").max(100),
  
  // Owner-specific fields
  managementAgreementStartDate: z.string().optional(),
  managementAgreementEndDate: z.string().optional(),
  comment: z.string().max(1000).optional(),
  
  // ETF (Electronic Transfer) information
  etfAccountType: z.string().max(50).optional(),
  etfAccountNumber: z.string().max(50).optional(),
  etfRoutingNumber: z.string().max(20).optional(),
  
  // Tax information
  taxPayerType: z.string().max(50).optional(),
  taxCountry: z.string().max(100).optional()
});

export const OwnerUpdateSchema = OwnerCreateSchema.partial();

export const OwnerQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  search: z.string().optional(),
  isCompany: z.coerce.boolean().optional(),
  hasProperties: z.coerce.boolean().optional()
});

export const OwnerWithPropertiesQuerySchema = z.object({
  includeProperties: z.coerce.boolean().optional().default(true),
  includeUnits: z.coerce.boolean().optional().default(false)
});

export type OwnerCreateInput = z.infer<typeof OwnerCreateSchema>;
export type OwnerUpdateInput = z.infer<typeof OwnerUpdateSchema>;
export type OwnerQueryInput = z.infer<typeof OwnerQuerySchema>;
export type OwnerWithPropertiesQueryInput = z.infer<typeof OwnerWithPropertiesQuerySchema>;
