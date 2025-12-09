/**
 * Email Template HTML Sanitization
 *
 * Sanitizes user-generated HTML to prevent XSS attacks and ensure valid markup.
 * Uses DOMPurify for sanitization with a strict allowlist of safe tags and attributes.
 */

// Note: Install DOMPurify: npm install dompurify @types/dompurify
// For server-side usage, use: npm install isomorphic-dompurify

let DOMPurify: any;

// Lazy load DOMPurify (works in both browser and Node.js)
async function getDOMPurify() {
  if (DOMPurify?.sanitize) {
    return DOMPurify;
  }

  try {
    // Try isomorphic-dompurify first (works in Node.js)
    const mod = await import('isomorphic-dompurify');
    const candidate = (mod as any).default ?? mod;
    if (candidate?.sanitize) {
      DOMPurify = candidate;
      return DOMPurify;
    }
    if (typeof candidate === 'function') {
      const instance = candidate((globalThis as any).window);
      if (instance?.sanitize) {
        DOMPurify = instance;
        return DOMPurify;
      }
    }
  } catch {
    try {
      // Fallback to regular DOMPurify (browser only)
      const createDOMPurify = await import('dompurify');
      const candidate = (createDOMPurify as any).default ?? createDOMPurify;
      if (candidate?.sanitize) {
        DOMPurify = candidate;
        return DOMPurify;
      }
    } catch (error) {
      console.error('Failed to load DOMPurify:', error);
      throw new Error('DOMPurify is required for HTML sanitization. Install: npm install isomorphic-dompurify');
    }
  }
}

/**
 * Allowed HTML tags for email templates
 * Safe subset of HTML tags commonly used in email templates
 */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'div',
  'span',
  'table',
  'tr',
  'td',
  'th',
  'thead',
  'tbody',
  'tfoot',
  'blockquote',
  'hr',
];

/**
 * Allowed HTML attributes per tag
 */
const ALLOWED_ATTR = [
  'href', // for <a>
  'title', // for various elements
  'alt', // for images (if we allow img)
  'class', // for styling
  'style', // inline styles (will be sanitized)
  'align', // for table cells
  'valign', // for table cells
  'colspan', // for table cells
  'rowspan', // for table cells
];

/**
 * Allowed CSS properties for style attribute
 * Limited to safe, non-executable CSS properties
 */
const ALLOWED_CSS_PROPERTIES = [
  'color',
  'background-color',
  'font-size',
  'font-family',
  'font-weight',
  'font-style',
  'text-align',
  'text-decoration',
  'line-height',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'border',
  'border-width',
  'border-style',
  'border-color',
  'border-radius',
  'width',
  'max-width',
  'height',
  'max-height',
  'display',
  'vertical-align',
];
const ALLOWED_CSS_PROPERTIES_SET = new Set(ALLOWED_CSS_PROPERTIES.map((p) => p.toLowerCase()));

function filterAllowedStyles(html: string): string {
  return html.replace(/style="([^"]*)"/gi, (_, styleValue: string) => {
    const filtered = styleValue
      .split(';')
      .map((rule) => rule.trim())
      .filter(Boolean)
      .map((rule) => {
        const [property, ...rest] = rule.split(':');
        if (!property || rest.length === 0) return null;
        const normalizedProp = property.trim().toLowerCase();
        if (!ALLOWED_CSS_PROPERTIES_SET.has(normalizedProp)) return null;
        return `${normalizedProp}: ${rest.join(':').trim()}`;
      })
      .filter(Boolean);

    if (!filtered.length) {
      return '';
    }

    return `style="${filtered.join('; ')}"`;
  });
}

/**
 * Sanitize HTML content for email templates
 *
 * Removes dangerous tags (script, iframe, object, embed) and sanitizes
 * attributes to prevent XSS attacks while preserving safe formatting.
 *
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized HTML string
 */
export async function sanitizeEmailTemplateHtml(html: string): Promise<string> {
  if (!html || typeof html !== 'string') {
    return '';
  }

  try {
    const purify = await getDOMPurify();

    const sanitized = purify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      RETURN_TRUSTED_TYPE: false,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
      // Sanitize style attribute
      ALLOW_DATA_ATTR: false,
      SAFE_FOR_TEMPLATES: false,
      SANITIZE_DOM: true,
      // Custom hook to sanitize style attribute
      ADD_ATTR: [],
      ADD_TAGS: [],
    });

    return filterAllowedStyles(sanitized);
  } catch (error) {
    console.error('Error sanitizing HTML:', error);
    // Fallback: strip all HTML tags if sanitization fails
    return html.replace(/<[^>]*>/g, '');
  }
}

/**
 * Sanitize HTML synchronously (for use in non-async contexts)
 * Note: This requires DOMPurify to be already loaded
 *
 * @param html - Raw HTML string to sanitize
 * @returns Sanitized HTML string
 */
export function sanitizeEmailTemplateHtmlSync(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  if (!DOMPurify) {
    console.warn('DOMPurify not loaded. HTML sanitization skipped.');
    // Fallback: basic tag stripping
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '');
  }

  try {
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    });
    return filterAllowedStyles(sanitized);
  } catch (error) {
    console.error('Error sanitizing HTML:', error);
    return html.replace(/<[^>]*>/g, '');
  }
}

/**
 * Strip HTML tags from text (for plain text email bodies)
 *
 * @param html - HTML string to strip
 * @returns Plain text string
 */
export function stripHtmlTags(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Remove script and style tags with their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Replace common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // Replace block-level tags with newlines
  text = text.replace(/<\/?(p|div|h[1-6]|li|tr|td|th|br|hr)[^>]*>/gi, '\n');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');

  // Clean up whitespace
  text = text.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

  return text;
}

/**
 * Escape HTML entities in text (for use in HTML templates)
 *
 * @param text - Plain text to escape
 * @returns Escaped HTML string
 */
export function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };

  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}
