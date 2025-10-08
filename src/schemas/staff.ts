import { z } from "zod";

// Staff role enum
const StaffRoleEnum = z.enum(['Property Manager', 'Bookkeeper']);

export const StaffCreateSchema = z.object({
  // Basic information
  firstName: z.string().min(1, "First name is required").max(127),
  lastName: z.string().min(1, "Last name is required").max(127),
  email: z.string().email("Valid email is required").max(255).optional(),
  phone: z.string().max(20).optional(),
  
  // Role and status
  role: StaffRoleEnum,
  isActive: z.boolean().default(true),
  
  // Buildium integration
  buildiumUserId: z.number().optional()
});

export const StaffUpdateSchema = StaffCreateSchema.partial();

export const StaffQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  role: StaffRoleEnum.optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
  hasProperties: z.coerce.boolean().optional()
});

export const StaffWithPropertiesQuerySchema = z.object({
  includeProperties: z.coerce.boolean().optional().default(false),
  includeUnits: z.coerce.boolean().optional().default(false)
});

export type StaffCreateInput = z.infer<typeof StaffCreateSchema>;
export type StaffUpdateInput = z.infer<typeof StaffUpdateSchema>;
export type StaffQueryInput = z.infer<typeof StaffQuerySchema>;
export type StaffWithPropertiesQueryInput = z.infer<typeof StaffWithPropertiesQuerySchema>;

// Export enum for use in components
export { StaffRoleEnum };
