import { z } from "zod";

// Bank account type enum
const BankAccountTypeEnum = z.enum([
  'CHECKING',
  'SAVINGS',
  'MONEY_MARKET',
  'BUSINESS_CHECKING',
  'BUSINESS_SAVINGS',
  'TRUST_ACCOUNT',
  'ESCROW_ACCOUNT'
]);

export const BankAccountCreateSchema = z.object({
  // Basic account information
  name: z.string().min(1, "Account name is required").max(255),
  accountNumber: z.string().min(1, "Account number is required").max(50),
  routingNumber: z.string().min(1, "Routing number is required").max(20),
  
  // Bank information
  bankName: z.string().min(1, "Bank name is required").max(255),
  bankAccountType: BankAccountTypeEnum,
  
  // Account details
  balance: z.number().min(0, "Balance cannot be negative").optional(),
  isActive: z.boolean().default(true),
  
  // Trust account specific fields
  isTrustAccount: z.boolean().default(false),
  trustAccountType: z.string().max(100).optional(),
  
  // Buildium integration
  buildiumAccountId: z.number().optional(),
  
  // Notes
  notes: z.string().max(1000).optional()
});

export const BankAccountUpdateSchema = BankAccountCreateSchema.partial();

export const BankAccountQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  bankAccountType: BankAccountTypeEnum.optional(),
  isActive: z.coerce.boolean().optional(),
  isTrustAccount: z.coerce.boolean().optional(),
  search: z.string().optional(),
  bankName: z.string().optional()
});

export const BankAccountWithTransactionsQuerySchema = z.object({
  includeTransactions: z.coerce.boolean().optional().default(false),
  includeProperties: z.coerce.boolean().optional().default(false),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional()
});

// Schema for account number validation (basic format check)
export const BankAccountNumberValidationSchema = z.object({
  accountNumber: z.string().regex(/^\d{4,17}$/, "Account number must be 4-17 digits"),
  routingNumber: z.string().regex(/^\d{9}$/, "Routing number must be exactly 9 digits")
});

// Schema for trust account creation
export const TrustAccountCreateSchema = BankAccountCreateSchema.extend({
  isTrustAccount: z.literal(true),
  trustAccountType: z.string().min(1, "Trust account type is required").max(100),
  propertyId: z.string().optional(), // Associated property if applicable
  ownerId: z.string().optional() // Associated owner if applicable
});

export type BankAccountCreateInput = z.infer<typeof BankAccountCreateSchema>;
export type BankAccountUpdateInput = z.infer<typeof BankAccountUpdateSchema>;
export type BankAccountQueryInput = z.infer<typeof BankAccountQuerySchema>;
export type BankAccountWithTransactionsQueryInput = z.infer<typeof BankAccountWithTransactionsQuerySchema>;
export type BankAccountNumberValidationInput = z.infer<typeof BankAccountNumberValidationSchema>;
export type TrustAccountCreateInput = z.infer<typeof TrustAccountCreateSchema>;

// Export enum for use in components
export { BankAccountTypeEnum };
