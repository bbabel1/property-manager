import { describe, expect, it } from 'vitest';
import { buildOAuthRedirectUrl, resolvePostAuthRedirect } from '../../auth/redirect';

describe('resolvePostAuthRedirect', () => {
  it('returns fallback when input is undefined', () => {
    expect(resolvePostAuthRedirect(undefined)).toBe('/dashboard');
  });

  it('returns fallback when input is empty', () => {
    expect(resolvePostAuthRedirect('')).toBe('/dashboard');
  });

  it('returns fallback when input does not start with slash', () => {
    expect(resolvePostAuthRedirect('dashboard')).toBe('/dashboard');
  });

  it('returns fallback for protocol-relative urls', () => {
    expect(resolvePostAuthRedirect('//evil.com')).toBe('/dashboard');
  });

  it('returns fallback for absolute urls', () => {
    expect(resolvePostAuthRedirect('https://evil.com')).toBe('/dashboard');
  });

  it('returns sanitized path when valid', () => {
    expect(resolvePostAuthRedirect('/leases?id=1')).toBe('/leases?id=1');
  });
});

describe('buildOAuthRedirectUrl', () => {
  it('constructs callback without next when fallback', () => {
    expect(buildOAuthRedirectUrl('https://app.example.com')).toBe(
      'https://app.example.com/auth/callback',
    );
  });

  it('includes next param when provided', () => {
    expect(buildOAuthRedirectUrl('https://app.example.com', '/owners')).toBe(
      'https://app.example.com/auth/callback?next=%2Fowners',
    );
  });

  it('throws when origin missing', () => {
    expect(() => buildOAuthRedirectUrl('', '/owners')).toThrow('OAuth redirect requires a valid origin');
  });

  it('sanitizes next input', () => {
    expect(buildOAuthRedirectUrl('https://app.example.com', 'http://evil.com')).toBe(
      'https://app.example.com/auth/callback',
    );
  });
});








