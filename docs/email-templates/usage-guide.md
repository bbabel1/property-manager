# Email Template Usage Guide

## For End Users

### Accessing Templates

1. Navigate to **Settings → Templates** in the application
2. View all available email templates for your organization
3. Filter by status (Active, Inactive, Archived)

### Editing Templates

1. Click **Edit** on any template in the list
2. Modify the template fields:
   - **Name**: Display name for the template
   - **Description**: Optional description
   - **Subject Line**: Email subject with variables
   - **HTML Body**: Rich HTML email content
   - **Plain Text Body**: Optional plain text version
3. Use the **Insert Variable** button to add dynamic variables
4. Click **Save** to update the template

### Inserting Variables

1. Click the **Insert Variable** button next to any template field
2. Search for variables by name
3. Click a variable to insert it at the cursor position
4. Variables are inserted as `{{variableName}}` placeholders

### Previewing Templates

1. Click **Preview** on a saved template
2. View rendered HTML and plain text versions
3. See any warnings about missing variables

### Sending Test Emails

1. Open a template for editing
2. Click **Send Test Email** (admin/manager only)
3. Enter recipient email address
4. Test email is sent with sample data

### Template Status

- **Active**: Template is used when sending emails
- **Inactive**: Template is hidden but not deleted
- **Archived**: Template is soft-deleted (can be restored)

## For Developers

### Adding New Template Types

1. Add template key to `EmailTemplateKey` enum in `src/types/email-templates.ts`
2. Add variable definitions to `src/lib/email-templates/variable-definitions.ts`
3. Update database CHECK constraint to include new template key
4. Create seed migration for default template

### Adding New Variables

1. Add variable definition to `MONTHLY_RENTAL_STATEMENT_VARIABLES` array
2. Include: `key`, `description`, `source`, `format`, `required`, `nullDefault`, `example`
3. Update `buildTemplateVariables()` function to map the variable
4. Update variable reference documentation

### Integrating Templates

```typescript
import { getEmailTemplate, renderEmailTemplate } from '@/lib/email-template-service';
import { buildTemplateVariables } from '@/lib/email-templates/variable-mapping';

// Fetch template
const template = await getEmailTemplate(orgId, 'monthly_rental_statement');

if (template && template.status === 'active') {
  // Build variables
  const variables = await buildTemplateVariables(monthlyLogId, orgId);

  // Render template
  const rendered = await renderEmailTemplate(template, variables);

  // Use rendered.subject, rendered.bodyHtml, rendered.bodyText
}
```

### Variable Formatting

Variables are automatically formatted based on their format type:

- **currency**: `$1,234.56`
- **date**: `1/15/2024` (short) or `January 15, 2024` (long)
- **number**: `1,234.56`
- **percent**: `12.5%`
- **url**: Validated and formatted URL
- **string**: Plain text (no formatting)

### Error Handling

- **Unknown variables**: Validation error prevents template save
- **Missing required variables**: Warning logged, empty string used
- **Missing optional variables**: Empty string or `nullDefault` used
- **Template not found**: Falls back to hardcoded template (with warning)

## Best Practices

1. **Subject Length**: Keep subject lines under 500 characters
2. **Body Length**: Keep HTML/text bodies under 50,000 characters
3. **Variable Usage**: Only use variables defined in `available_variables`
4. **HTML Safety**: Avoid complex HTML; stick to safe tags
5. **Testing**: Always preview templates before using in production
6. **Fallback**: Keep hardcoded templates in sync until migration complete

## Common Patterns

### Conditional Content (Manual)

Since templates don't support conditional logic, use descriptive variable names and handle empty values in the template:

```html
{{#if propertyAddressLine2}} {{propertyAddressLine1}}, {{propertyAddressLine2}} {{else}}
{{propertyAddressLine1}} {{/if}}
```

Note: Actual conditional syntax not supported - use fallback values or separate templates.

### Currency Display

```html
<p>Net to Owner: <strong>{{netToOwner}}</strong></p>
```

### Date Display

```html
<p>Statement Period: {{periodMonth}}</p>
<p>Created: {{statementCreatedAt}}</p>
```

### Links

```html
<a href="{{pdfUrl}}">Download Statement PDF</a> <a href="{{statementUrl}}">View in App</a>
```
