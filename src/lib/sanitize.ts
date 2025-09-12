/**
 * Simple input sanitization utility
 * Removes HTML tags and potentially dangerous content
 */
export function sanitize(input: unknown): unknown {
  if (typeof input === 'string') {
    // Remove HTML tags and potentially dangerous content.
    // Apply replacements repeatedly until no changes remain
    // to address multi-character sanitization concerns.
    let s = input
    let prev: string
    do {
      prev = s
      s = s
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        // Remove dangerous URL schemes: javascript:, vbscript:, data:
        .replace(/\b(?:javascript|vbscript|data)\s*:/gi, '')
        // Remove inline event handlers like onload=, onclick=, etc.
        .replace(/\s*on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    } while (s !== prev)
    return s.trim();
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitize);
  }
  
  if (input && typeof input === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitize(value);
    }
    return sanitized;
  }
  
  return input;
}

/**
 * Sanitize and validate input using a Zod schema
 */
export function sanitizeAndValidate<T>(
  input: unknown, 
  schema: { parse: (input: unknown) => T }
): T {
  const sanitized = sanitize(input);
  return schema.parse(sanitized);
}
