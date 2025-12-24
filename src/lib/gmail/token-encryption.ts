/**
 * Token Encryption Utilities
 *
 * Encrypts/decrypts OAuth tokens before storing in database.
 * Uses AES-256-GCM encryption with a key derived from environment variable.
 */

import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.GMAIL_TOKEN_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || '';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
if (!ENCRYPTION_KEY) {
  console.warn('GMAIL_TOKEN_ENCRYPTION_KEY or NEXTAUTH_SECRET not set. Token encryption may fail.');
}

/**
 * Derive encryption key from master key
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

/**
 * Encrypt a token string
 */
export function encryptToken(token: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(ENCRYPTION_KEY, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();

  // Return format: salt:iv:tag:encrypted
  return `${salt.toString('hex')}:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt a token string
 */
export function decryptToken(encryptedToken: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error('Encryption key not configured');
  }

  const parts = encryptedToken.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid encrypted token format');
  }

  const [saltHex, ivHex, tagHex, encrypted] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const key = deriveKey(ENCRYPTION_KEY, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
