import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

/**
 * Hash a password using scrypt.
 * Format: scrypt$<salt>$<derivedKey>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Verify a password against a scrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [prefix, salt, key] = hash.split('$');
  if (prefix !== 'scrypt' || !salt || !key) return false;

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return derivedKey.toString('hex') === key;
}
