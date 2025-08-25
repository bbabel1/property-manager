import { z } from "zod";

export const OwnershipCreateSchema = z.object({
  // Required relationships
  propertyId: z.string().min(1, "Property is required"),
  ownerId: z.string().min(1, "Owner is required"),
  
  // Ownership details
  primary: z.boolean().default(false),
  ownershipPercentage: z.number().min(0, "Ownership percentage must be 0 or greater").max(100, "Ownership percentage cannot exceed 100%"),
  disbursementPercentage: z.number().min(0, "Disbursement percentage must be 0 or greater").max(100, "Disbursement percentage cannot exceed 100%"),
  
  // Computed fields (optional for creation, will be calculated)
  totalUnits: z.number().min(0).optional(),
  totalProperties: z.number().min(0).optional()
});

export const OwnershipUpdateSchema = OwnershipCreateSchema.partial();

export const OwnershipQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  propertyId: z.string().optional(),
  ownerId: z.string().optional(),
  primary: z.coerce.boolean().optional(),
  minOwnershipPercentage: z.coerce.number().min(0).optional(),
  maxOwnershipPercentage: z.coerce.number().max(100).optional()
});

export const OwnershipWithDetailsQuerySchema = z.object({
  includeProperty: z.coerce.boolean().optional().default(false),
  includeOwner: z.coerce.boolean().optional().default(false),
  includeUnits: z.coerce.boolean().optional().default(false)
});

// Schema for bulk ownership operations
export const BulkOwnershipCreateSchema = z.object({
  propertyId: z.string().min(1, "Property is required"),
  ownerships: z.array(OwnershipCreateSchema.omit({ propertyId: true })).min(1, "At least one ownership must be specified")
});

// Schema for ownership percentage validation
export const OwnershipPercentageValidationSchema = z.object({
  propertyId: z.string(),
  ownerships: z.array(z.object({
    id: z.string().optional(), // Optional for new ownerships
    ownershipPercentage: z.number().min(0).max(100)
  }))
}).refine((data) => {
  const totalPercentage = data.ownerships.reduce((sum, ownership) => sum + ownership.ownershipPercentage, 0);
  return totalPercentage <= 100;
}, {
  message: "Total ownership percentage cannot exceed 100%",
  path: ["ownerships"]
});

export type OwnershipCreateInput = z.infer<typeof OwnershipCreateSchema>;
export type OwnershipUpdateInput = z.infer<typeof OwnershipUpdateSchema>;
export type OwnershipQueryInput = z.infer<typeof OwnershipQuerySchema>;
export type OwnershipWithDetailsQueryInput = z.infer<typeof OwnershipWithDetailsQuerySchema>;
export type BulkOwnershipCreateInput = z.infer<typeof BulkOwnershipCreateSchema>;
export type OwnershipPercentageValidationInput = z.infer<typeof OwnershipPercentageValidationSchema>;
