# Email Template HTML Sanitization Policy

## Overview

All user-generated HTML in email templates is sanitized to prevent XSS attacks and ensure valid markup. Sanitization occurs on **save** (when templates are created or updated).

## Implementation

- **Library**: DOMPurify (isomorphic-dompurify for server-side, dompurify for client-side)
- **Timing**: Sanitization happens when templates are saved to the database
- **Storage**: Sanitized HTML is stored in the database

## Allowed HTML Tags

The following HTML tags are allowed in email templates:

- **Text formatting**: `p`, `br`, `strong`, `em`, `b`, `i`, `u`
- **Lists**: `ul`, `ol`, `li`
- **Headings**: `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
- **Containers**: `div`, `span`
- **Tables**: `table`, `tr`, `td`, `th`, `thead`, `tbody`, `tfoot`
- **Other**: `a`, `blockquote`, `hr`

## Allowed Attributes

- `href` (for `<a>` tags)
- `title` (for various elements)
- `alt` (for images, if images are allowed)
- `class` (for styling)
- `style` (inline styles - limited CSS properties)
- `align`, `valign` (for table cells)
- `colspan`, `rowspan` (for table cells)

## Allowed CSS Properties (in style attribute)

Limited to safe, non-executable CSS properties:

- **Colors**: `color`, `background-color`
- **Typography**: `font-size`, `font-family`, `font-weight`, `font-style`, `text-align`, `text-decoration`, `line-height`
- **Spacing**: `margin`, `margin-top`, `margin-right`, `margin-bottom`, `margin-left`, `padding`, `padding-top`, `padding-right`, `padding-bottom`, `padding-left`
- **Borders**: `border`, `border-width`, `border-style`, `border-color`, `border-radius`
- **Layout**: `width`, `max-width`, `height`, `max-height`, `display`, `vertical-align`

## Blocked Tags

The following tags are **forbidden** and will be removed:

- `script` - Prevents JavaScript execution
- `iframe` - Prevents embedded content
- `object` - Prevents plugin content
- `embed` - Prevents embedded content
- `form` - Prevents form submission
- `input` - Prevents form inputs
- `button` - Prevents interactive buttons

## Blocked Attributes

The following attributes are **forbidden** and will be removed:

- `onerror` - Prevents error handlers
- `onload` - Prevents load handlers
- `onclick` - Prevents click handlers
- `onmouseover` - Prevents mouse event handlers
- `onfocus` - Prevents focus handlers
- `onblur` - Prevents blur handlers
- All other `on*` event handlers

## URL Validation

- URLs in `href` attributes are validated against a safe regex pattern
- Allowed protocols: `http`, `https`, `mailto`, `tel`, `callto`, `sms`, `cid`, `xmpp`
- Invalid URLs are removed

## Security Considerations

1. **XSS Prevention**: All user input is sanitized before storage
2. **HTML Injection Prevention**: Only safe HTML tags and attributes are allowed
3. **Script Execution Prevention**: All script tags and event handlers are removed
4. **Content Security**: External content (iframes, objects) is blocked

## Sanitization Timing

- **On Save**: HTML is sanitized when templates are created or updated via API
- **On Preview**: HTML is sanitized before rendering preview (double-check)
- **On Render**: HTML is sanitized before sending emails (final safety check)

## Fallback Behavior

If sanitization fails or DOMPurify is not available:
- All HTML tags are stripped
- Plain text is returned
- A warning is logged

## Installation

To enable HTML sanitization, install DOMPurify:

```bash
npm install isomorphic-dompurify @types/dompurify
```

The sanitization module will automatically use `isomorphic-dompurify` for server-side rendering and `dompurify` for client-side usage.

