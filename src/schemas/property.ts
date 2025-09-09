import { z } from "zod";

export const PropertyCreateSchema = z.object({
  propertyType: z.enum([
    'Condo',
    'Co-op',
    'Condop',
    'Mult-Family',
    'Townhouse'
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
  propertyManagerId: z.string().optional(),
  // Management/Service/Fee fields
  management_scope: z.enum(['Building','Unit']).optional(),
  service_assignment: z.enum(['Property Level','Unit Level']).optional(),
  service_plan: z.enum(['Full','Basic','A-la-carte']).optional(),
  active_services: z.array(z.enum([
    'Rent Collection',
    'Maintenance',
    'Turnovers',
    'Compliance',
    'Bill Pay',
    'Condition Reports',
    'Renewals'
  ])).optional(),
  fee_assignment: z.enum(['Building','Unit']).optional(),
  fee_type: z.enum(['Percentage','Flat Rate']).optional(),
  fee_percentage: z.number().min(0).max(100).optional(),
  management_fee: z.number().min(0).optional(),
  billing_frequency: z.enum(['Annual','Monthly']).optional()
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
