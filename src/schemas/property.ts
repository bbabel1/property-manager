import { z } from "zod";

export const PropertyCreateSchema = z.object({
  rentalSubType: z.enum([
    'CondoTownhome',
    'MultiFamily', 
    'SingleFamily',
    'Industrial',
    'Office',
    'Retail',
    'ShoppingCenter',
    'Storage',
    'ParkingSpace'
  ]),
  name: z.string().min(1, "Property name is required").max(127),
  addressLine1: z.string().min(1, "Address is required").max(100),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().min(1, "State is required").max(100),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(1, "Country is required"),
  yearBuilt: z.string().optional(),
  structureDescription: z.string().optional(),
  owners: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    ownershipPercentage: z.number().min(0).max(100),
    disbursementPercentage: z.number().min(0).max(100),
    primary: z.boolean()
  })).optional(),
  operatingBankAccountId: z.string().optional(),
  reserve: z.number().min(0).optional(),
  propertyManagerId: z.string().optional()
});

export const PropertyUpdateSchema = PropertyCreateSchema.partial();

export const PropertyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  status: z.enum(['Active', 'Inactive']).optional(),
  type: z.string().optional(),
  search: z.string().optional()
});

export type PropertyCreateInput = z.infer<typeof PropertyCreateSchema>;
export type PropertyUpdateInput = z.infer<typeof PropertyUpdateSchema>;
export type PropertyQueryInput = z.infer<typeof PropertyQuerySchema>;
