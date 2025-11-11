import { z } from "zod";

// Enums for unit properties (matching database enum names)
const BedroomEnum = z.enum(['Studio', '1', '2', '3', '4', '5', '6', '7', '8', '9+']);
const BathroomEnum = z.enum(['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5+']);
const ServicePlanEnum = z.enum(['Full', 'Basic', 'A-la-carte']);
const FeeFrequencyEnum = z.enum(['Monthly', 'Annually']);
const FeeTypeEnum = z.enum(['Percentage', 'Flat Rate']);
const UnitStatusEnum = z.enum(['Available', 'Occupied', 'Maintenance', 'Reserved']);

export const UnitCreateSchema = z.object({
  // Basic unit information
  propertyId: z.string().min(1, "Property is required"),
  unitNumber: z.string().min(1, "Unit number is required").max(50),
  unitSize: z.number().min(0).optional(),
  marketRent: z.number().min(0).optional(),
  
  // Address information
  addressLine1: z.string().min(1, "Address is required").max(100),
  addressLine2: z.string().max(100).optional(),
  addressLine3: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(1, "Country is required").max(100),
  
  // Unit characteristics
  unitBedrooms: BedroomEnum.optional(),
  unitBathrooms: BathroomEnum.optional(),
  description: z.string().max(1000).optional(),
  
  // Buildium integration
  buildiumUnitId: z.number().optional(),
  buildiumPropertyId: z.number().optional(),
  
  // Service management
  serviceStart: z.string().optional(),
  serviceEnd: z.string().optional(),
  servicePlan: ServicePlanEnum.optional(),
  
  // Fee management
  feeType: FeeTypeEnum.optional(),
  feePercent: z.number().min(0).max(100).optional(),
  feeDollarAmount: z.number().min(0).optional(),
  feeFrequency: FeeFrequencyEnum.optional(),
  activeServices: z.string().max(500).optional(),
  feeNotes: z.string().max(1000).optional(),
  
  // Status
  status: UnitStatusEnum.optional().default('Available')
});

export const UnitUpdateSchema = UnitCreateSchema.partial();

export const UnitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  propertyId: z.string().optional(),
  status: UnitStatusEnum.optional(),
  unitNumber: z.string().optional(),
  search: z.string().optional(),
  minRent: z.coerce.number().min(0).optional(),
  maxRent: z.coerce.number().min(0).optional(),
  bedrooms: BedroomEnum.optional(),
  bathrooms: BathroomEnum.optional()
});

export const UnitWithDetailsQuerySchema = z.object({
  includeProperty: z.coerce.boolean().optional().default(false),
  includeLease: z.coerce.boolean().optional().default(false),
  includeTenant: z.coerce.boolean().optional().default(false)
});

export type UnitCreateInput = z.infer<typeof UnitCreateSchema>;
export type UnitUpdateInput = z.infer<typeof UnitUpdateSchema>;
export type UnitQueryInput = z.infer<typeof UnitQuerySchema>;
export type UnitWithDetailsQueryInput = z.infer<typeof UnitWithDetailsQuerySchema>;

// Export enums for use in components
export { BedroomEnum, BathroomEnum, ServicePlanEnum, FeeFrequencyEnum, FeeTypeEnum, UnitStatusEnum };
