import { NextRequest } from 'next/server';

// Simple in-memory rate limiting implementation
// In production, consider using Redis or a database
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const API_LIMIT = 100; // requests per window
const API_WINDOW = 60 * 1000; // 1 minute in milliseconds
const AUTH_LIMIT = 5; // requests per window
const AUTH_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds

export async function checkRateLimit(req: NextRequest, type: 'api' | 'auth' = 'api') {
  const key = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || req.headers.get('user-agent') || 'unknown';
  const limit = type === 'auth' ? AUTH_LIMIT : API_LIMIT;
  const window = type === 'auth' ? AUTH_WINDOW : API_WINDOW;
  
  const now = Date.now();
  const record = rateLimitStore.get(key);
  
  if (!record || now > record.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, resetTime: now + window });
    return { success: true };
  }
  
  if (record.count >= limit) {
    // Rate limit exceeded
    return { 
      success: false, 
      retryAfter: Math.ceil((record.resetTime - now) / 1000) 
    };
  }
  
  // Increment count
  record.count++;
  rateLimitStore.set(key, record);
  return { success: true };
}
