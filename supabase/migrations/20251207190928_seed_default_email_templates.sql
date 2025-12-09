-- Migration: Seed default email templates for existing organizations
-- Purpose: Backfill default Monthly Rental Statement template for all existing organizations
-- Rollback: DELETE FROM email_templates WHERE template_key = 'monthly_rental_statement' AND created_at >= '2025-12-07 19:09:28+00';

-- Temporarily disable triggers to allow explicit user_id setting during migration
ALTER TABLE public.email_templates DISABLE TRIGGER trg_email_templates_created_by;
ALTER TABLE public.email_templates DISABLE TRIGGER trg_email_templates_updated_by;

-- Default subject template
-- Note: Variables will be replaced at render time: {{recipientName}}, {{propertyName}}, {{periodMonth}}
DO $$
DECLARE
  org_record RECORD;
  admin_user_id UUID;
  default_subject TEXT := 'Monthly Statement - {{propertyName}} ({{periodMonth}})';
  default_html_body TEXT := '<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Monthly Statement - {{periodMonth}}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.6;
      color: #1f3d56;
      max-width: 600px;
      margin: 0 auto;
      padding: 24px;
      background-color: #f5f7fa;
    }
    .container {
      background: #ffffff;
      border-radius: 8px;
      padding: 32px;
      box-shadow: 0 6px 12px -4px rgb(31 61 86 / 0.08), 0 2px 6px -2px rgb(31 61 86 / 0.05);
    }
    .header {
      border-bottom: 3px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      color: #2563eb;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .header p {
      margin: 8px 0 0 0;
      color: #64748b;
      font-size: 14px;
    }
    .summary {
      background: #eff6ff;
      border: 2px solid #3b82f6;
      border-radius: 8px;
      padding: 24px;
      margin: 24px 0;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #bfdbfe;
    }
    .summary-row:last-child {
      border-bottom: none;
      margin-top: 12px;
      padding-top: 16px;
      border-top: 2px solid #3b82f6;
      font-weight: bold;
    }
    .summary-label {
      color: #1e40af;
    }
    .summary-value {
      color: #1f3d56;
      font-weight: 600;
    }
    .summary-value.highlight {
      color: #2563eb;
      font-size: 18px;
    }
    .button {
      display: inline-block;
      background: #3b82f6;
      color: #ffffff;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 16px 0;
    }
    .button:hover {
      background: #2563eb;
    }
    .property-info {
      background: #f5f7fa;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 16px;
      margin: 16px 0;
    }
    .property-info p {
      margin: 4px 0;
      font-size: 14px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid #cbd5e1;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Monthly Statement Ready</h1>
      <p>Statement for {{periodMonth}}</p>
    </div>

    <p>Dear {{recipientName}},</p>

    <p>Your monthly statement for <strong>{{periodMonth}}</strong> is now available. Please find the attached PDF or download it using the link below.</p>

    <div class="property-info">
      <p><strong>Property:</strong> {{propertyName}}</p>
      <p><strong>Unit:</strong> {{unitNumber}}</p>
      <p><strong>Period:</strong> {{periodMonth}}</p>
    </div>

    <div class="summary">
      <div class="summary-row">
        <span class="summary-label">Net to Owner</span>
        <span class="summary-value">{{netToOwner}}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Owner Draw (Available for Distribution)</span>
        <span class="summary-value highlight">{{ownerDraw}}</span>
      </div>
    </div>

    <div style="text-align: center;">
      <a href="{{pdfUrl}}" class="button">Download Statement PDF</a>
    </div>

    <p style="margin-top: 24px;">If you have any questions about this statement, please don''t hesitate to contact us.</p>

    <p>Thank you,<br>
    <strong>{{companyName}}</strong></p>

    <div class="footer">
      <p>This is an automated message. Please do not reply directly to this email.</p>
      <p>© {{currentDate}} {{companyName}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>';
  default_text_body TEXT := 'Monthly Statement Ready - {{periodMonth}}

Dear {{recipientName}},

Your monthly statement for {{periodMonth}} is now available.

Property: {{propertyName}}
Unit: {{unitNumber}}
Period: {{periodMonth}}

Financial Summary:
- Net to Owner: {{netToOwner}}
- Owner Draw (Available for Distribution): {{ownerDraw}}

Download your statement: {{pdfUrl}}

If you have any questions about this statement, please don''t hesitate to contact us.

Thank you,
{{companyName}}

---
This is an automated message. Please do not reply directly to this email.
© {{currentDate}} {{companyName}}. All rights reserved.';
  default_variables JSONB := '[
    {"key": "recipientName", "description": "Primary owner name or recipient name", "source": "contacts.first_name + contacts.last_name", "format": "string", "required": true, "nullDefault": "", "example": "John Doe"},
    {"key": "propertyName", "description": "Property name", "source": "properties.name", "format": "string", "required": true, "nullDefault": "", "example": "123 Main St"},
    {"key": "unitNumber", "description": "Unit number or name", "source": "units.unit_number or units.unit_name", "format": "string", "required": false, "nullDefault": "N/A", "example": "Unit 1"},
    {"key": "periodMonth", "description": "Statement period formatted as Month Year", "source": "format(monthly_logs.period_start, \"MMMM yyyy\")", "format": "date", "required": true, "nullDefault": "", "example": "December 2024"},
    {"key": "netToOwner", "description": "Net amount to owner (formatted currency)", "source": "calculateNetToOwnerValue(...)", "format": "currency", "required": true, "nullDefault": "$0.00", "example": "$1,234.56"},
    {"key": "ownerDraw", "description": "Owner draw amount available for distribution (formatted currency)", "source": "getOwnerDrawSummary(...)", "format": "currency", "required": true, "nullDefault": "$0.00", "example": "$1,234.56"},
    {"key": "pdfUrl", "description": "URL to download the statement PDF", "source": "monthly_logs.pdf_url", "format": "url", "required": true, "nullDefault": "", "example": "https://example.com/statements/123.pdf"},
    {"key": "companyName", "description": "Organization/company name", "source": "organizations.name", "format": "string", "required": true, "nullDefault": "Property Management Company", "example": "Acme Property Management"},
    {"key": "currentDate", "description": "Current year", "source": "new Date().getFullYear()", "format": "string", "required": false, "nullDefault": "2024", "example": "2024"}
  ]'::jsonb;
BEGIN
  -- Loop through all organizations
  FOR org_record IN SELECT id FROM public.organizations LOOP
    -- Find first org_admin or org_manager for this org (for created_by/updated_by)
    SELECT user_id INTO admin_user_id
    FROM public.org_memberships
    WHERE org_id = org_record.id
      AND role IN ('org_admin', 'org_manager', 'platform_admin')
    ORDER BY created_at ASC
    LIMIT 1;

    -- If no admin found, try any member
    IF admin_user_id IS NULL THEN
      SELECT user_id INTO admin_user_id
      FROM public.org_memberships
      WHERE org_id = org_record.id
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    -- Skip if template already exists for this org
    IF EXISTS (
      SELECT 1 FROM public.email_templates
      WHERE org_id = org_record.id
        AND template_key = 'monthly_rental_statement'
    ) THEN
      CONTINUE;
    END IF;

    -- Insert default template
    -- Ensure we have a valid user_id before inserting
    -- If no admin found, try any member from the org
    IF admin_user_id IS NULL THEN
      SELECT user_id INTO admin_user_id
      FROM public.org_memberships
      WHERE org_id = org_record.id
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    -- If still no user, try to get any user from auth.users as fallback
    IF admin_user_id IS NULL THEN
      SELECT id INTO admin_user_id
      FROM auth.users
      ORDER BY created_at ASC
      LIMIT 1;
    END IF;

    -- Skip orgs without any users - they can't use templates anyway
    -- Double-check that we have a valid user_id before inserting
    IF admin_user_id IS NULL THEN
      RAISE NOTICE 'Skipping org % - no users found', org_record.id;
      CONTINUE;
    END IF;

    -- Final validation: ensure admin_user_id is not NULL
    IF admin_user_id IS NULL THEN
      RAISE WARNING 'admin_user_id is NULL for org % - this should not happen', org_record.id;
      CONTINUE;
    END IF;

    -- Insert with explicit user_id (trigger will not override if auth.uid() is NULL)
    INSERT INTO public.email_templates (
      org_id,
      template_key,
      name,
      description,
      subject_template,
      body_html_template,
      body_text_template,
      available_variables,
      status,
      created_by_user_id,
      updated_by_user_id
    ) VALUES (
      org_record.id,
      'monthly_rental_statement',
      'Monthly Rental Statement',
      'Default email template for monthly rental statements sent to property owners. Includes property details, financial summary, and PDF download link.',
      default_subject,
      default_html_body,
      default_text_body,
      default_variables,
      'active',
      admin_user_id,
      admin_user_id
    );
  END LOOP;
END
$$;

-- Re-enable triggers after migration
ALTER TABLE public.email_templates ENABLE TRIGGER trg_email_templates_created_by;
ALTER TABLE public.email_templates ENABLE TRIGGER trg_email_templates_updated_by;
COMMENT ON FUNCTION public.prevent_email_template_key_change() IS 'Trigger function to prevent template_key changes after creation. Enforces immutability.';

