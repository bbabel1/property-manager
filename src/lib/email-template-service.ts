/**
 * Email Template Service
 *
 * Core service for managing email templates with CRUD operations,
 * variable substitution, validation, and rendering.
 */

import { supabaseAdmin, type TypedSupabaseClient } from '@/lib/db';
import type {
  EmailTemplate,
  EmailTemplateInsert,
  EmailTemplateUpdate,
  EmailTemplateKey,
  EmailTemplateStatus,
  TemplateRenderResult,
  TemplateVariableValues,
} from '@/types/email-templates';
import {
  getAvailableVariables,
  validateTemplateVariables,
} from '@/lib/email-templates/variable-definitions';
import { formatTemplateVariable } from '@/lib/email-templates/formatting';
import {
  sanitizeEmailTemplateHtml,
  stripHtmlTags,
  escapeHtml,
} from '@/lib/email-templates/sanitization';
import type { Json } from '@/types/database';

/**
 * Get an active email template by org and template key
 *
 * @param orgId - Organization ID
 * @param templateKey - Template key
 * @param db - Supabase client (defaults to admin)
 * @returns Email template or null if not found
 */
export async function getEmailTemplate(
  orgId: string,
  templateKey: EmailTemplateKey,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<EmailTemplate | null> {
  const { data, error } = await db
    .from('email_templates')
    .select('*')
    .eq('org_id', orgId)
    .eq('template_key', templateKey)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error('Error fetching email template:', error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Parse available_variables JSONB
  const availableVariables = Array.isArray(data.available_variables)
    ? data.available_variables
    : JSON.parse(JSON.stringify(data.available_variables || []));

  return {
    ...data,
    available_variables: availableVariables,
  } as EmailTemplate;
}

/**
 * Get all email templates for an organization
 *
 * @param orgId - Organization ID
 * @param filters - Optional filters
 * @param db - Supabase client (defaults to admin)
 * @returns Array of email templates
 */
export async function getAllEmailTemplates(
  orgId: string,
  filters?: { status?: EmailTemplateStatus },
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<EmailTemplate[]> {
  let query = db.from('email_templates').select('*').eq('org_id', orgId);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching email templates:', error);
    return [];
  }

  return (data || []).map((template) => {
    const availableVariables = Array.isArray(template.available_variables)
      ? template.available_variables
      : JSON.parse(JSON.stringify(template.available_variables || []));

    return {
      ...template,
      available_variables: availableVariables,
    } as EmailTemplate;
  });
}

/**
 * Create a new email template
 *
 * @param orgId - Organization ID
 * @param template - Template data
 * @param userId - User ID creating the template
 * @param db - Supabase client (defaults to admin)
 * @returns Created template or null if error
 */
export async function createEmailTemplate(
  orgId: string,
  template: EmailTemplateInsert,
  userId: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<EmailTemplate | null> {
  // Validate variables in templates
  const availableVariables = getAvailableVariables(template.template_key);
  const subjectValidation = validateTemplateVariables(
    template.subject_template,
    availableVariables,
  );
  const htmlValidation = validateTemplateVariables(template.body_html_template, availableVariables);

  if (!subjectValidation.valid || !htmlValidation.valid) {
    const invalidVars = [...subjectValidation.invalidVariables, ...htmlValidation.invalidVariables];
    throw new Error(`Invalid variables in template: ${invalidVars.join(', ')}`);
  }

  // Sanitize HTML body
  const sanitizedHtml = await sanitizeEmailTemplateHtml(template.body_html_template);

  const { data, error } = await db
    .from('email_templates')
    .insert({
      org_id: orgId,
      template_key: template.template_key,
      name: template.name,
      description: template.description || null,
      subject_template: template.subject_template,
      body_html_template: sanitizedHtml,
      body_text_template: template.body_text_template || null,
      available_variables: template.available_variables as unknown as Json,
      status: template.status || 'active',
      created_by_user_id: userId,
      updated_by_user_id: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating email template:', error);
    return null;
  }

  const availableVariablesParsed = Array.isArray(data.available_variables)
    ? data.available_variables
    : JSON.parse(JSON.stringify(data.available_variables || []));

  return {
    ...data,
    available_variables: availableVariablesParsed,
  } as EmailTemplate;
}

/**
 * Update an email template with optimistic concurrency
 *
 * @param orgId - Organization ID
 * @param templateId - Template ID
 * @param updates - Update data
 * @param userId - User ID updating the template
 * @param expectedUpdatedAt - Expected updated_at timestamp for optimistic concurrency
 * @param db - Supabase client (defaults to admin)
 * @returns Updated template or null if error/conflict
 */
export async function updateEmailTemplate(
  orgId: string,
  templateId: string,
  updates: EmailTemplateUpdate,
  userId: string,
  expectedUpdatedAt?: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<EmailTemplate | null> {
  // Fetch current template to get template_key for validation
  const currentTemplate = await db
    .from('email_templates')
    .select('template_key, available_variables')
    .eq('id', templateId)
    .eq('org_id', orgId)
    .single();

  if (!currentTemplate.data) {
    throw new Error('Template not found');
  }

  // Validate variables if templates are being updated
  if (updates.subject_template || updates.body_html_template) {
    const templateKey = currentTemplate.data.template_key as EmailTemplateKey;
    const availableVariables = getAvailableVariables(templateKey);
    const parsedAvailableVars = Array.isArray(currentTemplate.data.available_variables)
      ? currentTemplate.data.available_variables
      : JSON.parse(JSON.stringify(currentTemplate.data.available_variables || []));

    const varsToUse = updates.available_variables || parsedAvailableVars;

    if (updates.subject_template) {
      const validation = validateTemplateVariables(updates.subject_template, varsToUse);
      if (!validation.valid) {
        throw new Error(`Invalid variables in subject: ${validation.invalidVariables.join(', ')}`);
      }
    }

  if (updates.body_html_template) {
    const validation = validateTemplateVariables(updates.body_html_template, varsToUse);
    if (!validation.valid) {
      throw new Error(
        `Invalid variables in HTML body: ${validation.invalidVariables.join(', ')}`,
        );
      }
    }
  }

  // Sanitize HTML if updating
  let sanitizedHtml = updates.body_html_template;
  if (sanitizedHtml) {
    sanitizedHtml = await sanitizeEmailTemplateHtml(sanitizedHtml);
  }

  // Build update object
  const updateData: any = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.subject_template !== undefined)
    updateData.subject_template = updates.subject_template;
  if (sanitizedHtml !== undefined) updateData.body_html_template = sanitizedHtml;
  if (updates.body_text_template !== undefined)
    updateData.body_text_template = updates.body_text_template;
  if (updates.available_variables !== undefined)
    updateData.available_variables = updates.available_variables;
  if (updates.status !== undefined) updateData.status = updates.status;
  updateData.updated_by_user_id = userId;

  // Optimistic concurrency check
  if (expectedUpdatedAt) {
    const { data: current } = await db
      .from('email_templates')
      .select('updated_at')
      .eq('id', templateId)
      .single();

    if (current?.updated_at !== expectedUpdatedAt) {
      throw new Error('TEMPLATE_CONFLICT');
    }
  }

  const { data, error } = await db
    .from('email_templates')
    .update(updateData)
    .eq('id', templateId)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) {
    console.error('Error updating email template:', error);
    return null;
  }

  const availableVariablesParsed = Array.isArray(data.available_variables)
    ? data.available_variables
    : JSON.parse(JSON.stringify(data.available_variables || []));

  return {
    ...data,
    available_variables: availableVariablesParsed,
  } as EmailTemplate;
}

/**
 * Archive an email template (soft delete)
 *
 * @param orgId - Organization ID
 * @param templateId - Template ID
 * @param userId - User ID archiving the template
 * @param db - Supabase client (defaults to admin)
 * @returns Success status
 */
export async function archiveEmailTemplate(
  orgId: string,
  templateId: string,
  userId: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<boolean> {
  const { error } = await db
    .from('email_templates')
    .update({ status: 'archived', updated_by_user_id: userId })
    .eq('id', templateId)
    .eq('org_id', orgId);

  if (error) {
    console.error('Error archiving email template:', error);
    return false;
  }

  return true;
}

/**
 * Duplicate an email template
 *
 * @param orgId - Organization ID
 * @param templateId - Template ID to duplicate
 * @param newKey - New template key (must be unique)
 * @param userId - User ID duplicating the template
 * @param db - Supabase client (defaults to admin)
 * @returns Duplicated template or null if error
 */
export async function duplicateEmailTemplate(
  orgId: string,
  templateId: string,
  newKey: string,
  userId: string,
  db: TypedSupabaseClient = supabaseAdmin,
): Promise<EmailTemplate | null> {
  // Fetch original template
  const { data: original, error: fetchError } = await db
    .from('email_templates')
    .select('*')
    .eq('id', templateId)
    .eq('org_id', orgId)
    .single();

  if (fetchError || !original) {
    console.error('Error fetching template to duplicate:', fetchError);
    return null;
  }

  // Check if new key already exists
  const { data: existing } = await db
    .from('email_templates')
    .select('id')
    .eq('org_id', orgId)
    .eq('template_key', newKey)
    .maybeSingle();

  if (existing) {
    throw new Error('Template key already exists');
  }

  // Create duplicate with new key and inactive status
  const { data, error } = await db
    .from('email_templates')
    .insert({
      org_id: orgId,
      template_key: newKey,
      name: `${original.name} (Copy)`,
      description: original.description,
      subject_template: original.subject_template,
      body_html_template: original.body_html_template,
      body_text_template: original.body_text_template,
      available_variables: original.available_variables,
      status: 'inactive', // Prevent immediate use
      created_by_user_id: userId,
      updated_by_user_id: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error duplicating email template:', error);
    return null;
  }

  const availableVariablesParsed = Array.isArray(data.available_variables)
    ? data.available_variables
    : JSON.parse(JSON.stringify(data.available_variables || []));

  return {
    ...data,
    available_variables: availableVariablesParsed,
  } as EmailTemplate;
}

/**
 * Render an email template with variable substitution
 *
 * @param template - Email template
 * @param variables - Variable values
 * @returns Rendered template result
 */
export async function renderEmailTemplate(
  template: EmailTemplate,
  variables: TemplateVariableValues,
): Promise<TemplateRenderResult> {
  const warnings: string[] = [];
  const availableVariables = template.available_variables;

  // Build variable map with formatting
  const variableMap: Record<string, string> = {};

  for (const varDef of availableVariables) {
    const value = variables[varDef.key];

    if (value === null || value === undefined) {
      if (varDef.required) {
        warnings.push(`Missing required variable: ${varDef.key}`);
        variableMap[varDef.key] = varDef.nullDefault;
      } else {
        variableMap[varDef.key] = varDef.nullDefault;
      }
    } else {
      // Format the value according to its type
      variableMap[varDef.key] = formatTemplateVariable(value, varDef.format, varDef.nullDefault);
    }
  }

  // Replace variables in subject (no HTML escaping needed)
  let subject = template.subject_template;
  for (const [key, value] of Object.entries(variableMap)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    subject = subject.replace(regex, value);
  }

  // Replace variables in HTML body (no escaping - variables inserted as raw HTML)
  let bodyHtml = template.body_html_template;
  for (const [key, value] of Object.entries(variableMap)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    bodyHtml = bodyHtml.replace(regex, value);
  }

  // Sanitize HTML after variable substitution to prevent XSS
  bodyHtml = await sanitizeEmailTemplateHtml(bodyHtml);

  // Replace variables in text body (escape HTML, strip tags)
  let bodyText = template.body_text_template || '';
  if (bodyText) {
    for (const [key, value] of Object.entries(variableMap)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      // Escape HTML in text body
      const escapedValue = escapeHtml(value);
      bodyText = bodyText.replace(regex, escapedValue);
    }
    // Strip any remaining HTML tags
    bodyText = stripHtmlTags(bodyText);
  } else {
    // Generate text version from HTML if not provided
    bodyText = stripHtmlTags(bodyHtml);
  }

  return {
    subject,
    bodyHtml,
    bodyText: bodyText || null,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate template variables against available variables
 *
 * @param template - Template string with {{variable}} placeholders
 * @param availableVariables - Available variable definitions
 * @returns Validation result
 */
export function validateTemplateVariablesUsage(
  template: string,
  availableVariables: typeof getAvailableVariables extends (key: EmailTemplateKey) => infer R
    ? R
    : never,
): { valid: boolean; invalidVariables: string[] } {
  return validateTemplateVariables(template, availableVariables);
}
