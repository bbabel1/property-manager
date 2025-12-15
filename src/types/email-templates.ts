/**
 * Email Template Types
 *
 * TypeScript types and Zod schemas for email template management.
 */

import { z } from 'zod';
import type { EmailTemplateVariable } from '@/lib/email-templates/variable-definitions';

/**
 * Email template status enum
 */
export type EmailTemplateStatus = 'active' | 'inactive' | 'archived';

/**
 * Email template key enum (extensible)
 */
export type EmailTemplateKey = 'monthly_rental_statement';

/**
 * Email template database row type
 */
export interface EmailTemplate {
  id: string;
  org_id: string;
  template_key: string;
  name: string;
  description: string | null;
  subject_template: string;
  body_html_template: string;
  body_text_template: string | null;
  available_variables: EmailTemplateVariable[];
  status: EmailTemplateStatus;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
  updated_by_user_id: string;
}

/**
 * Email template insert type (for creating new templates)
 */
export interface EmailTemplateInsert {
  org_id: string;
  template_key: EmailTemplateKey;
  name: string;
  description?: string | null;
  subject_template: string;
  body_html_template: string;
  body_text_template?: string | null;
  available_variables: EmailTemplateVariable[];
  status?: EmailTemplateStatus;
}

/**
 * Email template update type (for updating existing templates)
 */
export interface EmailTemplateUpdate {
  name?: string;
  description?: string | null;
  subject_template?: string;
  body_html_template?: string;
  body_text_template?: string | null;
  available_variables?: EmailTemplateVariable[];
  status?: EmailTemplateStatus;
  updated_at?: string; // For optimistic concurrency
}

/**
 * Template render result
 */
export interface TemplateRenderResult {
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  warnings?: string[];
}

/**
 * Template render variables
 */
export type TemplateVariableValues = Record<string, string | number | null | undefined>;

/**
 * Zod schema for EmailTemplateStatus
 */
export const EmailTemplateStatusSchema = z.enum(['active', 'inactive', 'archived']);

/**
 * Zod schema for EmailTemplateKey
 */
export const EmailTemplateKeySchema = z.enum(['monthly_rental_statement']);

/**
 * Zod schema for EmailTemplateVariable
 */
export const EmailTemplateVariableSchema = z.object({
  key: z.string(),
  description: z.string(),
  source: z.string(),
  format: z.enum(['string', 'currency', 'date', 'url', 'number', 'percent']),
  required: z.boolean(),
  nullDefault: z.string(),
  example: z.string(),
});

/**
 * Zod schema for EmailTemplateInsert
 */
export const EmailTemplateInsertSchema = z.object({
  org_id: z.string().uuid(),
  template_key: EmailTemplateKeySchema,
  name: z.string().min(1).max(255),
  description: z.string().max(1000).nullable().optional(),
  subject_template: z.string().min(1).max(500),
  body_html_template: z.string().min(1).max(50000),
  body_text_template: z.string().max(50000).nullable().optional(),
  available_variables: z.array(EmailTemplateVariableSchema),
  status: EmailTemplateStatusSchema.optional().default('active'),
});

/**
 * Zod schema for EmailTemplateUpdate
 */
export const EmailTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  subject_template: z.string().min(1).max(500).optional(),
  body_html_template: z.string().min(1).max(50000).optional(),
  body_text_template: z.string().max(50000).nullable().optional(),
  available_variables: z.array(EmailTemplateVariableSchema).optional(),
  status: EmailTemplateStatusSchema.optional(),
  updated_at: z.string().optional(), // For optimistic concurrency
});

/**
 * Zod schema for TemplateRenderSchema (preview/test requests)
 */
export const TemplateRenderSchema = z.object({
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
});

/**
 * API Error codes
 */
export type EmailTemplateErrorCode =
  | 'TEMPLATE_NOT_FOUND'
  | 'INVALID_TEMPLATE_KEY'
  | 'INVALID_VARIABLES'
  | 'TEMPLATE_CONFLICT'
  | 'TEMPLATE_KEY_IMMUTABLE'
  | 'TEMPLATE_KEY_EXISTS'
  | 'RATE_LIMIT_EXCEEDED'
  | 'VALIDATION_ERROR'
  | 'INVALID_EMAIL'
  | 'GMAIL_NOT_CONNECTED';

/**
 * API Error response
 */
export interface EmailTemplateError {
  error: {
    code: EmailTemplateErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}
