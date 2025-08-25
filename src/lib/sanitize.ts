/**
 * Simple input sanitization utility
 * Removes HTML tags and potentially dangerous content
 */
export function sanitize(input: unknown): unknown {
  if (typeof input === 'string') {
    // Remove HTML tags and potentially dangerous content
    return input
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim();
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
