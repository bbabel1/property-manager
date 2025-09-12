/**
 * Simple input sanitization utility
 * Removes HTML tags and potentially dangerous content
 */
export function sanitize(input: unknown): unknown {
  if (typeof input === 'string') {
    // Strip angle brackets as a single‑character operation to avoid
    // multi‑character regex pitfalls that CodeQL flags. This neutralizes
    // HTML/JSX tags entirely.
    let s = input.replace(/[<>]/g, '')
    // Neutralize dangerous URL schemes (javascript:, vbscript:, data:)
    s = s.replace(/\b(?:javascript|vbscript|data)\s*:/gi, '')
    return s.trim()
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
